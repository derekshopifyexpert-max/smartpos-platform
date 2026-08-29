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

type MoneyInput =
  | Prisma.Decimal
  | number
  | string;

type PaymentMetadata =
  | Prisma.JsonValue
  | undefined;

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
    private readonly app: any,
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

  /*
  |--------------------------------------------------------------------------
  | JSON Helpers
  |--------------------------------------------------------------------------
  */

  private normalizeJsonValue(
    value:
      | Prisma.JsonValue
      | Record<string, unknown>,
  ): Prisma.JsonValue {
    return JSON.parse(
      JSON.stringify(value),
    ) as Prisma.JsonValue;
  }

  private normalizeProviderMetadata(
    metadata?: Prisma.JsonValue,
  ): Record<string, any> {
    if (
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
    ) {
      return JSON.parse(
        JSON.stringify(metadata),
      ) as Record<string, any>;
    }

    return {};
  }

  normalizeCryptoDestinationMetadata(
    metadata?: Prisma.JsonValue,
  ): Prisma.JsonValue {
    const source =
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? (metadata as Record<
            string,
            unknown
          >)
        : {};

    const normalized =
      JSON.parse(
        JSON.stringify(source),
      ) as Record<
        string,
        unknown
      >;

    const destinationCandidates = [
      normalized.cryptoDestination,
      normalized.crypto_destination,
      normalized.destination,
    ];

    const resolvedDestination =
      destinationCandidates.find(
        (
          candidate,
        ): candidate is Record<
          string,
          unknown
        > =>
          candidate !== undefined &&
          candidate !== null &&
          typeof candidate === "object" &&
          !Array.isArray(candidate),
      );

    if (resolvedDestination) {
      normalized.cryptoDestination = {
        ...resolvedDestination,
      };
    }

    return this.normalizeJsonValue(
      normalized,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Money Helpers
  |--------------------------------------------------------------------------
  */

  private decimal(
    value: MoneyInput,
  ): Prisma.Decimal {
    if (
      value instanceof Prisma.Decimal
    ) {
      return value;
    }

    return new Prisma.Decimal(
      String(value),
    );
  }

  private numericAmount(
    value: MoneyInput,
  ): number {
    const amount =
      Number(value);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Payment amount must be greater than zero.",
      );
    }

    return amount;
  }

  /*
  |--------------------------------------------------------------------------
  | Fiat -> Crypto Settlement
  |--------------------------------------------------------------------------
  */

  async processFiatToCryptoSettlement(
    paymentIntentId: string,
    payload: {
      transactionId?: string;
      asset?: string;
      network?: string;
      destinationAddress?: string;
      walletId?: string;
    },
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found.",
      );
    }

    if (!payload.transactionId) {
      throw new Error(
        "Transaction ID is required for crypto settlement.",
      );
    }

    const transaction =
      await this.paymentService.findTransactionById(
        payload.transactionId,
      );

    if (
      !transaction ||
      transaction.paymentIntentId !==
        paymentIntent.id
    ) {
      throw new Error(
        "Transaction does not belong to the payment intent.",
      );
    }

    if (
      transaction.status !==
      "CAPTURED"
    ) {
      throw new Error(
        `Cannot settle crypto: transaction status is ${transaction.status}. Payment must be CAPTURED first.`,
      );
    }

    const existingConversion =
      await this.app.prisma.cryptoConversion.findFirst({
        where: {
          transactionId:
            transaction.id,
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });

    if (
      existingConversion &&
      [
        "exchange_pending",
        "exchange_completed",
        "crypto_settled",
      ].includes(
        existingConversion.status,
      )
    ) {
      return {
        conversion:
          existingConversion,

        duplicate:
          true,
      };
    }

    const cryptoAsset =
      String(
        payload.asset ??
          "USDT",
      )
        .trim()
        .toUpperCase();

    if (
      ![
        "USDT",
        "BUSD",
        "USDC",
      ].includes(
        cryptoAsset,
      )
    ) {
      throw new Error(
        `Unsupported crypto asset: ${cryptoAsset}. Supported: USDT, BUSD, USDC`,
      );
    }

    const destinationAddress =
      payload.destinationAddress?.trim();

    if (!destinationAddress) {
      throw new Error(
        "Destination blockchain address is required.",
      );
    }

    const network =
      String(
        payload.network ??
          "ERC20",
      )
        .trim()
        .toUpperCase();

    const conversion =
      await this.app.prisma.cryptoConversion.create({
        data: {
          transactionId:
            transaction.id,

          status:
            "exchange_pending",

          fromCurrency:
            paymentIntent.currency,

          fromAmount:
            this.decimal(
              paymentIntent.amount,
            ),

          toCurrency:
            cryptoAsset,

          toAmount:
            new Prisma.Decimal(
              "0",
            ),

          rate:
            new Prisma.Decimal(
              "0",
            ),

          network,

          destinationAddress,

          metadata:
            this.normalizeJsonValue({
              paymentIntentId,

              provider:
                "QUIDAX",

              walletId:
                payload.walletId ??
                null,

              createdAt:
                new Date().toISOString(),
            }),
        },
      });

    try {
      /*
       * Quidax is deliberately isolated to the
       * fiat -> crypto exchange settlement path.
       *
       * Flutterwave is NOT used for crypto exchange
       * execution here.
       */
      const provider =
        await this.exchangeService.getExchangeProvider();

      const quoteAsset =
        String(
          paymentIntent.currency,
        )
          .trim()
          .toUpperCase();

      const order =
        await provider.buy({
          side:
            "BUY",

          baseAsset:
            cryptoAsset,

          quoteAsset,

          amount:
            this.decimal(
              paymentIntent.amount,
            ),

          limitPrice:
            undefined,
        });

      const orderId =
        order.orderId;

      if (!orderId) {
        throw new Error(
          "Exchange provider did not return an order ID.",
        );
      }

      const executedAmount =
        order.executedAmount
          ?.toString() ??
        "0";

      const averagePrice =
        order.averagePrice
          ?.toString() ??
        "0";

      const exchangeOrder =
        await this.app.prisma.exchangeOrder.create({
          data: {
            orderId,

            status:
              order.status,

            market:
              `${cryptoAsset}${quoteAsset}`.toLowerCase(),

            side:
              "BUY",

            amount:
              this.decimal(
                paymentIntent.amount,
              ),

            filledAmount:
              new Prisma.Decimal(
                executedAmount,
              ),

            price:
              new Prisma.Decimal(
                averagePrice,
              ),

            avgPrice:
              new Prisma.Decimal(
                averagePrice,
              ),

            provider:
              "QUIDAX",

            metadata:
              this.normalizeJsonValue({
                createdAt:
                  new Date().toISOString(),

                quidaxOrderId:
                  orderId,

                quidaxStatus:
                  order.status,

                paymentIntentId,

                transactionId:
                  transaction.id,

                network,

                destinationAddress,
              }),
          },
        });

      const existingConversionMetadata =
        conversion.metadata &&
        typeof conversion.metadata ===
          "object" &&
        !Array.isArray(
          conversion.metadata,
        )
          ? (
              conversion.metadata as Record<
                string,
                unknown
              >
            )
          : {};

      const updatedMetadata = {
        ...existingConversionMetadata,

        exchangeOrderId:
          exchangeOrder.id,

        orderId,

        initialStatus:
          order.status,
      };

      const updatedConversion =
        await this.app.prisma.cryptoConversion.update({
          where: {
            id:
              conversion.id,
          },

          data: {
            exchangeOrderId:
              exchangeOrder.id,

            toAmount:
              new Prisma.Decimal(
                executedAmount,
              ),

            rate:
              new Prisma.Decimal(
                averagePrice,
              ),

            metadata:
              this.normalizeJsonValue(
                updatedMetadata,
              ),
          },
        });

      return {
        conversion:
          updatedConversion,

        exchangeOrder,

        duplicate:
          false,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      const existingConversionMetadata =
        conversion.metadata &&
        typeof conversion.metadata ===
          "object" &&
        !Array.isArray(
          conversion.metadata,
        )
          ? (
              conversion.metadata as Record<
                string,
                unknown
              >
            )
          : {};

      await this.app.prisma.cryptoConversion.update({
        where: {
          id:
            conversion.id,
        },

        data: {
          status:
            "failed",

          metadata:
            this.normalizeJsonValue({
              ...existingConversionMetadata,

              errorMessage,

              failedAt:
                new Date().toISOString(),
            }),
        },
      });

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Checkout
  |--------------------------------------------------------------------------
  */

  async checkoutPaymentIntent(
  paymentIntentId: string,
  customer: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    cryptoDestination?: {
      asset?: string;
      network?: string;
      address?: string;
      walletId?: string;
      amount?: number;
      currency?: string;
      reference?: string;
    };
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
    paymentIntent.status !== "PENDING"
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

  const paymentCustomer =
    paymentIntent.customerId
      ? await this.app.prisma.customer.findUnique(
          {
            where: {
              id: paymentIntent.customerId,
            },
          }
        )
      : null;

  const email =
    customer.email ??
    paymentCustomer?.email ??
    undefined;

  if (!email) {
    throw new Error(
      "Customer email is required for payment."
    );
  }

  /*
   * Keep merchant/payment-intent currency
   * alignment behavior.
   */
  try {
    const merchant =
      await this.app.prisma.merchant.findUnique(
        {
          where: {
            id: paymentIntent.merchantId,
          },
          select: {
            id: true,
            currency: true,
          },
        }
      );

    if (
      merchant &&
      String(merchant.currency) !==
        String(paymentIntent.currency)
    ) {
      this.app.log.warn(
        {
          paymentIntentId:
            paymentIntent.id,
          merchantId:
            merchant.id,
          paymentIntentCurrency:
            paymentIntent.currency,
          merchantCurrency:
            merchant.currency,
        },
        "Aligning payment intent currency with merchant currency"
      );

      await this.app.prisma.paymentIntent.update(
        {
          where: {
            id: paymentIntent.id,
          },
          data: {
            currency:
              merchant.currency,
          },
        }
      );

      paymentIntent.currency =
        merchant.currency as any;
    }
  } catch (error) {
    this.app.log.warn(
      {
        error,
        paymentIntentId,
      },
      "Failed to align payment intent currency with merchant"
    );
  }

  const checkoutMetadata =
    this.normalizeCryptoDestinationMetadata(
      paymentIntent.metadata
    );

  const metadataRecord =
    checkoutMetadata &&
    typeof checkoutMetadata ===
      "object" &&
    !Array.isArray(
      checkoutMetadata
    )
      ? (checkoutMetadata as Record<
          string,
          unknown
        >)
      : {};

  const cryptoDestination =
    customer.cryptoDestination ??
    (
      metadataRecord
        .cryptoDestination as
        | Record<string, unknown>
        | undefined
    ) ??
    (
      metadataRecord
        .crypto_destination as
        | Record<string, unknown>
        | undefined
    ) ??
    (
      metadataRecord.destination as
        | Record<string, unknown>
        | undefined
    );

  if (cryptoDestination) {
    const destinationAddress =
      typeof cryptoDestination.address ===
      "string"
        ? cryptoDestination.address.trim()
        : undefined;

    if (
      cryptoDestination.address !==
        undefined &&
      !destinationAddress
    ) {
      throw new Error(
        "Crypto destination address is required."
      );
    }
  }

  const existingTransaction =
    paymentIntent.transactions.find(
      transaction =>
        transaction.status ===
        "INITIATED"
    );

  const transaction =
    existingTransaction ??
    await this.paymentService.createTransaction(
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
    );

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
    await this.paymentService.createPaymentAttempt(
      {
        paymentIntentId:
          paymentIntent.id,

        transactionId:
          transaction.id,

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency,
      }
    );

  /*
   * IMPORTANT:
   *
   * This customer checkout is explicitly
   * Flutterwave-only.
   *
   * Do not use generic provider failover here.
   */
  const flutterwaveProviders =
    (
      await this.gatewayService.activeProviders()
    )
      .filter(
        provider =>
          provider.isActive &&
          provider.name.toLowerCase() ===
            "flutterwave"
      )
      .sort(
        (a, b) =>
          a.priority - b.priority
      );

  if (
    flutterwaveProviders.length === 0
  ) {
    throw new Error(
      "Flutterwave is not configured as an active payment provider."
    );
  }

  const selectedProvider =
    flutterwaveProviders[0];

  const provider =
    this.providerManager.getProvider(
      "flutterwave"
    );

  if (!transaction.reference) {
    throw new Error(
      "Transaction reference is missing."
    );
  }

  /*
   * Build the URL Flutterwave should redirect
   * the customer to after checkout.
   *
   * This should point to the public SmartPOS
   * payment-result route.
   */
  const frontendBaseUrl =
    String(
      process.env.FRONTEND_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        ""
    ).replace(/\/+$/, "");

  if (!frontendBaseUrl) {
    throw new Error(
      "FRONTEND_URL or NEXT_PUBLIC_APP_URL is required for Flutterwave checkout redirects."
    );
  }

  const redirectUrl =
    `${frontendBaseUrl}/pay/${encodeURIComponent(
      paymentIntent.id
    )}/callback`;

  const providerMetadata: Record<
    string,
    unknown
  > = {
    paymentIntentId:
      paymentIntent.id,

    transactionId:
      transaction.id,

    paymentAttemptId:
      paymentAttempt.id,

    redirectUrl,

    provider:
      "flutterwave",

    cryptoDestination:
      cryptoDestination ?? null,
  };

  const gatewayRequest =
    await this.gatewayService.createGatewayRequest(
      {
        providerId:
          selectedProvider.id,

        transactionId:
          transaction.id,

        endpoint:
          selectedProvider.baseUrl ??
          "https://api.flutterwave.com/v3/payments",

        method:
          "POST",

        requestBody: {
          tx_ref:
            transaction.reference,

          amount:
            paymentIntent.amount.toString(),

          currency:
            String(
              paymentIntent.currency
            ),

          redirect_url:
            redirectUrl,

          customer: {
            email,
          },

          meta:
            providerMetadata,
        },

        requestHeaders: {},
      }
    );

  try {
    const providerResponse =
      await provider.createPayment(
        {
          amount:
            Number(
              paymentIntent.amount
            ),

          currency:
            String(
              paymentIntent.currency
            ),

          reference:
            transaction.reference,

          description:
            paymentIntent.description ??
            "SmartPOS Payment",

          customer: {
            email,

            firstName:
              customer.firstName ??
              paymentCustomer?.firstName ??
              undefined,

            lastName:
              customer.lastName ??
              paymentCustomer?.lastName ??
              undefined,

            phone:
              customer.phone ??
              paymentCustomer?.phone ??
              undefined,
          },

          metadata:
            providerMetadata,
        }
      );

    if (
      !providerResponse.success
    ) {
      throw new Error(
        providerResponse.message ??
          "Flutterwave payment creation failed."
      );
    }

    if (
      !providerResponse.paymentUrl
    ) {
      throw new Error(
        "Flutterwave did not return a hosted checkout URL."
      );
    }

    await this.app.prisma.transaction.update(
      {
        where: {
          id: transaction.id,
        },

        data: {
          gatewayTransactionId:
            providerResponse.transactionId ??
            providerResponse.reference ??
            null,

          gatewayProvider:
            "flutterwave",
        },
      }
    );

    await this.gatewayService.createGatewayResponse(
      {
        gatewayRequestId:
          gatewayRequest.id,

        statusCode:
          200,

        responseBody:
          providerResponse.raw ??
          {},

        responseHeaders:
          {},

        responseTime:
          0,
      }
    );

    return {
      paymentIntent,

      transaction,

      paymentAttempt,

      provider:
        "flutterwave",

      gateway: {
        transactionId:
          providerResponse.transactionId ??
          null,

        paymentUrl:
          providerResponse.paymentUrl ??
          null,

        accessCode:
          null,

        authorizationCode:
          null,
      },

      response:
        providerResponse,
    };
  } catch (error) {
    await this.gatewayService.createGatewayResponse(
      {
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
            : "Flutterwave payment failed",
      }
    );

    throw error;
  }
}

  /*
  |--------------------------------------------------------------------------
  | Payment Intent Authorizations
  |--------------------------------------------------------------------------
  */

  async getPaymentIntentAuthorizations(
    paymentIntentId: string,
    customerId?: string,
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found.",
      );
    }

    if (
      paymentIntent.status !==
      "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot accept saved authorizations.`,
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <=
        new Date()
    ) {
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id,
      );

      throw new Error(
        "Payment Intent has expired.",
      );
    }

    if (
      customerId &&
      paymentIntent.customerId &&
      paymentIntent.customerId !==
        customerId
    ) {
      throw new Error(
        "This payment intent does not belong to the current customer.",
      );
    }

    const authorizations =
      await this.paymentService.listAuthorizationsForPaymentIntent(
        paymentIntent.id,
        customerId,
      );

    return {
      paymentIntent,

      authorizations,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Saved Authorization Charge
  |--------------------------------------------------------------------------
  */

  async chargeSavedAuthorization(
    paymentIntentId: string,
    customerId: string | undefined,
    authorizationId: string,
    payload?: {
      idempotencyKey?: string;
      metadata?: Prisma.JsonValue;
    },
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found.",
      );
    }

    if (
      paymentIntent.status !==
      "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot be paid.`,
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <=
        new Date()
    ) {
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id,
      );

      throw new Error(
        "Payment Intent has expired.",
      );
    }

    if (
      customerId &&
      paymentIntent.customerId &&
      paymentIntent.customerId !==
        customerId
    ) {
      throw new Error(
        "This payment intent does not belong to the current customer.",
      );
    }

    const authorization =
      await this.paymentService.getAuthorizationForPaymentIntent(
        paymentIntent.id,
        customerId,
        authorizationId,
      );

    if (!authorization) {
      throw new Error(
        "No reusable payment authorization is available for this customer.",
      );
    }

    if (
      !authorization.authorizationCode
    ) {
      throw new Error(
        "Saved payment authorization does not contain a valid authorization code.",
      );
    }

    const requestKey =
      payload?.idempotencyKey ??
      `saved-auth:${paymentIntent.id}:${authorization.id}`;

    const existingTransaction =
      await this.app.prisma.transaction.findUnique({
        where: {
          idempotencyKey:
            requestKey,
        },
      });

    if (existingTransaction) {
      return {
        paymentIntent,

        transaction:
          existingTransaction,

        authorization,

        duplicate:
          true,
      };
    }

    const providers =
      await this.gatewayService.activeProviders();

    const activeProviders =
      providers
        .filter(
          provider =>
            provider.isActive,
        )
        .sort(
          (a, b) =>
            a.priority -
            b.priority,
        );

    const providerNames =
      activeProviders.map(
        provider =>
          provider.name,
      );

    if (!providerNames.length) {
      throw new Error(
        "No active payment provider configured.",
      );
    }

    const selectedProvider =
      this.selector.select(
        activeProviders,
        {
          merchantId:
            paymentIntent.merchantId,

          currency:
            String(
              paymentIntent.currency,
            ),

          amount:
            Number(
              paymentIntent.amount,
            ),

          paymentMethod:
            "card",
        },
      );

    const provider =
      this.providerManager.getProvider(
        selectedProvider.name,
      );

    const customer =
      paymentIntent.customerId
        ? await this.app.prisma.customer.findUnique({
            where: {
              id:
                paymentIntent.customerId,
            },
          })
        : null;

    const email =
      customer?.email ??
      undefined;

    if (!email) {
      throw new Error(
        "Customer email is required to charge a saved payment authorization.",
      );
    }

    const transaction =
      await this.paymentService.createTransaction({
        merchantId:
          paymentIntent.merchantId,

        customerId:
          paymentIntent.customerId ??
          customerId,

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

        idempotencyKey:
          requestKey,

        metadata:
          payload?.metadata ??
          paymentIntent.metadata,
      });

    const paymentAttempt =
      await this.paymentService.createPaymentAttempt({
        paymentIntentId:
          paymentIntent.id,

        transactionId:
          transaction.id,

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency,
      });

    const providerExecution =
      await this.failover.execute(
        [selectedProvider.name],

        async () =>
          provider.chargeWithAuthorization({
            amount:
              this.numericAmount(
                paymentIntent.amount,
              ),

            currency:
              String(
                paymentIntent.currency,
              ),

            email,

            authorizationCode:
              authorization.authorizationCode!,

            reference:
              transaction.reference!,

            description:
              paymentIntent.description ??
              undefined,

            metadata: {
              paymentIntentId:
                paymentIntent.id,

              transactionId:
                transaction.id,

              paymentAttemptId:
                paymentAttempt.id,

              authorizationId:
                authorization.id,
            },
          }),
      );

    const response =
      providerExecution.result;

    await this.app.prisma.transaction.update({
      where: {
        id:
          transaction.id,
      },

      data: {
        gatewayTransactionId:
          response.transactionId ??
          response.reference ??
          null,

        gatewayProvider:
          providerExecution.providerName,

        authCode:
          response.authorizationCode ??
          authorization.authorizationCode ??
          null,

        approvalCode:
          response.authorizationCode ??
          authorization.authorizationCode ??
          null,
      },
    });

    if (
      response.authorizationCode ||
      authorization.authorizationCode
    ) {
      await this.paymentService.authorizeTransaction({
        transactionId:
          transaction.id,

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency,

        authorizationCode:
          response.authorizationCode ??
          authorization.authorizationCode ??
          undefined,

        gatewayResponse:
          (
            response.raw ??
            response
          ) as Prisma.JsonValue,

        message:
          "Saved customer authorization charged successfully.",
      });
    }

    await this.paymentService.completePaymentAttempt(
      paymentAttempt.id,

      (
        response.raw ??
        response
      ) as Prisma.JsonValue,
    );

    return {
      paymentIntent,

      transaction,

      paymentAttempt,

      authorization,

      provider:
        providerExecution.providerName,

      gateway: {
        transactionId:
          response.transactionId ??
          response.reference ??
          null,

        paymentUrl:
          response.paymentUrl ??
          null,

        accessCode:
          response.accessCode ??
          null,

        authorizationCode:
          response.authorizationCode ??
          authorization.authorizationCode ??
          null,
      },

      response,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Saved Customer Payment Methods
  |--------------------------------------------------------------------------
  */

  async listCustomerPaymentMethods(
    paymentIntentId: string,
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found.",
      );
    }

    if (
      paymentIntent.status !==
      "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot accept saved payment methods.`,
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <=
        new Date()
    ) {
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id,
      );

      throw new Error(
        "Payment Intent has expired.",
      );
    }

    const authorizations =
      await this.paymentService.listAuthorizationsForPaymentIntent(
        paymentIntent.id,
        paymentIntent.customerId ??
          undefined,
      );

    return authorizations.map(
      authorization => ({
        id:
          authorization.id,

        type:
          "card",

        label:
          "Saved card",

        brand:
          null,

        last4:
          null,

        isReusable:
          true,

        status:
          authorization.status,

        createdAt:
          authorization.createdAt,
      }),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Customer Payment Method Charge
  |--------------------------------------------------------------------------
  */

  async chargeCustomerPaymentMethod(
    paymentMethodId: string,
    paymentIntentId: string,
    payload?: {
      idempotencyKey?: string;
      metadata?: Prisma.JsonValue;
    },
  ) {
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        "Payment Intent not found.",
      );
    }

    if (
      paymentIntent.status !==
      "PENDING"
    ) {
      throw new Error(
        `Payment Intent is ${paymentIntent.status.toLowerCase()} and cannot be paid.`,
      );
    }

    if (
      paymentIntent.expiresAt &&
      paymentIntent.expiresAt <=
        new Date()
    ) {
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id,
      );

      throw new Error(
        "Payment Intent has expired.",
      );
    }

    const authorization =
      await this.paymentService.getAuthorizationForPaymentIntent(
        paymentIntent.id,
        paymentIntent.customerId ??
          undefined,
        paymentMethodId,
      );

    if (!authorization) {
      throw new Error(
        "No reusable payment method is available for this customer.",
      );
    }

    return this.chargeSavedAuthorization(
      paymentIntent.id,

      paymentIntent.customerId ??
        undefined,

      authorization.id,

      payload,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Direct Payment Creation
  |--------------------------------------------------------------------------
  */

  async createPayment(data: {
    merchantId: string;

    customerId?: string;

    paymentMethodId?: string;

    paymentProviderAccountId?: string;

    amount: MoneyInput;

    currency: any;

    paymentMethod?: string;

    description?: string;

    idempotencyKey?: string;

    metadata?: PaymentMetadata;
  }) {
    const accountId =
      data.paymentProviderAccountId;

    if (!accountId) {
      throw new Error(
        "Payment account is required.",
      );
    }

    const selectedAccount =
      await this.app.prisma.paymentProviderAccount.findUnique({
        where: {
          id:
            accountId,
        },
      });

    if (!selectedAccount) {
      throw new Error(
        "Payment account is not available for this merchant.",
      );
    }

    if (
      selectedAccount.deletedAt
    ) {
      throw new Error(
        "Payment account is not available for this merchant.",
      );
    }

    if (
      selectedAccount.merchantId &&
      selectedAccount.merchantId !==
        data.merchantId
    ) {
      this.app.log.warn(
        {
          accountId,

          requestMerchantId:
            data.merchantId,

          accountMerchantId:
            selectedAccount.merchantId,
        },

        "Payment provider account does not belong to authenticated merchant",
      );

      throw new Error(
        "Payment account is not available for this merchant.",
      );
    }

    if (
      selectedAccount.status !==
      "ACTIVE"
    ) {
      throw new Error(
        `Payment account is ${String(
          selectedAccount.status,
        ).toLowerCase()}. Payment cannot proceed.`,
      );
    }

    const providerName =
      String(
        selectedAccount.provider,
      )
        .trim()
        .toLowerCase();

    if (!providerName) {
      throw new Error(
        "Payment provider is not configured for the selected payment account.",
      );
    }

    let providerToUse: any;

    try {
      const credentials =
        await this.paymentProviderAccountService.resolveCredentials(
          accountId,
        );

      if (
        !credentials?.secretKey
      ) {
        throw new Error(
          "Provider secret key is missing.",
        );
      }

      /*
       * ProviderFactory is responsible for
       * instantiating Flutterwave/other fiat
       * providers with the account credentials.
       *
       * The secret key never leaves the backend.
       */
      providerToUse =
        ProviderFactory.createWithSecret(
          providerName,
          {
            secretKey:
              credentials.secretKey,
          },
        );
    } catch (error) {
      this.app.log.error(
        {
          error,
          accountId,

          provider:
            providerName,
        },

        "Failed to resolve credentials for payment provider account",
      );

      throw new Error(
        "Selected fiat payment provider credentials are not configured. Payment cannot proceed.",
      );
    }

    const amount =
      this.decimal(
        data.amount,
      );

    this.numericAmount(
      amount,
    );

    const paymentIntent =
      await this.paymentService.createPaymentIntent({
        merchantId:
          data.merchantId,

        customerId:
          data.customerId,

        paymentMethodId:
          data.paymentMethodId,

        paymentProviderAccountId:
          accountId,

        amount,

        currency:
          data.currency,

        description:
          data.description,

        metadata:
          data.metadata,
      });

    const paymentCustomer =
      paymentIntent.customerId
        ? await this.app.prisma.customer.findUnique({
            where: {
              id:
                paymentIntent.customerId,
            },
          })
        : null;

    const execution =
      await this.failover.execute(
        [providerName],

        async () =>
          providerToUse.createPayment({
            amount:
              this.numericAmount(
                amount,
              ),

            currency:
              String(
                data.currency,
              ),

            reference:
              data.idempotencyKey ??
              `pi:${paymentIntent.id}`,

            description:
              data.description ??
              undefined,

            customer: {
              email:
                paymentCustomer?.email ??
                "customer@example.com",

              firstName:
                paymentCustomer?.firstName ??
                undefined,

              lastName:
                paymentCustomer?.lastName ??
                undefined,

              phone:
                paymentCustomer?.phone ??
                undefined,
            },

            metadata:
              this.normalizeProviderMetadata(
                data.metadata,
              ),
          }),
      );

    /*
     * Return the actual provider response,
     * not the internal failover wrapper.
     */
    return {
      ...execution.result,

      provider:
        execution.providerName,
    };
  }
}