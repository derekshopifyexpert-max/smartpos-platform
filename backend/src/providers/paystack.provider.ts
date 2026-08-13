import axios, {
  AxiosInstance
} from "axios";

import BaseProvider, {
  ChargeAuthorizationInput,
  CreatePaymentInput,
  RefundPaymentInput,
  VerifyPaymentInput,
  ProviderResponse
} from "./base.provider.js";

export default class PaystackProvider extends BaseProvider {
  readonly name = "paystack";

  private readonly client: AxiosInstance;
  private readonly secretKey: string;

  constructor(secretKey: string) {
    super();

    if (!secretKey) {
      throw new Error(
        "PAYSTACK_SECRET_KEY is required."
      );
    }

    this.secretKey = secretKey;

    this.client = axios.create({
      baseURL: "https://api.paystack.co",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
  }

  async createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse> {
    if (!input.customer?.email) {
      throw new Error(
        "Customer email is required for Paystack payment initialization."
      );
    }

    const amount = Math.round(
      input.amount * 100
    );

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Payment amount must be greater than zero."
      );
    }

    const response =
      await this.client.post(
        "/transaction/initialize",
        {
          amount: String(amount),

          email:
            input.customer.email,

          currency:
            input.currency.toUpperCase(),

          reference:
            input.reference,

          description:
            input.description,

          channels: [
            "card"
          ],

          metadata:
            JSON.stringify(
              input.metadata ?? {}
            )
        }
      );

    const data =
      response.data?.data;

    if (
      response.data?.status !== true ||
      !data?.authorization_url ||
      !data?.reference
    ) {
      throw new Error(
        response.data?.message ??
        "Paystack failed to initialize the transaction."
      );
    }

    return {
      success: true,

      message:
        response.data.message ??
        "Authorization URL created",

      reference:
        data.reference,

      transactionId:
        data.reference,

      paymentUrl:
        data.authorization_url,

      accessCode:
        data.access_code,

      raw:
        response.data
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse> {
    const response =
      await this.client.get(
        `/transaction/verify/${encodeURIComponent(
          input.transactionId
        )}`
      );

    const data =
      response.data?.data;

    const success =
      response.data?.status === true &&
      data?.status === "success";

    return {
      success,

      message:
        data?.gateway_response ??
        response.data?.message ??
        "Payment verification completed.",

      reference:
        data?.reference ??
        input.transactionId,

      transactionId:
        String(
          data?.id ??
          input.transactionId
        ),

      authorizationCode:
        data?.authorization
          ?.authorization_code,

      raw:
        response.data
    };
  }

  async chargeWithAuthorization(
    input: ChargeAuthorizationInput
  ): Promise<ProviderResponse> {
    const response =
      await this.client.post(
        "/transaction/charge_authorization",
        {
          authorization_code:
            input.authorizationCode,
          email:
            input.email,
          amount:
            Math.round(
              input.amount * 100
            ).toString(),
          currency:
            input.currency.toUpperCase(),
          reference:
            input.reference,
          description:
            input.description,
          metadata:
            JSON.stringify(
              input.metadata ?? {}
            )
        }
      );

    const data = response.data?.data;

    if (
      response.data?.status !== true ||
      !data?.reference
    ) {
      throw new Error(
        response.data?.message ??
        "Paystack authorization charge failed."
      );
    }

    return {
      success: true,
      message:
        response.data.message ??
        "Authorization charge completed",
      reference:
        data.reference,
      transactionId:
        data.reference,
      authorizationCode:
        data.authorization?.authorization_code ??
        input.authorizationCode,
      raw: response.data
    };
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse> {
    const payload: Record<
      string,
      unknown
    > = {
      transaction:
        input.transactionId
    };

    if (
      input.amount !== undefined
    ) {
      payload.amount =
        Math.round(
          input.amount * 100
        );
    }

    const response =
      await this.client.post(
        "/refund",
        payload
      );

    return {
      success:
        response.data?.status === true,

      message:
        response.data?.message ??
        "Refund request completed.",

      transactionId:
        response.data?.data?.id
          ?.toString(),

      raw:
        response.data
    };
  }

  async validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean> {
    const crypto =
      await import("crypto");

    const hash =
      crypto
        .createHmac(
          "sha512",
          this.secretKey
        )
        .update(
          JSON.stringify(payload)
        )
        .digest("hex");

    return hash === signature;
  }
}
