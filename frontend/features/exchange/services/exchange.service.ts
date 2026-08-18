import { api } from "@/lib/api/client";
import type {
  ExchangeQuote,
  ExchangeOrder,
  ProviderBalance,
  GetQuoteRequest,
  ExecuteOrderRequest,
  ApiResponse,
} from "../types/exchange";

class ExchangeService {
  /**
   * Get a live quote from the real exchange provider
   * POST /exchange/real-quote
   */
  async getRealQuote(
    request: GetQuoteRequest
  ): Promise<ExchangeQuote> {
    const response = await api.post<ApiResponse<ExchangeQuote>>(
      "/exchange/real-quote",
      {
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        side: request.side,
        amount: request.amount,
        ttlSeconds: request.ttlSeconds ?? 30,
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to get quote"
      );
    }

    return response.data.data;
  }

  /**
   * Execute a BUY order on the real exchange provider
   * POST /exchange/buy
   */
  async buyUsdt(
    request: ExecuteOrderRequest
  ): Promise<ExchangeOrder> {
    const response = await api.post<ApiResponse<ExchangeOrder>>(
      "/exchange/buy",
      {
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        amount: request.amount,
        quoteId: request.quoteId,
        clientOrderId: request.clientOrderId,
        limitPrice: request.limitPrice,
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to execute buy order"
      );
    }

    return response.data.data;
  }

  /**
   * Execute a SELL order on the real exchange provider
   * POST /exchange/sell
   */
  async sellUsdt(
    request: ExecuteOrderRequest
  ): Promise<ExchangeOrder> {
    const response = await api.post<ApiResponse<ExchangeOrder>>(
      "/exchange/sell",
      {
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        amount: request.amount,
        quoteId: request.quoteId,
        clientOrderId: request.clientOrderId,
        limitPrice: request.limitPrice,
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to execute sell order"
      );
    }

    return response.data.data;
  }

  /**
   * Get order status from the provider
   * GET /exchange/orders/:orderId
   */
  async getOrderStatus(orderId: string): Promise<ExchangeOrder> {
    const response = await api.get<ApiResponse<ExchangeOrder>>(
      `/exchange/orders/${orderId}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to get order status"
      );
    }

    return response.data.data;
  }

  /**
   * Get provider balance for a specific asset
   * GET /exchange/balance/:asset
   */
  async getProviderBalance(
    asset: string
  ): Promise<ProviderBalance> {
    const response = await api.get<ApiResponse<ProviderBalance>>(
      `/exchange/balance/${asset}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to get provider balance"
      );
    }

    return response.data.data;
  }

  /**
   * Get order details with fills
   * GET /exchange/orders/:orderId/details
   */
  async getOrderDetails(orderId: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(
      `/exchange/orders/${orderId}/details`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error ||
          response.data.message ||
          "Failed to get order details"
      );
    }

    return response.data.data;
  }

  /**
   * Get settlement status for a BUY order
   * GET /exchange/orders/:orderId/settlement
   */
  async getSettlementStatus(orderId: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(
      `/exchange/orders/${orderId}/settlement`
    );

    if (!response.data.success || !response.data.data) {
      // Settlement may not exist yet, return null instead of throwing
      return null;
    }

    return response.data.data;
  }

  /**
   * Get blockchain transaction details
   * GET /exchange/orders/:orderId/blockchain
   */
  async getBlockchainTransaction(orderId: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(
      `/exchange/orders/${orderId}/blockchain`
    );

    if (!response.data.success || !response.data.data) {
      return null;
    }

    return response.data.data;
  }
}

export const exchangeService = new ExchangeService();
