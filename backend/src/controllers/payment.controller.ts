import { Prisma } from "@prisma/client";
import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import PaymentService from "../services/payment.service.js";
import PaymentOrchestratorService from "../services/payment-orchestrator.service.js";

export default class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentOrchestratorService: PaymentOrchestratorService,
  ) {}

  /**
   * Create a SmartPOS payment.
   *
   * Flow:
   * HTTP request
   *   -> PaymentOrchestratorService
   *   -> selected fiat payment provider
   *   -> PaymentIntent / Transaction persistence
   */
  createPayment = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const body = request.body as {
      merchantId: string;
      customerId?: string;
      paymentMethodId?: string;
      paymentProviderAccountId?: string;
      amount: Prisma.Decimal | number | string;
      currency: string;
      description?: string;
      metadata?: Prisma.JsonValue;
      expiresAt?: Date | string;
      [key: string]: unknown;
    };

    try {
      const payment =
        await this.paymentOrchestratorService.createPayment({
          ...body,
          paymentProviderAccountId:
            body.paymentProviderAccountId,
        });

      return reply.code(201).send({
        success: true,
        message: "Payment Created",
        data: payment,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Payment creation failed.";

      request.log.error(
        {
          error,
        },
        "Failed to create payment",
      );

      return reply.code(400).send({
        success: false,
        message,
      });
    }
  };

  /**
   * Create a PaymentIntent.
   */
  createPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const body = request.body as {
      merchantId: string;
      customerId?: string;
      paymentMethodId?: string;
      paymentProviderAccountId?: string;
      amount: Prisma.Decimal | number | string;
      currency: string;
      description?: string;
      metadata?: Prisma.JsonValue;
      expiresAt?: Date | string;
      [key: string]: unknown;
    };

    try {
      const payment =
        await this.paymentService.createPaymentIntent(
          body as any,
        );

      return reply.code(201).send({
        success: true,
        message: "Payment Intent Created",
        data: payment,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Payment intent creation failed.";

      request.log.error(
        {
          error,
        },
        "Failed to create payment intent",
      );

      return reply.code(400).send({
        success: false,
        message,
      });
    }
  };

  /**
   * List PaymentIntents.
   */
  listPaymentIntents = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const {
      page = 1,
      limit = 10,
    } =
      request.query as {
        page?: number | string;
        limit?: number | string;
      };

    const result =
      await this.paymentService.listPaymentIntents(
        Number(page),
        Number(limit),
      );

    return reply.send({
      success: true,
      data: result,
    });
  };

  /**
   * Get one PaymentIntent.
   */
  getPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply,
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
        message: "Payment Intent not found.",
      });
    }

    return reply.send({
      success: true,
      data: payment,
    });
  };

  /**
   * Get authorizations belonging to a PaymentIntent.
   */
  getPaymentIntentAuthorizations = async (
    request: FastifyRequest,
    reply: FastifyReply,
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
        message: "Payment Intent not found.",
      });
    }

    const result =
      await this.paymentOrchestratorService.getPaymentIntentAuthorizations(
        id,
        payment.customerId ?? undefined,
      );

    return reply.send({
      success: true,
      data: {
        paymentIntent: result.paymentIntent,
        authorizations: result.authorizations,
      },
    });
  };

  /**
   * List reusable customer payment methods.
   */
  listCustomerPaymentMethods = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const query =
      request.query as {
        paymentIntentId?: string;
      };

    if (!query.paymentIntentId) {
      return reply.code(400).send({
        success: false,
        message:
          "A valid payment intent is required to load saved payment methods.",
      });
    }

    const methods =
      await this.paymentOrchestratorService.listCustomerPaymentMethods(
        query.paymentIntentId,
      );

    return reply.send({
      success: true,
      data: methods,
    });
  };

  /**
   * Charge a previously saved/reusable authorization.
   */
  chargeSavedAuthorization = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const {
      id,
      authorizationId,
    } =
      request.params as {
        id: string;
        authorizationId: string;
      };

    const payment =
      await this.paymentService.getPaymentIntent(id);

    if (!payment) {
      return reply.code(404).send({
        success: false,
        message: "Payment Intent not found.",
      });
    }

    const body =
      request.body as {
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
            idempotencyKey:
              body?.idempotencyKey,

            metadata:
              body?.metadata !== undefined
                ? (body.metadata as Prisma.JsonValue)
                : undefined,
          },
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handlePaymentError(
        request,
        reply,
        error,
        "Saved authorization payment failed.",
      );
    }
  };

  /**
   * Charge a customer's saved payment method.
   */
  chargeCustomerPaymentMethod = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const body =
      request.body as {
        paymentIntentId?: string;
        idempotencyKey?: string;
        metadata?: Record<string, unknown>;
      };

    if (!body?.paymentIntentId) {
      return reply.code(400).send({
        success: false,
        message:
          "A valid payment intent is required to charge this payment method.",
      });
    }

    try {
      const result =
        await this.paymentOrchestratorService.chargeCustomerPaymentMethod(
          id,
          body.paymentIntentId,
          {
            idempotencyKey:
              body.idempotencyKey,

            metadata:
              body.metadata !== undefined
                ? (body.metadata as Prisma.JsonValue)
                : undefined,
          },
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return this.handlePaymentError(
        request,
        reply,
        error,
        "Saved payment method charge failed.",
      );
    }
  };

  /**
   * Checkout a PaymentIntent.
   *
   * SmartPOS supports a crypto destination being attached to the
   * checkout request. The orchestrator remains responsible for the
   * actual fiat payment and subsequent settlement workflow.
   */
  checkoutPaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply,
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
          customer,
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const anyError =
        error as {
          response?: {
            status?: number;
            data?: {
              message?: string;
            };
          };
          message?: string;
        };

      const providerMessage =
        anyError?.response?.data?.message ||
        anyError?.message ||
        "Payment provider error.";

      const statusCode =
        anyError?.response?.status ||
        502;

      request.log.error(
        {
          error,
          paymentIntentId: id,
        },
        "Payment checkout failed",
      );

      return reply.code(statusCode).send({
        success: false,
        message:
          `Payment gateway error: ${String(providerMessage)}`,
      });
    }
  };

  /**
   * Process SmartPOS fiat -> crypto settlement.
   *
   * Important:
   * The fiat transaction must already be captured.
   * The orchestrator owns the actual settlement logic.
   */
  processCryptoSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const payload =
      request.body as {
        transactionId?: string;
        asset?: string;
        network?: string;
        destinationAddress?: string;
        walletId?: string;
      };

    try {
      const result =
        await this.paymentOrchestratorService.processFiatToCryptoSettlement(
          id,
          payload,
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Crypto settlement failed.";

      request.log.error(
        {
          error,
          paymentIntentId: id,
        },
        "Crypto settlement failed",
      );

      return reply.code(400).send({
        success: false,
        message,
      });
    }
  };

  /**
   * Expire a PaymentIntent.
   */
  expirePaymentIntent = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    try {
      const payment =
        await this.paymentService.expirePaymentIntent(id);

      return reply.send({
        success: true,
        data: payment,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to expire payment intent.";

      return reply.code(400).send({
        success: false,
        message,
      });
    }
  };

  /**
   * Centralized payment-controller error mapping.
   *
   * This keeps HTTP concerns here instead of putting them into
   * PaymentService or PaymentOrchestratorService.
   */
  private handlePaymentError(
    request: FastifyRequest,
    reply: FastifyReply,
    error: unknown,
    fallbackMessage: string,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : fallbackMessage;

    const lower =
      message.toLowerCase();

    request.log.error(
      {
        error,
      },
      fallbackMessage,
    );

    let statusCode = 400;

    if (
      lower.includes("not found") ||
      lower.includes("payment intent") &&
        lower.includes("not found") ||
      lower.includes("no reusable")
    ) {
      statusCode = 404;
    } else if (
      lower.includes("expired") ||
      lower.includes("cannot be paid") ||
      lower.includes("already captured") ||
      lower.includes("already completed")
    ) {
      statusCode = 409;
    } else if (
      lower.includes("customer") &&
      (
        lower.includes("unauthorized") ||
        lower.includes("does not belong") ||
        lower.includes("mismatch")
      )
    ) {
      statusCode = 403;
    } else if (
      lower.includes("provider") ||
      lower.includes("gateway") ||
      lower.includes("flutterwave")
    ) {
      statusCode = 502;
    }

    return reply.code(statusCode).send({
      success: false,
      message,
    });
  }
}