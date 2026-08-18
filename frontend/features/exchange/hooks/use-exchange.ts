"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { exchangeService } from "../services/exchange.service";
import type {
  GetQuoteRequest,
  ExecuteOrderRequest,
  ExchangeQuote,
  ExchangeOrder,
  ProviderBalance,
} from "../types/exchange";

/**
 * Get a live quote from the real exchange provider
 * Includes quote expiration tracking
 */
export function useGetQuote() {
  return useMutation({
    mutationFn: (request: GetQuoteRequest) =>
      exchangeService.getRealQuote(request),
  });
}

/**
 * Buy USDT on the real exchange provider
 */
export function useBuyUsdt() {
  return useMutation({
    mutationFn: (request: ExecuteOrderRequest) =>
      exchangeService.buyUsdt(request),
  });
}

/**
 * Sell USDT on the real exchange provider
 */
export function useSellUsdt() {
  return useMutation({
    mutationFn: (request: ExecuteOrderRequest) =>
      exchangeService.sellUsdt(request),
  });
}

/**
 * Get order status from the provider
 * Useful for polling to track fill progress
 */
export function useGetOrderStatus(orderId?: string) {
  return useQuery({
    queryKey: ["exchange-order", orderId],
    queryFn: () => {
      if (!orderId) throw new Error("orderId is required");
      return exchangeService.getOrderStatus(orderId);
    },
    enabled: !!orderId,
    // Poll every 3 seconds while order is not filled
    refetchInterval: (query) => {
      const data = query.state.data as ExchangeOrder | undefined;
      if (data?.status === "FILLED" || data?.status === "CANCELED" || data?.status === "FAILED") {
        return false; // Stop polling
      }
      return 3000; // Poll every 3 seconds
    },
  });
}

/**
 * Get provider balance for an asset
 */
export function useProviderBalance(asset?: string) {
  return useQuery({
    queryKey: ["provider-balance", asset],
    queryFn: () => {
      if (!asset) throw new Error("asset is required");
      return exchangeService.getProviderBalance(asset);
    },
    enabled: !!asset,
  });
}
