/**
 * RealExchangeProvider - Generic HTTP-based Exchange Provider Adapter
 * 
 * This adapter connects to real cryptocurrency exchange APIs.
 * It can be configured for different providers by specifying:
 * - Base URL
 * - API authentication
 * - Endpoint mappings
 * - Request/response transformations
 * 
 * Supports providers like: Binance, Kraken, Coinbase, OTC platforms, etc.
 */

import axios, { AxiosInstance } from "axios";
import { Prisma } from "@prisma/client";
import {
  IExchangeProvider,
  CryptoQuoteResponse,
  CryptoQuoteRequest,
  CryptoOrderResponse,
  CryptoOrderRequest,
  ProviderBalance,
  ProviderAccountInfo,
  ProviderError,
  normalizeOrderStatus,
} from "./exchange-provider.interface.js";

interface RealExchangeProviderConfig {
  provider: string;                    // Provider name
  baseUrl: string;                     // API base URL
  apiKey?: string;                     // API key/public key
  apiSecret?: string;                  // API secret/private key
  endpoints?: Record<string, string>;  // Custom endpoint mappings
  authHeader?: string;                 // Auth header name
  authScheme?: string;                 // Auth scheme (Bearer, etc.)
  metadata?: Record<string, unknown>;  // Additional config
}

/**
 * Generic real exchange provider adapter.
 * 
 * Configuration example:
 * {
 *   provider: "binance",
 *   baseUrl: "https://api.binance.com",
 *   apiKey: "your-api-key",
 *   apiSecret: "your-api-secret",
 *   metadata: {
 *     sandbox: false,  // Set to true for sandbox/testnet
 *     tradingPair: "USDTBUSD"  // Provider-specific pair name
 *   }
 * }
 */
export default class RealExchangeProvider implements IExchangeProvider {
  private readonly client: AxiosInstance;
  private readonly config: RealExchangeProviderConfig;

  constructor(config: RealExchangeProviderConfig) {
    if (!config.baseUrl) {
      throw new Error("Exchange provider requires baseUrl configuration");
    }

    this.config = config;

    // Create HTTP client
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add authentication if provided
    if (config.apiKey) {
      const authHeader = config.authHeader || "X-API-Key";
      const authScheme = config.authScheme || "";
      const authValue = authScheme ? `${authScheme} ${config.apiKey}` : config.apiKey;
      this.client.defaults.headers.common[authHeader] = authValue;
    }

    // Add request interceptor for signing if using secret key
    if (config.apiSecret) {
      this.client.interceptors.request.use((request) => {
        // Provider-specific signing logic can be added here
        // Example: HMAC-SHA256 signing for Binance-like providers
        return request;
      });
    }

    // Add response error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = error.response?.data?.message || error.message || "Unknown error";
        const code = error.response?.data?.code || error.code || "UNKNOWN_ERROR";
        const retryable = this.isRetryableError(error);

        throw new ProviderError(
          this.config.provider,
          code,
          message,
          { originalError: error.message },
          retryable
        );
      }
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === "ECONNABORTED" || error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return true;
    }

    // Rate limit errors are retryable
    if (error.response?.status === 429) {
      return true;
    }

    // Server errors are retryable
    if (error.response?.status >= 500) {
      return true;
    }

    // Timeout is retryable
    if (error.code === "ETIMEDOUT") {
      return true;
    }

    return false;
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<ProviderAccountInfo> {
    try {
      const endpoint = this.config.endpoints?.["getAccountInfo"] || "/v1/account";
      const response = await this.client.get(endpoint);

      // Normalize provider response
      return {
        accountId: response.data.id || response.data.account || "",
        accountName: response.data.name || undefined,
        status: response.data.status === "active" ? "ACTIVE" : "INACTIVE",
        balances: (response.data.balances || []).map((b: any) => ({
          asset: b.asset || b.currency,
          available: new Prisma.Decimal(b.free || b.available || "0"),
          total: new Prisma.Decimal(b.total || b.balance || b.free || "0"),
          reserved: new Prisma.Decimal(b.locked || b.reserved || "0"),
        })),
        metadata: response.data,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_ACCOUNT_FAILED",
        "Failed to retrieve account information",
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Get balance for a specific asset
   */
  async getBalance(asset: string): Promise<ProviderBalance> {
    try {
      const accountInfo = await this.getAccountInfo();
      const balance = accountInfo.balances?.find((b) => b.asset.toUpperCase() === asset.toUpperCase());

      if (!balance) {
        return {
          asset,
          available: new Prisma.Decimal("0"),
          total: new Prisma.Decimal("0"),
          reserved: new Prisma.Decimal("0"),
        };
      }

      return balance;
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_BALANCE_FAILED",
        `Failed to retrieve balance for ${asset}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Get a quote without executing
   */
  async getQuote(request: CryptoQuoteRequest): Promise<CryptoQuoteResponse> {
    try {
      const endpoint = this.config.endpoints?.["getQuote"] || "/v1/quote";
      const symbol = this.buildSymbol(request.baseAsset, request.quoteAsset);

      const response = await this.client.get(endpoint, {
        params: {
          symbol,
          side: request.side.toLowerCase(),
          quantity: request.amount.toString(),
        },
      });

      // Parse response and normalize
      const price = new Prisma.Decimal(response.data.price || response.data.rate || "0");
      const outputAmount = request.side === "BUY" 
        ? request.amount.div(price)
        : request.amount.mul(price);

      const fee = new Prisma.Decimal(response.data.fee || "0");
      const expiresIn = response.data.expiresIn || 30; // Default 30 seconds

      return {
        quoteId: response.data.quoteId || response.data.id || this.generateQuoteId(),
        provider: this.config.provider,
        symbol,
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        side: request.side,
        price,
        inputAmount: request.amount,
        outputAmount,
        fee,
        feeCurrency: request.quoteAsset,
        feePercentage: request.amount.gt(0) ? fee.div(request.amount).mul(100) : new Prisma.Decimal("0"),
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        expiresIn,
        providerTimestamp: new Date(),
        metadata: {
          providerQuoteId: response.data.quoteId,
          raw: response.data,
        },
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_QUOTE_FAILED",
        `Failed to get quote for ${request.baseAsset}/${request.quoteAsset}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Execute a BUY order
   */
  async buy(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    try {
      // Validate balance
      const balance = await this.getBalance(request.quoteAsset);
      if (balance.available.lt(request.amount)) {
        throw new ProviderError(
          this.config.provider,
          "INSUFFICIENT_BALANCE",
          `Insufficient ${request.quoteAsset} balance. Have ${balance.available}, need ${request.amount}`,
          { available: balance.available.toString(), required: request.amount.toString() },
          false
        );
      }

      const endpoint = this.config.endpoints?.["buy"] || "/v1/order/create";
      const symbol = this.buildSymbol(request.baseAsset, request.quoteAsset);

      const orderPayload: Record<string, unknown> = {
        symbol,
        side: "BUY",
        type: "MARKET",
        quantity: request.amount.toString(),
        clientOrderId: request.clientOrderId || this.generateClientOrderId(),
      };

      if (request.limitPrice) {
        orderPayload.price = request.limitPrice.toString();
        orderPayload.type = "LIMIT";
      }

      const response = await this.client.post(endpoint, orderPayload);

      // Normalize order response
      return this.normalizeOrderResponse(response.data, request);
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "BUY_FAILED",
        `Failed to execute BUY order for ${request.amount} ${request.quoteAsset}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Execute a SELL order
   */
  async sell(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    try {
      // Validate balance
      const balance = await this.getBalance(request.baseAsset);
      if (balance.available.lt(request.amount)) {
        throw new ProviderError(
          this.config.provider,
          "INSUFFICIENT_BALANCE",
          `Insufficient ${request.baseAsset} balance. Have ${balance.available}, need ${request.amount}`,
          { available: balance.available.toString(), required: request.amount.toString() },
          false
        );
      }

      const endpoint = this.config.endpoints?.["sell"] || "/v1/order/create";
      const symbol = this.buildSymbol(request.baseAsset, request.quoteAsset);

      const orderPayload: Record<string, unknown> = {
        symbol,
        side: "SELL",
        type: "MARKET",
        quantity: request.amount.toString(),
        clientOrderId: request.clientOrderId || this.generateClientOrderId(),
      };

      if (request.limitPrice) {
        orderPayload.price = request.limitPrice.toString();
        orderPayload.type = "LIMIT";
      }

      const response = await this.client.post(endpoint, orderPayload);

      // Normalize order response
      return this.normalizeOrderResponse(response.data, request);
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "SELL_FAILED",
        `Failed to execute SELL order for ${request.amount} ${request.baseAsset}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string): Promise<CryptoOrderResponse> {
    try {
      const endpoint = this.config.endpoints?.["getOrder"] || `/v1/order/${orderId}`;
      const response = await this.client.get(endpoint, {
        params: { orderId },
      });

      return this.normalizeOrderResponse(response.data, undefined, orderId);
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_ORDER_FAILED",
        `Failed to retrieve order status for ${orderId}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<CryptoOrderResponse> {
    try {
      const endpoint = this.config.endpoints?.["cancelOrder"] || `/v1/order/${orderId}/cancel`;
      const response = await this.client.post(endpoint, { orderId });

      return this.normalizeOrderResponse(response.data, undefined, orderId);
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "CANCEL_ORDER_FAILED",
        `Failed to cancel order ${orderId}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Get live market price
   */
  async getMarketPrice(baseAsset: string, quoteAsset: string): Promise<Prisma.Decimal> {
    try {
      const endpoint = this.config.endpoints?.["getPrice"] || "/v1/ticker";
      const symbol = this.buildSymbol(baseAsset, quoteAsset);

      const response = await this.client.get(endpoint, {
        params: { symbol },
      });

      const price = new Prisma.Decimal(response.data.price || response.data.last || "0");
      return price;
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_PRICE_FAILED",
        `Failed to get market price for ${baseAsset}/${quoteAsset}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  /**
   * Get trading rules for a symbol
   */
  async getTradingRules(symbol: string): Promise<Record<string, unknown>> {
    try {
      const endpoint = this.config.endpoints?.["getTradingRules"] || `/v1/symbol/${symbol}`;
      const response = await this.client.get(endpoint);

      return {
        symbol,
        minOrderQty: response.data.minOrderQty,
        minOrderValue: response.data.minOrderValue,
        maxOrderQty: response.data.maxOrderQty,
        stepSize: response.data.stepSize,
        tickSize: response.data.tickSize,
        ...response.data.raw,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      throw new ProviderError(
        this.config.provider,
        "GET_TRADING_RULES_FAILED",
        `Failed to get trading rules for ${symbol}`,
        { error: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Build trading pair symbol from base and quote assets
   */
  private buildSymbol(baseAsset: string, quoteAsset: string): string {
    // If provider has custom pair mapping, use it
    if (this.config.metadata?.tradingPair) {
      return this.config.metadata.tradingPair as string;
    }

    // Default: BASE_QUOTE or BASEQUOTE format
    return `${baseAsset}_${quoteAsset}`;
  }

  /**
   * Normalize provider order response
   */
  private normalizeOrderResponse(
    data: any,
    request?: CryptoOrderRequest,
    orderId?: string
  ): CryptoOrderResponse {
    const baseAsset = request?.baseAsset || data.baseAsset || data.symbol?.split("_")[0] || "UNKNOWN";
    const quoteAsset = request?.quoteAsset || data.quoteAsset || data.symbol?.split("_")[1] || "UNKNOWN";
    const side = request?.side || (data.side?.toUpperCase() === "BUY" ? "BUY" : "SELL") || "BUY";

    const requestedAmount = request?.amount || new Prisma.Decimal(data.quantity || data.amount || "0");
    const executedAmount = new Prisma.Decimal(data.executedQty || data.filledAmount || data.quantity || "0");
    const avgPrice = new Prisma.Decimal(data.avgPrice || data.price || "0");
    const totalFee = new Prisma.Decimal(data.fee || data.commission || "0");

    const status = normalizeOrderStatus(data.status || "PENDING", executedAmount, requestedAmount);

    return {
      orderId: data.orderId || data.id || orderId || "",
      provider: this.config.provider,
      symbol: `${baseAsset}_${quoteAsset}`,
      baseAsset,
      quoteAsset,
      side,
      status,
      requestedAmount,
      executedAmount,
      averagePrice: avgPrice,
      totalFee,
      feeCurrency: quoteAsset,
      statusMessage: data.statusMessage || this.getStatusMessage(status),
      quoteId: data.quoteId,
      createdAt: new Date(data.createdAt || data.timestamp || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
      metadata: {
        providerOrderId: data.orderId || data.id,
        raw: data,
      },
    };
  }

  /**
   * Get human-readable status message
   */
  private getStatusMessage(status: CryptoOrderResponse["status"]): string {
    const messages: Record<string, string> = {
      PENDING: "Order is pending",
      OPEN: "Order is open on the market",
      PARTIALLY_FILLED: "Order has been partially filled",
      FILLED: "Order has been completely filled",
      CANCELLED: "Order has been cancelled",
      REJECTED: "Order has been rejected",
      FAILED: "Order execution failed",
      EXPIRED: "Order has expired",
    };
    return messages[status] || "Unknown status";
  }

  /**
   * Generate unique quote ID
   */
  private generateQuoteId(): string {
    return `quote_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate unique client order ID for idempotency
   */
  private generateClientOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
