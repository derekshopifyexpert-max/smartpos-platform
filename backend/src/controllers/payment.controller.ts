import { Prisma } from "@prisma/client";
import {
  FastifyReply,
  FastifyRequest
} from "fastify";

import PaymentService from "../services/payment.service.js";
import PaymentOrchestratorService from "../services/payment-orchestrator.service.js";

export default class PaymentController {

  constructor(
    private readonly paymentService: PaymentService,
private readonly paymentOrchestratorService: PaymentOrchestratorService
  ) {}

createPayment = async (
request: FastifyRequest,
reply: FastifyReply
) => {

const body = request.body as any;

const payment =
await this.paymentOrchestratorService.createPayment({
  ...body,
  paymentProviderAccountId: body.paymentProviderAccountId
});

return reply.code(201).send({
success: true,
message: "Payment Created",
data: payment
});

};

  createPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const body = request.body as any;
    // Force payment intents to NGN so Paystack (configured for NGN) can process them.
    body.currency = 'NGN';

    const payment =
      await this.paymentService.createPaymentIntent(
        body
      );

    return reply.code(201).send({
      success: true,
      message: "Payment Intent Created",
      data: payment
    });
  };

  listPaymentIntents = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const {
      page = 1,
      limit = 10
    } = request.query as {
      page?: number;
      limit?: number;
    };

    const result =
      await this.paymentService.listPaymentIntents(
        Number(page),
        Number(limit)
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  getPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { id } =
      request.params as {
        id: string;
      };

    const payment =
      await this.paymentService.getPaymentIntent(id);

    if (!payment) {
      return reply.code(404).send({
        success: false,
        message: "Payment Intent not found."
      });
    }

    return reply.send({
      success: true,
      data: payment
    });
  };

  getPaymentIntentAuthorizations = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };

    const payment =
      await this.paymentService.getPaymentIntent(id);

    if (!payment) {
      return reply.code(404).send({
        success: false,
        message: "Payment Intent not found."
      });
    }

    const result =
      await this.paymentOrchestratorService.getPaymentIntentAuthorizations(
        id,
        payment.customerId ?? undefined
      );

    return reply.send({
      success: true,
      data: {
        paymentIntent: result.paymentIntent,
        authorizations: result.authorizations
      }
    });
  };

  listCustomerPaymentMethods = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const query = request.query as {
      paymentIntentId?: string;
    };

    if (!query.paymentIntentId) {
      return reply.code(400).send({
        success: false,
        message: "A valid payment intent is required to load saved payment methods."
      });
    }

    const methods =
      await this.paymentOrchestratorService.listCustomerPaymentMethods(query.paymentIntentId);

    return reply.send({
      success: true,
      data: methods
    });
  };

  chargeSavedAuthorization = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id, authorizationId } = request.params as {
      id: string;
      authorizationId: string;
    };

    const payment =
      await this.paymentService.getPaymentIntent(id);

    if (!payment) {
      return reply.code(404).send({
        success: false,
        message: "Payment Intent not found."
      });
    }

    const body = request.body as {
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    };

    try {
      const result =
        await this.paymentOrchestratorService.chargeSavedAuthorization(
          id,
          payment.customerId ?? undefined,
          authorizationId,
          {
            idempotencyKey: body?.idempotencyKey,
            metadata: (body?.metadata ?? undefined) as Prisma.JsonValue | undefined
          }
        );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Saved authorization payment failed.";

      const statusCode =
        message.includes("not found") ||
        message.includes("Payment Intent") ||
        message.includes("No reusable")
          ? 404
          : message.includes("expired") ||
            message.includes("cannot be paid")
            ? 409
            : message.includes("customer")
              ? 403
              : 400;

      return reply.code(statusCode).send({
        success: false,
        message
      });
    }
  };

  chargeCustomerPaymentMethod = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      paymentIntentId: string;
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body?.paymentIntentId) {
      return reply.code(400).send({
        success: false,
        message: "A valid payment intent is required to charge this payment method."
      });
    }

    try {
      const result =
        await this.paymentOrchestratorService.chargeCustomerPaymentMethod(
          id,
          body.paymentIntentId,
          {
            idempotencyKey: body?.idempotencyKey,
            metadata: (body?.metadata ?? undefined) as Prisma.JsonValue | undefined
          }
        );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Saved payment method charge failed.";

      const statusCode =
        message.includes("not found") ||
        message.includes("Payment Intent") ||
        message.includes("No reusable")
          ? 404
          : message.includes("expired") ||
            message.includes("cannot be paid")
            ? 409
            : message.includes("customer")
              ? 403
              : 400;

      return reply.code(statusCode).send({
        success: false,
        message
      });
    }
  };

  checkoutPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { id } =
      request.params as {
        id: string;
      };

    const customer =
      request.body as {
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
      };

    try {
      const result =
        await this.paymentOrchestratorService.checkoutPaymentIntent(
          id,
          customer
        );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      // Surface provider/checkout errors cleanly to the frontend
      const anyErr = error as any;

      const providerMessage =
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        "Payment provider error.";

      const statusCode =
        anyErr?.response?.status || 502;

      return reply.code(statusCode).send({
        success: false,
        message: `Payment gateway error: ${String(providerMessage)}`
      });
    }
  };

  processCryptoSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };

    const payload = request.body as {
      transactionId?: string;
      asset?: string;
      network?: string;
      destinationAddress?: string;
      walletId?: string;
    };

    try {
      const result = await this.paymentOrchestratorService.processFiatToCryptoSettlement(
        id,
        payload
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Crypto settlement failed.";
      return reply.code(400).send({ success: false, message });
    }
  };

  expirePaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { id } =
      request.params as {
        id: string;
      };

    const payment =
      await this.paymentService.expirePaymentIntent(id);

    return reply.send({
      success: true,
      data: payment
    });
  };

}
