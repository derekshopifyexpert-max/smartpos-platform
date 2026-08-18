"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/features/exchange/types/exchange";

export interface TransactionHistoryItem {
  id: string;
  orderId: string;
  type: "BUY" | "SELL";
  baseAsset: string;
  quoteAsset: string;
  requestedAmount: string;
  executedAmount: string;
  avgPrice: string;
  fee?: string;
  provider?: string;
  status: string;
  settlementStatus?: string;
  transactionHash?: string;
  confirmations?: number;
  createdAt: string;
  updatedAt: string;
  destinationWallet?: {
    id: string;
    name: string;
    address: string;
    network: string;
  };
}

async function getTransactionHistory(page = 1, limit = 10) {
  type ExchangeOrderHistoryRecord = {
    id: string;
    orderId?: string | null;
    symbol: string;
    side: "BUY" | "SELL";
    amount: string;
    filledAmount: string;
    avgPrice?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    exchangeProvider?: { name?: string };
  };

  const response = await api.get<
    ApiResponse<{
      items: ExchangeOrderHistoryRecord[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>
  >(`/exchange/orders?page=${page}&limit=${limit}`);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || "Failed to fetch transaction history");
  }

  return {
    ...response.data.data,
    items: response.data.data.items.map((item) => ({
      id: item.id,
      orderId: item.orderId || item.id,
      type: item.side,
      baseAsset: item.symbol,
      quoteAsset: "USD",
      requestedAmount: item.amount,
      executedAmount: item.filledAmount,
      avgPrice: item.avgPrice || "0",
      fee: undefined,
      provider: item.exchangeProvider?.name,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

export function useTransactionHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ["transaction-history", page, limit],
    queryFn: () => getTransactionHistory(page, limit),
  });
}
