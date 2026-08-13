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

export interface ProviderResponse {
  success: boolean;
  message: string;
  reference?: string;
  transactionId?: string;
  paymentUrl?: string;
  accessCode?: string;
  authorizationCode?: string;
  raw?: any;
}

export default abstract class BaseProvider {
  abstract readonly name: string;

  abstract createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse>;

  abstract verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse>;

  abstract chargeWithAuthorization(
    input: ChargeAuthorizationInput
  ): Promise<ProviderResponse>;

  abstract refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse>;

  abstract validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean>;
}
