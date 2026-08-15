import Stripe from "stripe";

import BaseProvider, {
  CreatePaymentInput,
  RefundPaymentInput,
  VerifyPaymentInput,
  ProviderResponse,
} from "./base.provider.js";

export default class StripeProvider extends BaseProvider {
  readonly name = "stripe";

  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    super();

    this.stripe = new Stripe(secretKey, {
      apiVersion: "2026-07-29.dahlia",
    });
  }

  async createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toLowerCase(),
      description: input.description,
      metadata: {
        reference: input.reference,
        ...(input.metadata ?? {}),
      },
    });

    return {
      success: true,
      message: "Payment Intent created.",
      reference: input.reference,
      transactionId: intent.id,
      raw: intent,
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse> {
    const paymentIntent =
      await this.stripe.paymentIntents.retrieve(
        input.transactionId
      );

    return {
      success: paymentIntent.status === "succeeded",
      message: paymentIntent.status,
      transactionId: paymentIntent.id,
      raw: paymentIntent,
    };
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse> {
    const refund = await this.stripe.refunds.create({
      payment_intent: input.transactionId,
      amount: input.amount
        ? Math.round(input.amount * 100)
        : undefined,
    });

    return {
      success: true,
      message: "Refund created.",
      transactionId: refund.id,
      raw: refund,
    };
  }

  async chargeWithAuthorization(
    input: {
      amount: number;
      currency: string;
      email: string;
      authorizationCode: string;
      reference: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ProviderResponse> {
    throw new Error(
      "Stripe authorization charging is not supported in this backend integration."
    );
  }

  async validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean> {
    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      return true;
    } catch {
      return false;
    }
  }
}