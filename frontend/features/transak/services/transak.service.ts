import { api } from "@/lib/api/client";
import type { TransakCapabilities, TransakQuote, TransakTransaction } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function requireData<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || !response.data) throw new Error(response.error || response.message || fallback);
  return response.data;
}

export const transakService = {
  async getCapabilities() {
    const response = await api.get<ApiResponse<TransakCapabilities>>("/transak/capabilities");
    return requireData(response.data, "Transak capabilities are unavailable.");
  },

  async getQuote(input: {
    fiatCurrency: string;
    fiatAmount: string;
    cryptoCurrency: string;
    network: string;
    countryCode: string;
    paymentMethod?: string;
    walletAddress: string;
  }) {
    const response = await api.post<ApiResponse<TransakQuote>>("/transak/quote", input);
    return requireData(response.data, "Transak quote is unavailable.");
  },

  async verifyWallet(input: {
    walletAddress: string;
    cryptoCurrency: string;
    network: string;
    countryCode: string;
  }) {
    const response = await api.post<ApiResponse<{ valid: boolean; message?: string }>>("/transak/wallet/verify", input);
    return requireData(response.data, "Wallet verification is unavailable.");
  },

  async createPaymentSession(input: {
    transactionId?: string;
    quoteId?: string;
    fiatCurrency: string;
    fiatAmount: string;
    cryptoCurrency: string;
    network: string;
    walletAddress: string;
    countryCode: string;
    cryptoAmount?: string;
    quoteRate?: string;
    feeAmount?: string;
    feeCurrency?: string;
  }) {
    const response = await api.post<ApiResponse<{ transactionId: string; partnerOrderId?: string; sessionId: string; widgetUrl: string }>>("/transak/payment-session", input);
    return requireData(response.data, "Secure payment session could not be created.");
  },

  async listTransactions() {
    const response = await api.get<ApiResponse<TransakTransaction[]>>("/transak/transactions");
    return requireData(response.data, "Transactions are unavailable.");
  },

  async getTransaction(id: string) {
    const response = await api.get<ApiResponse<TransakTransaction>>(`/transak/transactions/${encodeURIComponent(id)}`);
    return requireData(response.data, "Transaction is unavailable.");
  },
};
