import { Prisma } from "@prisma/client";
import PaymentService from "./payment.service.js";
import GatewayService from "./gateway.service.js";
import ExchangeService from "./exchange.service.js";
import BlockchainService from "./blockchain.service.js";
import PaymentProviderAccountService from "./payment-provider-account.service.js";
import ProviderManager from "../providers/provider.manager.js";
import ProviderFactory from "../providers/provider.factory.js";
import SmartGatewaySelector from "../providers/smart-gateway-selector.js";
import ProviderFailover from "../providers/provider-failover.js";
import ProviderMetricsService from "../providers/provider-metrics.service.js";
import {
  NotConfiguredCryptoTransferProvider,
} from "../providers/crypto-transfer.provider.js";

export default class PaymentOrchestratorService {
  private readonly paymentService: PaymentService;

  private readonly gatewayService: GatewayService;

  private readonly paymentProviderAccountService: PaymentProviderAccountService;

  private readonly providerManager =
    new ProviderManager();

  private readonly selector =
    new SmartGatewaySelector();

  private readonly failover =
    new ProviderFailover();

  private readonly metrics =
    new ProviderMetricsService();

  private readonly exchangeService: ExchangeService;

  private readonly blockchainService: BlockchainService;

  private readonly cryptoTransferProvider: any;

  constructor(
    private readonly app: any
  ) {
    this.paymentService =
      new PaymentService(app);

    this.gatewayService =
      new GatewayService(app);

    this.paymentProviderAccountService =
      new PaymentProviderAccountService(app);

    this.exchangeService =
      new ExchangeService(app);

    this.blockchainService =
      new BlockchainService(app);

    this.cryptoTransferProvider =
      new NotConfiguredCryptoTransferProvider();
  }

  normalizeCryptoDestinationMetadata(
    metadata?: Prisma.JsonValue
  ): Prisma.JsonValue {
    const source =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    const normalized =
      JSON.parse(
        JSON.stringify(source)
      ) as Record<string, unknown>;

    const destinationCandidates = [
      normalized.cryptoDestination,
      normalized.crypto_destination,
      normalized.destination,
    ];

    const resolvedDestination =
      destinationCandidates.find(
        (
          candidate
        ): candidate is Record<string, unknown> =>
          candidate !== undefined &&
          candidate !== null &&
          typeof candidate === "object" &&
          !Array.isArray(candidate)
      );

    if (resolvedDestination) {
      normalized.cryptoDestination = {
        ...resolvedDestination,
      };
    }

    return this.normalizeJsonValue(
      normalized
    );
  }

  async processFiatToCryptoSettlement(
    paymentIntentId: string,
    payload: {
      transactionId?: string;
      asset?: string;
      network?: string;
      destinationAddress?: string;
      walletId?: string;
    }
  ) {
    const paymentIntent = await this.paymentService.getPaymentIntent(paymentIntentId);
    if (!paymentIntent) throw new Error("Payment Intent not found.");
    if (!payload.transactionId) throw new Error("Transaction ID is required for crypto settlement.");

    const transaction = await this.paymentService.findTransactionById(payload.transactionId);
    if (!transaction || transaction.paymentIntentId !== paymentIntent.id) {
      throw new Error("Transaction does not belong to the payment intent.");
    }

    const existingConversion = await this.app.prisma.cryptoConversion.findFirst({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "desc" },
    });

    if (existingConversion && ["pending", "exchange_pending", "completed"].includes(existingConversion.status)) {
      return { conversion: existingConversion, duplicate: true };
    }

    const provider = await this.exchangeService.getExchangeProvider();
    await provider.getQuote({
      baseAsset: String(payload.asset ?? "USDT").toUpperCase(),
      quoteAsset: String(paymentIntent.currency),
      side: "BUY",
      amount: new Prisma.Decimal(String(paymentIntent.amount)),
    });

    throw new Error(
      "QUIDAX_CONTRACT_NOT_VERIFIED: Quidax quote/order contract is not verified, so no fiat-to-crypto order or transfer was created."
    );
  }

  async checkoutPaymentIntent(
    paymentIntentId: string,
    customer: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    } = {}
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found."
      );
    }

    if (
      paymentIntent.status !==
      "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot be paid.`
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <=
        new Date()
    ) {
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id
      );

      throw new Error(
        "Payment Intent has expired."
      );
    }

    const email =
      customer.email ??
      paymentIntent.customer?.email ??
      undefined;

    if (!email) {
      throw new Error(
        "Customer email is required for payment."
      );
    }

    // Ensure paymentIntent currency matches merchant currency to avoid provider mismatches.
    try {
      const merchant = await this.app.prisma.merchant.findUnique({
        where: { id: paymentIntent.merchantId },
        select: { id: true, currency: true }
      });

      if (merchant && String(merchant.currency) !== String(paymentIntent.currency)) {
        console.warn(`Aligning paymentIntent currency ${paymentIntent.currency} -> ${merchant.currency} for merchant ${merchant.id}`);

        await this.app.prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: { currency: merchant.currency }
        });

        // reflect change locally
        paymentIntent.currency = merchant.currency as any;
      }
    } catch (e) {
      console.error('Failed to align paymentIntent currency with merchant:', e);
    }

    /*
    |
    | Crypto Destination Validation
    |
    */

    const checkoutMetadata =
      this.normalizeCryptoDestinationMetadata(
        paymentIntent.metadata
      );

    const cryptoDestination =
      checkoutMetadata &&
      typeof checkoutMetadata ===
        "object" &&
      !Array.isArray(
        checkoutMetadata
      ) &&
      checkoutMetadata.cryptoDestination &&
      typeof checkoutMetadata.cryptoDestination ===
        "object" &&
      !Array.isArray(
        checkoutMetadata.cryptoDestination
      )
        ? (
            checkoutMetadata.cryptoDestination as Record<
              string,
              unknown
            >
          )
        : undefined;

    if (
      cryptoDestination &&
      typeof cryptoDestination ===
        "object"
    ) {
      const destinationAddress =
        typeof cryptoDestination.address === "string"
          ? cryptoDestination.address
          : undefined;

      if (
        destinationAddress &&
        !destinationAddress.trim()
      ) {
        throw new Error(
          "Crypto destination address is required."
        );
      }
    }

    const existingTransaction =
      paymentIntent.transactions.find(
        (transaction) =>
          transaction.status ===
          "INITIATED"
      );

    const transaction =
      existingTransaction ??
      (await this.paymentService.createTransaction(
        {
          merchantId:
            paymentIntent.merchantId,

          customerId:
            paymentIntent.customerId ??
            undefined,

          amount:
            paymentIntent.amount,

          currency:
            paymentIntent.currency,

          paymentMethod:
            "card",

          type:
            "payment",

          description:
            paymentIntent.description ??
            undefined,

          paymentIntentId:
            paymentIntent.id,

          metadata:
            checkoutMetadata,
        }
      ));

    const existingAttempt =
      paymentIntent.paymentAttempts.find(
        attempt =>
          attempt.transactionId ===
            transaction.id &&
          attempt.status ===
            "PENDING"
      );

    const paymentAttempt =
      existingAttempt ??
      await this.paymentService.createPaymentAttempt({
        paymentIntentId:
          paymentIntent.id,

        transactionId:
          transaction.id,

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency
      });

    const providers =
      await this.gatewayService.activeProviders();

    const providerNames =
      providers
        .filter(
          provider => provider.isActive
        )
        .sort(
          (a, b) =>
            a.priority - b.priority
        )
        .map(
          provider => provider.name
        );

    if (!providerNames.length) {
      throw new Error(
        "No active payment provider configured."
      );
    }

    const selectedProvider =
      this.selector.select(
        providers,
        {
          merchantId:
            paymentIntent.merchantId,

          currency:
            String(
              paymentIntent.currency
            ),

          amount:
            Number(
              paymentIntent.amount
            ),

          paymentMethod:
            "card"
        }
      );

    const gatewayRequest =
      await this.gatewayService.createGatewayRequest({
        providerId:
          selectedProvider.id,

        transactionId:
          transaction.id,

        endpoint:
          selectedProvider.baseUrl ??
          "/payment",

        method:
          "POST",

        requestBody: {
          amount:
            paymentIntent.amount.toString(),

          currency:
            String(
              paymentIntent.currency
            ),

          reference:
            transaction.reference,

          customerEmail:
            email
        },

        requestHeaders: {}
      });

      if (!transaction.reference) {
  throw new Error(
    "Transaction reference is missing."
  );
}

    const providerAmount = Number(paymentIntent.amount);
    const providerCurrency = String(paymentIntent.currency);

    try {
      const execution = await this.failover.execute(
        providerNames,
        async provider =>
          provider.createPayment({
            amount: providerAmount,
            currency: providerCurrency,
            reference: transaction.reference!,
            description: paymentIntent.description ?? undefined,
            customer: {
              email,
              firstName: customer.firstName ?? paymentIntent.customer?.firstName ?? undefined,
              lastName: customer.lastName ?? paymentIntent.customer?.lastName ?? undefined,
              phone: customer.phone ?? paymentIntent.customer?.phone ?? undefined
            },
            metadata: {
              paymentIntentId: paymentIntent.id,
              transactionId: transaction.id,
              paymentAttemptId: paymentAttempt.id
            }
          })
      );

      const providerResponse = execution.result;
      const authorizationCode = providerResponse.authorizationCode ?? null;

      await this.app.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          gatewayTransactionId: providerResponse.transactionId ?? providerResponse.reference ?? null,
          gatewayProvider: execution.providerName,
          authCode: authorizationCode,
          approvalCode: authorizationCode
        }
      });

      if (authorizationCode) {
        await this.paymentService.authorizeTransaction({
          transactionId: transaction.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          authorizationCode,
          gatewayResponse:
            (providerResponse.raw ?? providerResponse) as Prisma.JsonValue,
          message: "Provider authorization captured for reusable customer payment."
        });
      }

      await this.gatewayService.createGatewayResponse({
        gatewayRequestId:
          gatewayRequest.id,

        statusCode:
          200,

        responseBody:
          providerResponse.raw ?? {},

        responseHeaders:
          {},

        responseTime:
          0
      });

      return {
        paymentIntent,

        transaction,

        paymentAttempt,

        provider:
          execution.providerName,

        gateway: {
          transactionId:
            providerResponse.transactionId ??
            providerResponse.reference ??
            null,

          paymentUrl:
            providerResponse.paymentUrl ??
            null,

          accessCode:
            providerResponse.accessCode ??
            null,

          authorizationCode:
            providerResponse.authorizationCode ??
            null
        },

        response:
          providerResponse
      };
    } catch (error) {
      await this.gatewayService.createGatewayResponse({
        gatewayRequestId:
          gatewayRequest.id,

        statusCode:
          500,

        responseBody:
          {},

        responseHeaders:
          {},

        error:
          error instanceof Error
            ? error.message
            : "Payment failed"
      });

      throw error;
    }
  }

  async getPaymentIntentAuthorizations(
    paymentIntentId: string,
    customerId?: string
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found."
      );
    }

    if (
      paymentIntent.status !== "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot accept saved authorizations.`
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <= new Date()
    ) {
      await this.paymentService.expirePaymentIntent(paymentIntent.id);
      throw new Error(
        "Payment Intent has expired."
      );
    }

    if (
      customerId &&
      paymentIntent.customerId &&
      paymentIntent.customerId !== customerId
    ) {
      throw new Error(
        "This payment intent does not belong to the current customer."
      );
    }

    const authorizations =
      await this.paymentService.listAuthorizationsForPaymentIntent(
        paymentIntent.id,
        customerId
      );

    return {
      paymentIntent,
      authorizations
    };
  }

  async chargeSavedAuthorization(
    paymentIntentId: string,
    customerId: string | undefined,
    authorizationId: string,
    payload?: {
      idempotencyKey?: string;
      metadata?: Prisma.JsonValue;
    }
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found."
      );
    }

    if (
      paymentIntent.status !== "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot be paid.`
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <= new Date()
    ) {
      await this.paymentService.expirePaymentIntent(paymentIntent.id);
      throw new Error("Payment Intent has expired.");
    }

    if (
      customerId &&
      paymentIntent.customerId &&
      paymentIntent.customerId !== customerId
      ) {
      throw new Error(
        "This payment intent does not belong to the current customer."
      );
    }

    const authorization =
      await this.paymentService.getAuthorizationForPaymentIntent(
        paymentIntent.id,
        customerId,
        authorizationId
      );

    if (!authorization) {
      throw new Error(
        "No reusable payment authorization is available for this customer."
      );
    }

    const requestKey =
      payload?.idempotencyKey ??
      `saved-auth:${paymentIntent.id}:${authorization.id}`;

    const existingTransaction =
      await this.app.prisma.transaction.findUnique({
        where: {
          idempotencyKey: requestKey
        }
      });

    if (existingTransaction) {
      return {
        paymentIntent,
        transaction: existingTransaction,
        authorization,
        duplicate: true
      };
    }

    const providers =
      await this.gatewayService.activeProviders();

    const providerNames =
      providers
        .filter(provider => provider.isActive)
        .sort((a, b) => a.priority - b.priority)
        .map(provider => provider.name);

    if (!providerNames.length) {
      throw new Error(
        "No active payment provider configured."
      );
    }

    const selectedProvider = this.selector.select(
      providers, {
        merchantId: paymentIntent.merchantId,
        currency: String(paymentIntent.currency),
        amount: Number(paymentIntent.amount),
        paymentMethod: "card"
      }
    );

    const provider =
      this.providerManager.getProvider(
        selectedProvider.name
      );

    const transaction =
      await this.paymentService.createTransaction({
        merchantId: paymentIntent.merchantId,
        customerId: paymentIntent.customerId ?? customerId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: "card",
        type: "payment",
        description: paymentIntent.description ?? undefined,
        paymentIntentId: paymentIntent.id,
        idempotencyKey: requestKey,
        metadata: payload?.metadata ?? paymentIntent.metadata
      });

    const paymentAttempt =
      await this.paymentService.createPaymentAttempt({
        paymentIntentId: paymentIntent.id,
        transactionId: transaction.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });

    const providerResponse =
      await this.failover.execute(
        providerNames,
        async () =>
          provider.chargeWithAuthorization({
            amount: Number(paymentIntent.amount),
            currency: String(paymentIntent.currency),
            email: paymentIntent.customer?.email ?? customerId ?? "customer@example.com",
            authorizationCode: authorization.authorizationCode ?? "",
            reference: transaction.reference!,
            description: paymentIntent.description ?? undefined,
            metadata: {
              paymentIntentId: paymentIntent.id,
              transactionId: transaction.id,
              paymentAttemptId: paymentAttempt.id,
              authorizationId: authorization.id
            }
          })
      );

    const response = providerResponse.result;

    await this.app.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        gatewayTransactionId:
          response.transactionId ?? response.reference ?? null,
        gatewayProvider: providerResponse.providerName,
        authCode: response.authorizationCode ?? authorization.authorizationCode ?? null,
        approvalCode: response.authorizationCode ?? authorization.authorizationCode ?? null
      }
    });

    if (
      response.authorizationCode ||
      authorization.authorizationCode
    ) {
      await this.paymentService.authorizeTransaction({
        transactionId: transaction.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        authorizationCode:
          response.authorizationCode ??
          authorization.authorizationCode ??
          undefined,
        gatewayResponse:
          (response.raw ?? response) as Prisma.JsonValue,
        message:
          "Saved customer authorization charged successfully."
      });
    }

    await this.paymentService.completePaymentAttempt(
      paymentAttempt.id,
      (response.raw ?? response) as Prisma.JsonValue
    );

    return {
      paymentIntent,
      transaction,
      paymentAttempt,
      authorization,
      provider: providerResponse.providerName,
      gateway: {
        transactionId:
          response.transactionId ?? response.reference ?? null,
        paymentUrl: response.paymentUrl ?? null,
        accessCode: response.accessCode ?? null,
        authorizationCode:
          response.authorizationCode ?? authorization.authorizationCode ?? null
      },
      response
    };
  }

  async listCustomerPaymentMethods(paymentIntentId: string) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error("Payment Intent not found.");
    }

    if (paymentIntent.status !== "PENDING") {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot accept saved payment methods.`
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <= new Date()
    ) {
      await this.paymentService.expirePaymentIntent(paymentIntent.id);
      throw new Error("Payment Intent has expired.");
    }

    const authorizations =
      await this.paymentService.listAuthorizationsForPaymentIntent(
        paymentIntent.id,
        paymentIntent.customerId ?? undefined
      );

    return authorizations.map((authorization) => ({
      id: authorization.id,
      type: "card",
      label: "Saved card",
      brand: null,
      last4: null,
      isReusable: true,
      status: authorization.status,
      createdAt: authorization.createdAt,
    }));
  }

  async chargeCustomerPaymentMethod(
    paymentMethodId: string,
    paymentIntentId: string,
    payload?: {
      idempotencyKey?: string;
      metadata?: Prisma.JsonValue;
    }
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error("Payment Intent not found.");
    }

    if (paymentIntent.status !== "PENDING") {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot be paid.`
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <= new Date()
    ) {
      await this.paymentService.expirePaymentIntent(paymentIntent.id);
      throw new Error("Payment Intent has expired.");
    }

    const authorization =
      await this.paymentService.getAuthorizationForPaymentIntent(
        paymentIntent.id,
        paymentIntent.customerId ?? undefined,
        paymentMethodId
      );

    if (!authorization) {
      throw new Error(
        "No reusable payment method is available for this customer."
      );
    }

    return this.chargeSavedAuthorization(
      paymentIntent.id,
      paymentIntent.customerId ?? undefined,
      authorization.id,
      payload
    );
  }

  async createPayment(data: {

    merchantId: string;

    customerId?: string;

    paymentMethodId?: string;

    paymentProviderAccountId?: string;

    amount: Prisma.Decimal;

    currency: any;

    paymentMethod: string;

    description?: string;

    idempotencyKey?: string;

    metadata?: Prisma.JsonValue;

  }) {

    // Resolve the payment provider account
    let accountId = data.paymentProviderAccountId;
    let selectedAccount: any = null;
    let providerToUse: any = null;

    if (accountId) {
      // Validate that the account exists and belongs to this merchant
      selectedAccount = await this.app.prisma.paymentProviderAccount.findUnique({
        where: { id: accountId }
      });

      if (!selectedAccount) {
        throw new Error(
          "Payment account is not available for this merchant."
        );
      }

      if (selectedAccount.deletedAt) {
        throw new Error(
          "Payment account is not available for this merchant."
        );
      }

      // Validate merchant ownership: if account is merchant-specific, it must match the request merchant
      if (selectedAccount.merchantId && selectedAccount.merchantId !== data.merchantId) {
        this.app.log.warn(
          { accountId, requestMerchantId: data.merchantId, accountMerchantId: selectedAccount.merchantId },
          "Payment provider account does not belong to authenticated merchant"
        );

        throw new Error(
          "Payment account is not available for this merchant."
        );
      }

      // Validate account status
      if (selectedAccount.status !== "ACTIVE") {
        throw new Error(
          `Payment account is ${selectedAccount.status.toLowerCase()}. Payment cannot proceed.`
        );
      }

      // Resolve credentials from the account
      try {
        const credentials = await this.paymentProviderAccountService.resolveCredentials(accountId);

        // Create provider with resolved credentials
        providerToUse = ProviderFactory.createWithSecret(
          selectedAccount.provider.toLowerCase(),
          { secretKey: credentials.secretKey }
        );
      } catch (err) {
        this.app.log.error(
          { err, accountId },
          "Failed to resolve credentials for payment provider account"
        );

        throw new Error(
          "Selected fiat payment provider credentials are not configured. Payment cannot proceed."
        );
      }
    } else {
      // No account specified - use default selection logic (existing behavior)
      // For now, if no account is specified, we require one for proper routing
      throw new Error(
        "Payment account is required."
      );
    }

    // Create payment intent with the selected account
    const paymentIntent =
      await this.paymentService.createPaymentIntent({

        merchantId: data.merchantId,

        customerId: data.customerId,

        paymentMethodId: data.paymentMethodId,

        paymentProviderAccountId: accountId,

        amount: data.amount,

        currency: data.currency,

        description: data.description,

        metadata: data.metadata

      });

    const providerResponse =
      await this.failover.execute(
        [selectedAccount.provider.toLowerCase()],
        async () => providerToUse.createPayment({
          amount: Number(data.amount),
          currency: String(data.currency),
          reference: data.idempotencyKey ?? `pi:${paymentIntent.id}`,
          description: data.description ?? undefined,
          customer: {
            email: paymentIntent.customer?.email ?? "customer@example.com",
            firstName: paymentIntent.customer?.firstName ?? undefined,
            lastName: paymentIntent.customer?.lastName ?? undefined
          },
          metadata: data.metadata ?? {}
        })
      );

    return providerResponse;
  }

  private normalizeJsonValue(
    value: Prisma.JsonValue | Record<string, unknown>
  ): Prisma.JsonValue {
    return JSON.parse(
      JSON.stringify(value)
    ) as Prisma.JsonValue;
  }
}
