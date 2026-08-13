declare module "@paystack/inline-js" {
  export interface PaystackTransaction {
    id?: number | string;
    reference?: string;
    message?: string;
  }

  export interface PaystackError {
    message?: string;
  }

  export interface PaystackCallbacks {
    onLoad?: (response: {
      id: number;
      customer: unknown;
      accessCode: string;
    }) => void;

    onSuccess?: (response: PaystackTransaction) => void;

    onCancel?: () => void;

    onError?: (error: PaystackError) => void;
  }

  export default class PaystackPop {
    resumeTransaction(
      accessCode: string,
      callbacks?: PaystackCallbacks
    ): unknown;

    cancelTransaction(transaction: unknown): void;

    isLoaded(): boolean;
  }
}