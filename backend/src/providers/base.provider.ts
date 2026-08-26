export interface CreatePaymentInput {
  amount: number;
  currency: string;
  reference: string;
  description?: string;

  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };

  metadata?: Record<string, any>;
}

export interface RefundPaymentInput {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export interface VerifyPaymentInput {
  transactionId: string;
}

export interface ChargeAuthorizationInput {
  amount: number;
  currency: string;
  email: string;
  authorizationCode: string;
  reference: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Generic fiat/card withdrawal request.
 *
 * The provider-specific implementation is responsible
 * for translating this into the provider's payout API.
 */
export interface CreateWithdrawalInput {
  amount: number;
  currency: string;
  reference: string;

  /**
   * Destination type.
   *
   * For the SmartPOS Flutterwave card withdrawal flow,
   * this will be "card".
   */
  destinationType: "card" | "bank";

  /**
   * Card destination.
   *
   * Do not store or log full card numbers in application
   * metadata. The provider implementation should use the
   * appropriate tokenized/approved destination identifier
   * where required.
   */
  card?: {
    number?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvv?: string;
    token?: string;
    name?: string;
  };

  /**
   * Bank destination, retained for provider compatibility.
   */
  bank?: {
    accountNumber?: string;
    bankCode?: string;
    accountName?: string;
  };

  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };

  reason?: string;

  metadata?: Record<string, any>;
}

export interface VerifyWithdrawalInput {
  withdrawalId: string;
}

export interface ProviderResponse {
  success: boolean;
  message: string;

  reference?: string;

  transactionId?: string;

  /**
   * Provider withdrawal/payout identifier.
   */
  withdrawalId?: string;

  /**
   * Provider payout status.
   */
  status?: string;

  paymentUrl?: string;

  accessCode?: string;

  authorizationCode?: string;

  raw?: any;
}

export default abstract class BaseProvider {
  abstract readonly name: string;

  /**
   * Create a fiat/card payment.
   */
  abstract createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse>;

  /**
   * Verify a provider transaction.
   */
  abstract verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse>;

  /**
   * Charge a previously authorized payment method.
   *
   * Providers that do not support reusable authorization
   * must explicitly reject this operation.
   */
  abstract chargeWithAuthorization(
    input: ChargeAuthorizationInput
  ): Promise<ProviderResponse>;

  /**
   * Refund a provider transaction.
   */
  abstract refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse>;

  /**
   * Create a fiat withdrawal/payout.
   *
   * Flutterwave will implement the SmartPOS card-withdrawal
   * flow through this contract.
   */
  abstract createWithdrawal(
    input: CreateWithdrawalInput
  ): Promise<ProviderResponse>;

  /**
   * Verify a previously created withdrawal/payout.
   */
  abstract verifyWithdrawal(
    input: VerifyWithdrawalInput
  ): Promise<ProviderResponse>;

  /**
   * Validate the provider webhook signature/hash.
   */
  abstract validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean>;
}