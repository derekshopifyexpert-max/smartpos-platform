import BaseProvider, {
  CreatePaymentInput,
  CreateWithdrawalInput,
  RefundPaymentInput,
  VerifyPaymentInput,
  VerifyWithdrawalInput,
  ProviderResponse,
} from "./base.provider.js";

export default class MockProvider extends BaseProvider {
  readonly name = "mock";

  async createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse> {
    return {
      success: true,
      message: "Mock payment created.",
      reference: input.reference,
      transactionId: "MOCK_TX_" + Date.now(),
      paymentUrl:
        "https://mock.smartpos/pay/" +
        input.reference,
      authorizationCode:
        "AUTH" + Math.floor(Math.random() * 100000),
      raw: {
        provider: "mock",
        status: "approved",
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse> {
    return {
      success: true,
      message: "Payment verified.",
      transactionId: input.transactionId,
      raw: {
        status: "SUCCESS",
      },
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
    return {
      success: true,
      message:
        "Mock authorization charge completed.",
      reference: input.reference,
      transactionId:
        "MOCK_AUTH_TX_" + Date.now(),
      authorizationCode:
        input.authorizationCode,
      raw: {
        provider: "mock",
        status: "approved",
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse> {
    return {
      success: true,
      message: "Refund successful.",
      transactionId: input.transactionId,
      raw: {
        refunded: true,
      },
    };
  }

  async createWithdrawal(
    input: CreateWithdrawalInput
  ): Promise<ProviderResponse> {
    return {
      success: true,
      message: "Mock withdrawal created.",
      reference: input.reference,
      withdrawalId:
        "MOCK_WITHDRAWAL_" + Date.now(),
      transactionId:
        "MOCK_WITHDRAWAL_TX_" + Date.now(),
      status: "PENDING",
      raw: {
        provider: "mock",
        status: "PENDING",
        amount: input.amount,
        currency: input.currency,
        destinationType:
          input.destinationType,
      },
    };
  }

  async verifyWithdrawal(
    input: VerifyWithdrawalInput
  ): Promise<ProviderResponse> {
    return {
      success: true,
      message: "Mock withdrawal verified.",
      withdrawalId: input.withdrawalId,
      transactionId: input.withdrawalId,
      status: "SUCCESSFUL",
      raw: {
        provider: "mock",
        status: "SUCCESSFUL",
        withdrawalId:
          input.withdrawalId,
      },
    };
  }

  async validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean> {
    return true;
  }
}