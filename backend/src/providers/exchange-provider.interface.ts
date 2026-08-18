/**
 * ExchangeProvider Interface
 * 
 * Defines the contract for real cryptocurrency liquidity/exchange providers.
 * This is the abstraction layer that allows SmartPOS to work with different
 * exchange providers (Binance, Kraken, OTC desks, etc.).
 * 
 * All methods return normalized SmartPOS data, not provider-specific responses.
 */

import { Prisma } from "@prisma/client";

/**
 * Normalized quote response from any provider.
 * Contains all data needed to display pricing to user and execute order.
 */
export interface CryptoQuoteResponse {
  quoteId: string;                    // Unique quote ID from provider
  provider: string;                   // Provider name
  symbol: string;                     // e.g., "USDT_USD", "BTC_USDT"
  baseAsset: string;                  // e.g., "USDT"
  quoteAsset: string;                 // e.g., "USD"
  side: "BUY" | "SELL";               // Buy or sell direction
  price: Prisma.Decimal;              // Unit price
  inputAmount: Prisma.Decimal;        // Amount to pay/receive (in quote asset)
  outputAmount: Prisma.Decimal;       // Amount to receive/pay (in base asset)
  fee: Prisma.Decimal;                // Total fee
  feeCurrency: string;                // Fee denomination (USD, USDT, etc.)
  feePercentage: Prisma.Decimal;      // Fee as percentage for display
  expiresAt: Date;                    // When this quote expires
  expiresIn: number;                  // Seconds until expiration
  providerTimestamp: Date;            // When provider generated this
  metadata?: Record<string, unknown>;  // Provider-specific metadata (safe data only)
}

/**
 * Request for a quote
 */
export interface CryptoQuoteRequest {
  baseAsset: string;                  // e.g., "USDT"
  quoteAsset: string;                 // e.g., "USD" or "NGN"
  side: "BUY" | "SELL";               // Which direction
  amount: Prisma.Decimal;             // Amount (in quote asset for BUY, base for SELL)
  clientOrderId?: string;             // Optional idempotency key
}

/**
 * Normalized trade/order response from provider.
 * Represents the actual execution result.
 */
export interface CryptoOrderResponse {
  orderId: string;                    // Unique order ID from provider
  provider: string;                   // Provider name
  symbol: string;                     // Trading pair, e.g., "USDT_USD"
  baseAsset: string;                  // Asset being traded
  quoteAsset: string;                 // Quote currency
  side: "BUY" | "SELL";               // Direction
  status: "PENDING" | "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED" | "FAILED" | "EXPIRED";
  requestedAmount: Prisma.Decimal;    // Requested quantity/value
  executedAmount: Prisma.Decimal;     // Actually executed quantity/value
  averagePrice: Prisma.Decimal;       // Avg price for fills
  totalFee: Prisma.Decimal;           // Total fee charged
  feeCurrency: string;                // Fee denomination
  statusMessage?: string;             // Human-readable status
  quoteId?: string;                   // Reference to original quote
  createdAt: Date;                    // Order creation time
  updatedAt: Date;                    // Last update time
  metadata?: Record<string, unknown>;  // Provider-specific metadata
}

/**
 * Request to execute a buy/sell
 */
export interface CryptoOrderRequest {
  baseAsset: string;                  // e.g., "USDT"
  quoteAsset: string;                 // e.g., "USD"
  side: "BUY" | "SELL";               // Direction
  amount: Prisma.Decimal;             // Amount (in quote asset for BUY, base for SELL)
  quoteId?: string;                   // If quoting first, reference quote ID
  clientOrderId?: string;             // Idempotency key (strongly recommended)
  limitPrice?: Prisma.Decimal;        // Optional price limit for safety
}

/**
 * Provider balance/account info
 */
export interface ProviderBalance {
  asset: string;                      // e.g., "USDT"
  available: Prisma.Decimal;          // Available to trade
  total: Prisma.Decimal;              // Total held
  reserved: Prisma.Decimal;           // Reserved in open orders
}

/**
 * Provider account information
 */
export interface ProviderAccountInfo {
  accountId: string;
  accountName?: string;
  status: "ACTIVE" | "INACTIVE" | "RESTRICTED";
  balances?: ProviderBalance[];
  metadata?: Record<string, unknown>;
}

/**
 * Base interface for exchange providers.
 * All methods must normalize provider responses into SmartPOS types.
 */
export interface IExchangeProvider {
  /**
   * Get account information and verify connectivity
   */
  getAccountInfo(): Promise<ProviderAccountInfo>;

  /**
   * Get current balance for an asset
   */
  getBalance(asset: string): Promise<ProviderBalance>;

  /**
   * Get a quote without executing
   */
  getQuote(request: CryptoQuoteRequest): Promise<CryptoQuoteResponse>;

  /**
   * Execute a BUY order
   */
  buy(request: CryptoOrderRequest): Promise<CryptoOrderResponse>;

  /**
   * Execute a SELL order
   */
  sell(request: CryptoOrderRequest): Promise<CryptoOrderResponse>;

  /**
   * Get status of an existing order
   */
  getOrder(orderId: string): Promise<CryptoOrderResponse>;

  /**
   * Cancel an order if supported
   */
  cancelOrder?(orderId: string): Promise<CryptoOrderResponse>;

  /**
   * Get live market price (optional convenience method)
   */
  getMarketPrice?(baseAsset: string, quoteAsset: string): Promise<Prisma.Decimal>;

  /**
   * Get provider trading rules/limits
   */
  getTradingRules?(symbol: string): Promise<Record<string, unknown>>;
}

/**
 * Possible errors from provider operations
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    public readonly message: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false
  ) {
    super(`[${provider}] ${code}: ${message}`);
  }
}

/**
 * Quote validation helpers
 */
export function validateQuote(quote: CryptoQuoteResponse, request: CryptoQuoteRequest): boolean {
  // Check if quote is not expired
  if (quote.expiresAt <= new Date()) {
    return false;
  }

  // Check if assets match
  if (quote.baseAsset !== request.baseAsset || quote.quoteAsset !== request.quoteAsset) {
    return false;
  }

  // Check if side matches
  if (quote.side !== request.side) {
    return false;
  }

  // Check if amount is reasonable (allow small variance due to fees)
  const inputVariance = quote.inputAmount.mul(new Prisma.Decimal("0.01")); // 1% variance allowed
  const minInput = request.amount.sub(inputVariance);
  const maxInput = request.amount.add(inputVariance);

  if (quote.inputAmount.lt(minInput) || quote.inputAmount.gt(maxInput)) {
    return false;
  }

  return true;
}

/**
 * Normalize provider order status to SmartPOS status
 */
export function normalizeOrderStatus(
  providerStatus: string,
  filledAmount?: Prisma.Decimal,
  requestedAmount?: Prisma.Decimal
): CryptoOrderResponse["status"] {
  const status = providerStatus.toUpperCase();

  // Map common provider statuses
  if (status === "FILLED" || status === "CLOSED" || status === "COMPLETED") {
    return "FILLED";
  }
  if (status === "PARTIALLY_FILLED" || status === "PARTIAL") {
    return "PARTIALLY_FILLED";
  }
  if (status === "OPEN" || status === "NEW" || status === "PLACED") {
    return "OPEN";
  }
  if (status === "CANCELLED" || status === "CANCEL" || status === "CANCELLED_ALL") {
    return "CANCELLED";
  }
  if (status === "REJECTED" || status === "INVALID" || status === "FAILED") {
    return "REJECTED";
  }
  if (status === "EXPIRED") {
    return "EXPIRED";
  }

  // If we have fill info, infer status
  if (filledAmount && requestedAmount) {
    if (filledAmount.eq(new Prisma.Decimal("0"))) {
      return "OPEN";
    }
    if (filledAmount.lt(requestedAmount)) {
      return "PARTIALLY_FILLED";
    }
    if (filledAmount.gte(requestedAmount)) {
      return "FILLED";
    }
  }

  return "PENDING";
}
