import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import PaymentService from "./payment.service.js";
import GatewayService from "./gateway.service.js";
import ExchangeService from "./exchange.service.js";
import BlockchainService from "./blockchain.service.js";

import ProviderManager from "../providers/provider.manager.js";
import SmartGatewaySelector from "../providers/smart-gateway-selector.js";
import ProviderFailover from "../providers/provider-failover.js";
import ProviderMetricsService from "../providers/provider-metrics.service.js";
import {
  NotConfiguredCryptoTransferProvider,
  type CryptoTransferProvider,
} from "../providers/crypto-transfer.provider.js";

export default class PaymentOrchestratorService {

  private readonly paymentService: PaymentService;

  private readonly gatewayService: GatewayService;

  private readonly providerManager = new ProviderManager();

  private readonly selector = new SmartGatewaySelector();

  private readonly failover = new ProviderFailover();

  private readonly metrics =
    new ProviderMetricsService();

  private readonly exchangeService: ExchangeService;

  private readonly blockchainService: BlockchainService;

  private readonly cryptoTransferProvider: CryptoTransferProvider;

  constructor(
    private readonly app: FastifyInstance
  ) {

    this.paymentService =
      new PaymentService(app);

    this.gatewayService =
      new GatewayService(app);
    this.exchangeService =
      new ExchangeService(app);
    this.blockchainService =
      new BlockchainService(app);
    this.cryptoTransferProvider =
      new NotConfiguredCryptoTransferProvider();

  }

  normalizeCryptoDestinationMetadata(
    metadata?: Prisma.JsonValue | Record<string, unknown>
  ): Record<string, unknown> {
    const source =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    const normalized: Record<string, unknown> = { ...source };

    const destinationCandidates = [
      normalized.cryptoDestination,
      normalized.crypto_destination,
      normalized.destination,
    ];

    const resolvedDestination = destinationCandidates.find(
      (candidate): candidate is Record<string, unknown> =>
        candidate !== undefined && typeof candidate === "object" && !Array.isArray(candidate)
    );

    if (resolvedDestination) {
      normalized.cryptoDestination = {
        ...resolvedDestination,
      };
    }

    return normalized;
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
    const paymentIntent =
      await this.paymentService.getPaymentIntent(
        paymentIntentId
      );

    if (!paymentIntent) {
      throw new Error("Payment Intent not found.");
    }

    const metadata =
      this.normalizeCryptoDestinationMetadata(
        paymentIntent.metadata
      );

    const destination =
      (metadata.cryptoDestination as Record<string, unknown> | undefined) ??
      { };

    const asset =
      String(
        payload.asset ??
          destination.asset ??
          "USDT"
      ).toUpperCase();

    const network =
      String(
        payload.network ??
          destination.network ??
          "TRON"
      ).toUpperCase();

    const destinationAddress =
      payload.destinationAddress ??
      (typeof destination.address === "string"
        ? destination.address
        : "");

    if (!destinationAddress.trim()) {
      throw new Error("Crypto destination address is required.");
    }

    const transaction =
      payload.transactionId
        ? await this.paymentService.findTransactionById(
            payload.transactionId
          )
        : paymentIntent.transactions.find(
            (item) =>
              item.status === "CAPTURED" ||
              item.status === "AUTHORIZED" ||
              item.status === "SETTLED"
          );

    if (!transaction) {
      throw new Error("Verified payment transaction is required before crypto settlement.");
    }

    const quote = await this.exchangeService.calculateQuote(
      paymentIntent.currency as any,
      asset as any,
      new Prisma.Decimal(Number(paymentIntent.amount))
    );

    const conversion = await this.exchangeService.createConversion({
      merchantId: paymentIntent.merchantId,
      transactionId: transaction.id,
      fromCurrency: paymentIntent.currency as any,
      toCurrency: asset as any,
      fromAmount: new Prisma.Decimal(Number(paymentIntent.amount)),
      exchangeProvider: "smartpos",
      metadata: {
        paymentIntentId: paymentIntent.id,
        destinationAddress,
        network,
        asset,
        quote,
      },
    });

    const addressValid = await this.cryptoTransferProvider.validateAddress({
      asset,
      network,
      address: destinationAddress,
    });

    if (!addressValid) {
      return {
        paymentIntent,
        transaction,
        quote,
        conversion,
        settlement: {
          status: "FAILED",
          message: `The destination wallet for ${asset} on ${network} is invalid or unavailable.`,
        },
      };
    }

    const settlementResult = await this.cryptoTransferProvider.sendTransaction({
      asset,
      network,
      toAddress: destinationAddress,
      amount: quote.convertedAmount,
      reference: transaction.reference ?? paymentIntent.id,
    });

    await this.app.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        cryptoCurrency: asset as any,
        cryptoAmount: new Prisma.Decimal(quote.convertedAmount.toString()),
        metadata: {
          ...(transaction.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
            ? transaction.metadata
            : {}),
          cryptoSettlement: {
            asset,
            network,
            destinationAddress,
            status: settlementResult.status,
            quote,
            conversionId: conversion.id,
          },
        },
      },
    });

    return {
      paymentIntent,
      transaction,
      quote,
      conversion,
      settlement: { ...settlementResult },
    };
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
      paymentIntent.expiresAt <= new Date()
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

    const cryptoDestination = this.normalizeCryptoDestinationMetadata(
      paymentIntent.metadata
    ).cryptoDestination as Record<string, unknown> | undefined;

    if (cryptoDestination && typeof cryptoDestination === "object") {
      const destinationAddress = typeof cryptoDestination.address === "string"
        ? cryptoDestination.address
        : undefined;

      if (destinationAddress && !destinationAddress.trim()) {
        throw new Error("Crypto destination address is required.");
      }
    }

    const existingTransaction =
      paymentIntent.transactions.find(
        transaction =>
          transaction.status === "INITIATED"
      );

    const transaction =
      existingTransaction ??
      await this.paymentService.createTransaction({
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

        metadata: this.normalizeCryptoDestinationMetadata(
          paymentIntent.metadata
        )
      });

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

    try {
      const execution =
        await this.failover.execute(
          providerNames,
          async provider =>
            provider.createPayment({
              amount:
                Number(
                  paymentIntent.amount
                ),

              currency:
                String(
                  paymentIntent.currency
                ),

              reference:
                transaction.reference!,

              description:
                paymentIntent.description ??
                undefined,

              customer: {
                email,

                firstName:
                  customer.firstName ??
                  paymentIntent.customer?.firstName ??
                  undefined,

                lastName:
                  customer.lastName ??
                  paymentIntent.customer?.lastName ??
                  undefined,

                phone:
                  customer.phone ??
                  paymentIntent.customer?.phone ??
                  undefined
              },

              metadata: {
                paymentIntentId:
                  paymentIntent.id,

                transactionId:
                  transaction.id,

                paymentAttemptId:
                  paymentAttempt.id
              }
            })
        );

      const providerResponse =
        execution.result;

      const authorizationCode =
        providerResponse.authorizationCode ??
        null;

      await this.app.prisma.transaction.update({
        where: {
          id: transaction.id
        },

        data: {
          gatewayTransactionId:
            providerResponse.transactionId ??
            providerResponse.reference ??
            null,

          gatewayProvider:
            execution.providerName,

          authCode:
            authorizationCode,

          approvalCode:
            authorizationCode
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
          providerResponse.raw ??
          {},

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
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id
      );
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
      await this.paymentService.expirePaymentIntent(
        paymentIntent.id
      );
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

    const selectedProvider =
      this.selector.select(
        providers,
        {
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
            email:
              paymentIntent.customer?.email ??
              customerId ??
              "customer@example.com",
            authorizationCode:
              authorization.authorizationCode ??
              "",
            reference: transaction.reference!,
            description:
              paymentIntent.description ??
              undefined,
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
          response.authorizationCode ??
          authorization.authorizationCode ??
          null
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

    amount: Prisma.Decimal;

    currency: any;

    paymentMethod: string;

    description?: string;

    idempotencyKey?: string;

    metadata?: Prisma.JsonValue;

  }) {

    const paymentIntent =
      await this.paymentService.createPaymentIntent({

        merchantId: data.merchantId,

        customerId: data.customerId,

        paymentMethodId: data.paymentMethodId,

        amount: data.amount,

        currency: data.currency,

        description: data.description,

        metadata: data.metadata

      });

    const providers =
      await this.gatewayService.activeProviders();

    const providerNames =
      providers
        .filter(provider => provider.isActive)
        .sort((a, b) => a.priority - b.priority)
        .map(provider => provider.name);

    const providerRecord =
      this.selector.select(providers, {

        merchantId: data.merchantId,

        currency: String(data.currency),

        amount: Number(data.amount),

        paymentMethod: data.paymentMethod

      });

    const provider =
      this.providerManager.getProvider(

        providerRecord.name

      );

    const transaction =
      await this.paymentService.createTransaction({

        idempotencyKey: data.idempotencyKey,

        merchantId: data.merchantId,

        customerId: data.customerId,

        amount: data.amount,

        currency: data.currency,

        paymentMethod: data.paymentMethod,

        type: "payment",

        description: data.description,

        paymentIntentId: paymentIntent.id,

        metadata: data.metadata

      });

    const gatewayRequest =
      await this.gatewayService.createGatewayRequest({

        providerId: providerRecord.id,

        transactionId: transaction.id,

        endpoint: "/payment",

        method: "POST",

        requestBody: (data.metadata ?? {}) as Prisma.JsonValue,

        requestHeaders: {} as Prisma.JsonValue

      });
  try {

    const started =
      Date.now();

    const execution =
      await this.failover.execute(

        providerNames,

        async provider =>
          provider.createPayment({

            amount:
              Number(data.amount),

            currency:
              String(data.currency),

            description:
              data.description,

            reference:
              transaction.reference ??
              transaction.id,

            metadata:
              data.metadata as any

          })

      );

    const providerResponse =
      execution.result;

    this.metrics.record(

      execution.providerName,

      true,

      Date.now() - started

    );

    await this.gatewayService.createGatewayResponse({

      gatewayRequestId:
        gatewayRequest.id,

      statusCode:
        200,

      responseBody:
        providerResponse.raw,

      responseHeaders:
        {} as Prisma.JsonValue

    });

    return {

      paymentIntent,

      transaction,

      provider:
        providerResponse.reference,

      response:
        providerResponse

    };

  } catch (error) {

      this.metrics.record(

        providerRecord.name,

        false,

        0

      );

      await this.gatewayService.createGatewayResponse({

        gatewayRequestId:
          gatewayRequest.id,

        statusCode: 500,

        responseBody:
          {} as Prisma.JsonValue,

        responseHeaders:
          {} as Prisma.JsonValue,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error"

      });

      throw error;

    }

  }

}
