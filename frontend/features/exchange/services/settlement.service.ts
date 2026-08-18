import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/features/exchange/types/exchange";

export interface CryptoSettlementRecord {
  id: string;
  payment: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    customerEmail?: string;
    createdAt: string;
    updatedAt: string;
  };
  paymentProviderAccount?: {
    id: string;
    displayName: string;
    provider: string;
    currency: string;
    status: string;
  } | null;
  conversion?: {
    id: string;
    fromCurrency: string;
    toCurrency: string;
    requestedAmount: string;
    quotedAmount?: string;
    acquiredAmount: string;
    rate: string;
    fee: string;
    status: string;
    quoteId?: string;
    quoteExpiresAt?: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  order?: {
    id: string;
    providerOrderId?: string | null;
    provider: string;
    symbol: string;
    side: string;
    requestedAmount: string;
    filledAmount: string;
    averagePrice?: string | null;
    status: string;
    clientOrderId?: string;
    quoteId?: string;
    createdAt: string;
    updatedAt: string;
    fills: Array<{
      id: string;
      tradeId?: string | null;
      price: string;
      amount: string;
      fee: string;
      timestamp: string;
    }>;
  } | null;
  wallet?: {
    id: string;
    name: string;
    currency: string;
    status: string;
    address?: string | null;
  } | null;
  blockchain?: {
    id: string;
    txHash: string;
    network: string;
    explorerUrl?: string | null;
    fromAddress: string;
    toAddress: string;
    amount: string;
    currency: string;
    fee: string;
    blockNumber?: number | null;
    confirmations: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  settlement: {
    status: string;
    requiredConfirmations?: number;
    [key: string]: unknown;
  };
}

class SettlementService {
  async list(): Promise<CryptoSettlementRecord[]> {
    const response = await api.get<ApiResponse<CryptoSettlementRecord[]>>(
      "/crypto-settlements"
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || response.data.message || "Unable to load settlements");
    }
    return response.data.data;
  }

  async get(id: string): Promise<CryptoSettlementRecord> {
    const response = await api.get<ApiResponse<CryptoSettlementRecord>>(
      `/crypto-settlements/${id}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || response.data.message || "Unable to load settlement");
    }
    return response.data.data;
  }
}

export const settlementService = new SettlementService();
