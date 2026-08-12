import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import PaymentService from "./payment.service.js";
import GatewayService from "./gateway.service.js";

import ProviderManager from "../providers/provider.manager.js";
import SmartGatewaySelector from "../providers/smart-gateway-selector.js";
import ProviderFailover from "../providers/provider-failover.js";
import ProviderMetricsService from "../providers/provider-metrics.service.js";

export default class PaymentOrchestratorService {

  private readonly paymentService: PaymentService;

  private readonly gatewayService: GatewayService;

  private readonly providerManager = new ProviderManager();

  private readonly selector = new SmartGatewaySelector();

  private readonly failover = new ProviderFailover();

  private readonly metrics =
    new ProviderMetricsService();

  constructor(
    private readonly app: FastifyInstance
  ) {

    this.paymentService =
      new PaymentService(app);

    this.gatewayService =
      new GatewayService(app);

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

        metadata:
          paymentIntent.metadata
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
            execution.providerName
        }
      });

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
