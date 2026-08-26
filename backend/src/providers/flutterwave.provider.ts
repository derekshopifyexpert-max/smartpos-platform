import axios, {
  AxiosError,
  AxiosInstance,
} from "axios";
import crypto from "node:crypto";

import BaseProvider, {
  ChargeAuthorizationInput,
  CreatePaymentInput,
  CreateWithdrawalInput,
  RefundPaymentInput,
  VerifyPaymentInput,
  VerifyWithdrawalInput,
  ProviderResponse,
} from "./base.provider.js";

export default class FlutterwaveProvider
  extends BaseProvider
{
  readonly name = "flutterwave";

  private readonly client: AxiosInstance;

  constructor(
    private readonly secretKey: string,
  ) {
    super();

    if (!secretKey?.trim()) {
      throw new Error(
        "Flutterwave secret key is required.",
      );
    }

    this.client = axios.create({
      baseURL:
        "https://api.flutterwave.com/v3",

      timeout: 30000,

      headers: {
        Authorization:
          `Bearer ${secretKey}`,

        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },
    });
  }

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<ProviderResponse> {
    if (!input.reference?.trim()) {
      throw new Error(
        "Flutterwave payment reference is required.",
      );
    }

    if (
      input.amount === undefined ||
      input.amount === null ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new Error(
        "Flutterwave payment amount must be greater than zero.",
      );
    }

    if (!input.currency?.trim()) {
      throw new Error(
        "Flutterwave payment currency is required.",
      );
    }

    if (!input.customer?.email?.trim()) {
      throw new Error(
        "Flutterwave customer email is required.",
      );
    }

    const metadata =
      input.metadata &&
      typeof input.metadata === "object"
        ? input.metadata
        : {};

    const redirectUrl =
      typeof metadata.redirectUrl === "string" &&
      metadata.redirectUrl.trim()
        ? metadata.redirectUrl.trim()
        : typeof metadata.redirect_url === "string" &&
            metadata.redirect_url.trim()
          ? metadata.redirect_url.trim()
          : undefined;

    const payload: Record<string, unknown> = {
      tx_ref:
        input.reference.trim(),

      amount:
        input.amount,

      currency:
        input.currency
          .trim()
          .toUpperCase(),

      customer: {
        email:
          input.customer.email.trim(),

        name:
          [
            input.customer.firstName,
            input.customer.lastName,
          ]
            .filter(Boolean)
            .join(" "),

        phonenumber:
          input.customer.phone,
      },

      customizations: {
        title:
          input.description?.trim() ||
          "SmartPOS Payment",
      },

      meta:
        metadata,
    };

    if (redirectUrl) {
      payload.redirect_url =
        redirectUrl;
    }

    try {
      const response =
        await this.client.post(
          "/payments",
          payload,
        );

      const responseData =
        response.data;

      const hostedLink =
        responseData?.data?.link;

      const transactionId =
        responseData?.data?.id;

      return {
        success:
          responseData?.status ===
          "success",

        message:
          responseData?.message ||
          "Flutterwave payment created.",

        reference:
          input.reference,

        paymentUrl:
          typeof hostedLink === "string"
            ? hostedLink
            : undefined,

        transactionId:
          transactionId !== undefined &&
          transactionId !== null
            ? String(transactionId)
            : undefined,

        raw:
          responseData,
      };
    } catch (error) {
      throw this.createProviderError(
        "Failed to create Flutterwave payment.",
        error,
      );
    }
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<ProviderResponse> {
    if (!input.transactionId?.trim()) {
      throw new Error(
        "Flutterwave transaction ID is required for verification.",
      );
    }

    try {
      const response =
        await this.client.get(
          `/transactions/${encodeURIComponent(
            input.transactionId,
          )}/verify`,
        );

      const responseData =
        response.data;

      const transaction =
        responseData?.data;

      const successful =
        responseData?.status ===
          "success" &&
        transaction?.status ===
          "successful";

      return {
        success:
          successful,

        message:
          responseData?.message ||
          (
            successful
              ? "Flutterwave transaction verified successfully."
              : "Flutterwave transaction verification failed."
          ),

        reference:
          transaction?.tx_ref,

        transactionId:
          transaction?.id !== undefined &&
          transaction?.id !== null
            ? String(transaction.id)
            : input.transactionId,

        raw:
          responseData,
      };
    } catch (error) {
      throw this.createProviderError(
        "Failed to verify Flutterwave transaction.",
        error,
      );
    }
  }

  async chargeWithAuthorization(
    _input: ChargeAuthorizationInput,
  ): Promise<ProviderResponse> {
    throw new Error(
      "Flutterwave authorization charging is not supported in this backend integration.",
    );
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<ProviderResponse> {
    if (!input.transactionId?.trim()) {
      throw new Error(
        "Flutterwave transaction ID is required for refund.",
      );
    }

    const body: Record<string, unknown> = {};

    if (
      input.amount !== undefined &&
      input.amount !== null
    ) {
      if (
        !Number.isFinite(input.amount) ||
        input.amount <= 0
      ) {
        throw new Error(
          "Flutterwave refund amount must be greater than zero.",
        );
      }

      body.amount =
        input.amount;
    }

    if (input.reason?.trim()) {
      body.comments =
        input.reason.trim();
    }

    try {
      const response =
        await this.client.post(
          `/transactions/${encodeURIComponent(
            input.transactionId,
          )}/refund`,
          body,
        );

      const responseData =
        response.data;

      const refund =
        responseData?.data;

      return {
        success:
          responseData?.status ===
          "success",

        message:
          responseData?.message ||
          "Flutterwave refund initiated.",

        transactionId:
          refund?.id !== undefined &&
          refund?.id !== null
            ? String(refund.id)
            : input.transactionId,

        raw:
          responseData,
      };
    } catch (error) {
      throw this.createProviderError(
        "Failed to refund Flutterwave transaction.",
        error,
      );
    }
  }

  async createWithdrawal(
    input: CreateWithdrawalInput,
  ): Promise<ProviderResponse> {
    if (!input.reference?.trim()) {
      throw new Error(
        "Flutterwave withdrawal reference is required.",
      );
    }

    if (
      input.amount === undefined ||
      input.amount === null ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new Error(
        "Flutterwave withdrawal amount must be greater than zero.",
      );
    }

    if (!input.currency?.trim()) {
      throw new Error(
        "Flutterwave withdrawal currency is required.",
      );
    }

    if (
      input.destinationType ===
      "card"
    ) {
      throw new Error(
        "Flutterwave card withdrawals are not supported by the documented Flutterwave payout API. Use a supported payout destination such as a bank account.",
      );
    }

    if (
      input.destinationType !==
      "bank"
    ) {
      throw new Error(
        "Unsupported Flutterwave withdrawal destination.",
      );
    }

    const accountNumber =
      input.bank?.accountNumber?.trim();

    const bankCode =
      input.bank?.bankCode?.trim();

    if (!accountNumber) {
      throw new Error(
        "Flutterwave bank account number is required.",
      );
    }

    if (!bankCode) {
      throw new Error(
        "Flutterwave bank code is required.",
      );
    }

    const narration =
      input.reason?.trim() ||
      `SmartPOS withdrawal ${input.reference}`;

    const payload: Record<string, unknown> = {
      account_bank:
        bankCode,

      account_number:
        accountNumber,

      amount:
        input.amount,

      currency:
        input.currency
          .trim()
          .toUpperCase(),

      reference:
        input.reference.trim(),

      narration:
        narration.slice(0, 180),

      meta:
        input.metadata ?? {},
    };

    try {
      const response =
        await this.client.post(
          "/transfers",
          payload,
        );

      const responseData =
        response.data;

      const transfer =
        responseData?.data;

      const transferId =
        transfer?.id;

      const status =
        transfer?.status;

      const successful =
        responseData?.status ===
          "success" &&
        (
          status === undefined ||
          [
            "SUCCESSFUL",
            "successful",
            "PENDING",
            "pending",
            "NEW",
            "new",
          ].includes(
            String(status),
          )
        );

      return {
        success:
          successful,

        message:
          responseData?.message ||
          "Flutterwave withdrawal initiated.",

        reference:
          transfer?.reference ??
          input.reference,

        withdrawalId:
          transferId !== undefined &&
          transferId !== null
            ? String(transferId)
            : undefined,

        transactionId:
          transferId !== undefined &&
          transferId !== null
            ? String(transferId)
            : undefined,

        status:
          status !== undefined &&
          status !== null
            ? String(status)
            : undefined,

        raw:
          responseData,
      };
    } catch (error) {
      throw this.createProviderError(
        "Failed to create Flutterwave withdrawal.",
        error,
      );
    }
  }

  async verifyWithdrawal(
    input: VerifyWithdrawalInput,
  ): Promise<ProviderResponse> {
    if (!input.withdrawalId?.trim()) {
      throw new Error(
        "Flutterwave withdrawal ID is required for verification.",
      );
    }

    try {
      const response =
        await this.client.get(
          `/transfers/${encodeURIComponent(
            input.withdrawalId,
          )}`,
        );

      const responseData =
        response.data;

      const transfer =
        responseData?.data;

      const status =
        transfer?.status;

      const successful =
        responseData?.status ===
          "success" &&
        [
          "SUCCESSFUL",
          "successful",
        ].includes(
          String(status),
        );

      return {
        success:
          successful,

        message:
          responseData?.message ||
          (
            successful
              ? "Flutterwave withdrawal verified successfully."
              : "Flutterwave withdrawal has not completed successfully."
          ),

        reference:
          transfer?.reference,

        withdrawalId:
          transfer?.id !== undefined &&
          transfer?.id !== null
            ? String(transfer.id)
            : input.withdrawalId,

        transactionId:
          transfer?.id !== undefined &&
          transfer?.id !== null
            ? String(transfer.id)
            : input.withdrawalId,

        status:
          status !== undefined &&
          status !== null
            ? String(status)
            : undefined,

        raw:
          responseData,
      };
    } catch (error) {
      throw this.createProviderError(
        "Failed to verify Flutterwave withdrawal.",
        error,
      );
    }
  }

  async validateWebhook(
    _payload: unknown,
    signature: string,
  ): Promise<boolean> {
    const webhookSecret =
      process.env
        .FLUTTERWAVE_WEBHOOK_SECRET;

    if (!webhookSecret?.trim()) {
      return false;
    }

    if (!signature?.trim()) {
      return false;
    }

    const supplied =
      Buffer.from(
        signature.trim(),
        "utf8",
      );

    const expected =
      Buffer.from(
        webhookSecret.trim(),
        "utf8",
      );

    if (
      supplied.length !==
      expected.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      supplied,
      expected,
    );
  }

  private createProviderError(
    fallbackMessage: string,
    error: unknown,
  ): Error {
    if (
      error instanceof AxiosError
    ) {
      const providerMessage =
        error.response?.data?.message;

      if (
        typeof providerMessage ===
          "string" &&
        providerMessage.trim()
      ) {
        return new Error(
          `Flutterwave: ${providerMessage.trim()}`,
        );
      }

      if (
        error.code ===
        "ECONNABORTED"
      ) {
        return new Error(
          "Flutterwave request timed out.",
        );
      }

      if (
        error.code ===
        "ERR_NETWORK"
      ) {
        return new Error(
          "Unable to reach Flutterwave.",
        );
      }

      if (
        error.response?.status
      ) {
        return new Error(
          `Flutterwave request failed with status ${error.response.status}.`,
        );
      }
    }

    if (
      error instanceof Error &&
      error.message
    ) {
      return new Error(
        `${fallbackMessage} ${error.message}`,
      );
    }

    return new Error(
      fallbackMessage,
    );
  }
}