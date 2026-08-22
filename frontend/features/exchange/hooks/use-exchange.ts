"use client";

import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { exchangeService } from "../services/exchange.service";

import type {
  GetQuoteRequest,
  ExecuteOrderRequest,
  ExchangeOrder,
} from "../types/exchange";

/**
 * Get a live quote from the real exchange provider.
 *
 * For Quidax Ramp BUY quotes the request must contain:
 * - baseAsset
 * - quoteAsset
 * - side
 * - amount
 * - network
 */
export function useGetQuote() {
  return useMutation({
    mutationFn: (
      request: GetQuoteRequest
    ) =>
      exchangeService.getRealQuote(
        request
      ),
  });
}

/**
 * Buy USDT on the real exchange provider.
 */
export function useBuyUsdt() {
  return useMutation({
    mutationFn: (
      request: ExecuteOrderRequest
    ) =>
      exchangeService.buyUsdt(
        request
      ),
  });
}

/**
 * Sell USDT on the real exchange provider.
 */
export function useSellUsdt() {
  return useMutation({
    mutationFn: (
      request: ExecuteOrderRequest
    ) =>
      exchangeService.sellUsdt(
        request
      ),
  });
}

/**
 * Get order status from the provider.
 *
 * Polls while the order is non-terminal.
 */
export function useGetOrderStatus(
  orderId?: string
) {
  return useQuery({
    queryKey: [
      "exchange-order",
      orderId,
    ],

    queryFn: () => {
      if (!orderId) {
        throw new Error(
          "orderId is required"
        );
      }

      return exchangeService.getOrderStatus(
        orderId
      );
    },

    enabled: Boolean(orderId),

    refetchInterval: (
      query
    ) => {
      const data =
        query.state.data as
          | ExchangeOrder
          | undefined;

      if (
        data?.status ===
          "FILLED" ||
        data?.status ===
          "CANCELED" ||
        data?.status ===
          "REJECTED" ||
        data?.status ===
          "EXPIRED" ||
        data?.status ===
          "FAILED"
      ) {
        return false;
      }

      return 3000;
    },
  });
}

/**
 * Get provider balance for an asset.
 */
export function useProviderBalance(
  asset?: string
) {
  return useQuery({
    queryKey: [
      "provider-balance",
      asset,
    ],

    queryFn: () => {
      if (!asset) {
        throw new Error(
          "asset is required"
        );
      }

      return exchangeService.getProviderBalance(
        asset
      );
    },

    enabled: Boolean(asset),
  });
}

/**
 * Get detailed order information including fills.
 */
export function useOrderDetails(
  orderId?: string
) {
  return useQuery({
    queryKey: [
      "exchange-order-details",
      orderId,
    ],

    queryFn: () => {
      if (!orderId) {
        throw new Error(
          "orderId is required"
        );
      }

      return exchangeService.getOrderDetails(
        orderId
      );
    },

    enabled: Boolean(orderId),

    refetchInterval: (
      query
    ) => {
      const data =
        query.state.data as
          | {
              status?: string;
            }
          | undefined;

      if (
        data?.status ===
          "FILLED" ||
        data?.status ===
          "CANCELED" ||
        data?.status ===
          "REJECTED" ||
        data?.status ===
          "EXPIRED" ||
        data?.status ===
          "FAILED"
      ) {
        return false;
      }

      return 3000;
    },
  });
}

/**
 * Get settlement status for a BUY order.
 */
export function useSettlementStatus(
  orderId?: string
) {
  return useQuery({
    queryKey: [
      "exchange-settlement",
      orderId,
    ],

    queryFn: () => {
      if (!orderId) {
        throw new Error(
          "orderId is required"
        );
      }

      return exchangeService.getSettlementStatus(
        orderId
      );
    },

    enabled: Boolean(orderId),

    refetchInterval: (
      query
    ) => {
      const data =
        query.state.data as
          | {
              status?: string;
            }
          | null
          | undefined;

      if (!data) {
        return false;
      }

      if (
        data.status ===
          "SETTLED" ||
        data.status ===
          "CONFIRMED" ||
        data.status ===
          "FAILED"
      ) {
        return false;
      }

      return 5000;
    },
  });
}

/**
 * Get blockchain transaction details.
 */
export function useBlockchainTransaction(
  orderId?: string
) {
  return useQuery({
    queryKey: [
      "exchange-blockchain",
      orderId,
    ],

    queryFn: () => {
      if (!orderId) {
        throw new Error(
          "orderId is required"
        );
      }

      return exchangeService.getBlockchainTransaction(
        orderId
      );
    },

    enabled: Boolean(orderId),

    refetchInterval: (
      query
    ) => {
      const data =
        query.state.data as
          | {
              status?: string;
            }
          | null
          | undefined;

      if (!data) {
        return false;
      }

      if (
        data.status ===
          "CONFIRMED" ||
        data.status ===
          "FAILED" ||
        data.status ===
          "SETTLED"
      ) {
        return false;
      }

      return 4000;
    },
  });
}