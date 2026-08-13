declare module "@paystack/inline-js" {
  export interface PaystackTransaction {
    reference: string;
    status?: string;
    transaction?: string;
    message?: string;
  }

  export interface PaystackNewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onLoad?: () => void;
    onError?: (error: unknown) => void;
  }

  export default class PaystackPop {
    constructor();

    newTransaction(
      options: PaystackNewTransactionOptions
    ): void;

    resumeTransaction(
      accessCode: string
    ): void;

    cancelTransaction(): void;
  }
}
