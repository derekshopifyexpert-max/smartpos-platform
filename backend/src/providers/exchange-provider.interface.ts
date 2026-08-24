import { Prisma } from "@prisma/client";

/**
 * Exchange Provider Interface
 *
 * Defines the normalized contract used by SmartPOS to communicate
 * with cryptocurrency liquidity/exchange providers.
 *
 * Provider-specific implementations must normalize their responses
 * into these SmartPOS types.
 */

/*
|--------------------------------------------------------------------------
| Quote Types
|--------------------------------------------------------------------------
*/

export interface CryptoQuoteResponse {
  /**
   * Provider-generated quote identifier.
   */
  quoteId: string;

  /**
   * Normalized provider name.
   */
  provider: string;

  /**
   * Trading/ramp symbol.
   *
   * Examples:
   * - USDT_NGN
   * - USDC_NGN
   * - BTC_USDT
   */
  symbol: string;

  /**
   * Asset being purchased/sold.
   */
  baseAsset: string;

  /**
   * Asset being used to price the transaction.
   */
  quoteAsset: string;

  /**
   * Transaction direction.
   */
  side: "BUY" | "SELL";

  /**
   * Unit price.
   */
  price: Prisma.Decimal;

  /**
   * Amount supplied by the customer.
   *
   * For BUY:
   *   amount paid in quote currency.
   *
   * For SELL:
   *   amount of base currency being sold.
   */
  inputAmount: Prisma.Decimal;

  /**
   * Amount received from the transaction.
   *
   * For BUY:
   *   amount of base asset received.
   *
   * For SELL:
   *   amount of quote asset received.
   */
  outputAmount: Prisma.Decimal;

  /**
   * Total provider fee.
   */
  fee: Prisma.Decimal;

  /**
   * Currency in which the fee is charged.
   */
  feeCurrency: string;

  /**
   * Fee as a percentage of the input amount.
   */
  feePercentage: Prisma.Decimal;

  /**
   * Exact expiration timestamp.
   */
  expiresAt: Date;

  /**
   * Remaining lifetime in seconds.
   */
  expiresIn: number;

  /**
   * Timestamp supplied/generated when the provider quote
   * was received.
   */
  providerTimestamp: Date;

  /**
   * Provider-specific normalized metadata.
   *
   * Must contain JSON-safe values only.
   */
  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Quote Request
|--------------------------------------------------------------------------
*/

export interface CryptoQuoteRequest {
  /**
   * Asset being purchased/sold.
   */
  baseAsset: string;

  /**
   * Asset used to price the transaction.
   */
  quoteAsset: string;

  /**
   * Transaction direction.
   */
  side: "BUY" | "SELL";

  /**
   * Requested amount.
   *
   * BUY:
   *   amount is denominated in quoteAsset.
   *
   * SELL:
   *   amount is denominated in baseAsset.
   */
  amount: Prisma.Decimal;

  /**
   * Optional client-side idempotency/reference identifier.
   */
  clientOrderId?: string;

  /**
   * Optional crypto network.
   *
   * Providers may require a network when the asset
   * is transferred on-chain.
   *
   * Examples:
   * - trc20
   * - erc20
   * - bep20
   */
  network?: string;
}

/*
|--------------------------------------------------------------------------
| Order Types
|--------------------------------------------------------------------------
*/

export interface CryptoOrderResponse {
  /**
   * Provider order identifier.
   */
  orderId: string;

  /**
   * Normalized provider name.
   */
  provider: string;

  /**
   * Trading pair.
   */
  symbol: string;

  /**
   * Base asset.
   */
  baseAsset: string;

  /**
   * Quote asset.
   */
  quoteAsset: string;

  /**
   * Transaction direction.
   */
  side: "BUY" | "SELL";

  /**
   * Normalized SmartPOS order status.
   */
  status:
    | "PENDING"
    | "OPEN"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELLED"
    | "REJECTED"
    | "FAILED"
    | "EXPIRED";

  /**
   * Amount originally requested.
   */
  requestedAmount: Prisma.Decimal;

  /**
   * Amount actually executed.
   */
  executedAmount: Prisma.Decimal;

  /**
   * Average execution price.
   */
  averagePrice: Prisma.Decimal;

  /**
   * Total provider fee.
   */
  totalFee: Prisma.Decimal;

  /**
   * Currency in which the fee was charged.
   */
  feeCurrency: string;

  /**
   * Optional human-readable status message.
   */
  statusMessage?: string;

  /**
   * Original quote identifier, when available.
   */
  quoteId?: string;

  /**
   * Provider order creation timestamp.
   */
  createdAt: Date;

  /**
   * Provider order update timestamp.
   */
  updatedAt: Date;

  /**
   * Provider-specific JSON-safe metadata.
   */
  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Order Request
|--------------------------------------------------------------------------
*/

export interface CryptoOrderRequest {
  /**
   * Base asset being traded.
   */
  baseAsset: string;

  /**
   * Quote asset.
   */
  quoteAsset: string;

  /**
   * Transaction direction.
   */
  side: "BUY" | "SELL";

  /**
   * Requested amount.
   */
  amount: Prisma.Decimal;

  /**
   * Optional SmartPOS/provider quote identifier.
   */
  quoteId?: string;

  /**
   * Optional client-side idempotency key.
   */
  clientOrderId?: string;

  /**
   * Optional limit price.
   */
  limitPrice?: Prisma.Decimal;
}

/*
|--------------------------------------------------------------------------
| Balance Types
|--------------------------------------------------------------------------
*/

export interface ProviderBalance {
  /**
   * Asset symbol.
   */
  asset: string;

  /**
   * Immediately available balance.
   */
  available: Prisma.Decimal;

  /**
   * Balance reserved/locked by open operations.
   */
  reserved: Prisma.Decimal;

  /**
   * Total balance.
   */
  total: Prisma.Decimal;
}

/*
|--------------------------------------------------------------------------
| Account Types
|--------------------------------------------------------------------------
*/

export interface ProviderAccountInfo {
  accountId: string;

  accountName?: string;

  status:
    | "ACTIVE"
    | "INACTIVE"
    | "RESTRICTED";

  balances?: ProviderBalance[];

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Provider Interface
|--------------------------------------------------------------------------
*/

export interface IExchangeProvider {
  /**
   * Get account information and verify connectivity.
   */
  getAccountInfo(): Promise<ProviderAccountInfo>;

  /**
   * Get the current balance for an asset.
   */
  getBalance(
    asset: string,
  ): Promise<ProviderBalance>;

  /**
   * Get a live provider quote.
   */
  getQuote(
    request: CryptoQuoteRequest,
  ): Promise<CryptoQuoteResponse>;

  /**
   * Execute a BUY order.
   */
  buy(
    request: CryptoOrderRequest,
  ): Promise<CryptoOrderResponse>;

  /**
   * Execute a SELL order.
   */
  sell(
    request: CryptoOrderRequest,
  ): Promise<CryptoOrderResponse>;

  /**
   * Get an existing provider order.
   */
  getOrder(
    orderId: string,
  ): Promise<CryptoOrderResponse>;

  /**
   * Optional order cancellation.
   */
  cancelOrder?(
    orderId: string,
  ): Promise<CryptoOrderResponse>;

  /**
   * Optional live market price lookup.
   */
  getMarketPrice?(
    baseAsset: string,
    quoteAsset: string,
  ): Promise<Prisma.Decimal>;

  /**
   * Optional provider trading rules/limits.
   */
  getTradingRules?(
    symbol: string,
  ): Promise<Record<string, unknown>>;
}

/*
|--------------------------------------------------------------------------
| Provider Error
|--------------------------------------------------------------------------
*/

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly details?: Record<
      string,
      unknown
    >,
    public readonly retryable: boolean = false,
  ) {
    super(
      `[${provider}] ${code}: ${message}`,
    );

    this.name = "ProviderError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Quote Validation
|--------------------------------------------------------------------------
*/

/**
 * Validate a provider quote against a requested transaction.
 *
 * Validation checks:
 * - quote has not expired
 * - base asset matches
 * - quote asset matches
 * - side matches
 * - quoted input amount is within 1% of requested amount
 */
export function validateQuote(
  quote: CryptoQuoteResponse,
  request: CryptoQuoteRequest,
): boolean {
  if (
    quote.expiresAt.getTime() <=
    Date.now()
  ) {
    return false;
  }

  if (
    quote.baseAsset.toUpperCase() !==
    request.baseAsset.toUpperCase()
  ) {
    return false;
  }

  if (
    quote.quoteAsset.toUpperCase() !==
    request.quoteAsset.toUpperCase()
  ) {
    return false;
  }

  if (
    quote.side !==
    request.side
  ) {
    return false;
  }

  /**
   * A 1% variance is allowed because provider fees,
   * rounding and provider-side pricing can cause small
   * differences between requested and quoted values.
   */
  const variance =
    quote.inputAmount.mul(
      new Prisma.Decimal("0.01"),
    );

  const minInput =
    request.amount.sub(
      variance,
    );

  const maxInput =
    request.amount.add(
      variance,
    );

  if (
    quote.inputAmount.lt(
      minInput,
    ) ||
    quote.inputAmount.gt(
      maxInput,
    )
  ) {
    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| Order Status Normalization
|--------------------------------------------------------------------------
*/

/**
 * Convert provider-specific order statuses into SmartPOS
 * normalized order statuses.
 */
export function normalizeOrderStatus(
  providerStatus: string,
  filledAmount?: Prisma.Decimal,
  requestedAmount?: Prisma.Decimal,
): CryptoOrderResponse["status"] {
  const status =
    providerStatus
      .trim()
      .toUpperCase();

  /*
  |--------------------------------------------------------------------------
  | Explicit terminal statuses
  |--------------------------------------------------------------------------
  */

  if (
    status === "FILLED" ||
    status === "CLOSED" ||
    status === "COMPLETED" ||
    status === "SUCCESS" ||
    status === "SUCCEEDED"
  ) {
    return "FILLED";
  }

  if (
    status ===
      "PARTIALLY_FILLED" ||
    status === "PARTIAL" ||
    status === "PARTIALLYFILLED"
  ) {
    return "PARTIALLY_FILLED";
  }

  if (
    status === "OPEN" ||
    status === "NEW" ||
    status === "PLACED" ||
    status === "PENDING"
  ) {
    return "OPEN";
  }

  if (
    status === "CANCELLED" ||
    status === "CANCELED" ||
    status === "CANCEL" ||
    status === "CANCELLED_ALL"
  ) {
    return "CANCELLED";
  }

  if (
    status === "REJECTED" ||
    status === "INVALID"
  ) {
    return "REJECTED";
  }

  if (
    status === "FAILED" ||
    status === "FAILURE"
  ) {
    return "FAILED";
  }

  if (
    status === "EXPIRED" ||
    status === "EXPIRING"
  ) {
    return "EXPIRED";
  }

  /*
  |--------------------------------------------------------------------------
  | Infer status from execution amount
  |--------------------------------------------------------------------------
  */

  if (
    filledAmount &&
    requestedAmount
  ) {
    if (
      filledAmount.eq(
        new Prisma.Decimal("0"),
      )
    ) {
      return "OPEN";
    }

    if (
      filledAmount.lt(
        requestedAmount,
      )
    ) {
      return "PARTIALLY_FILLED";
    }

    if (
      filledAmount.gte(
        requestedAmount,
      )
    ) {
      return "FILLED";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Unknown provider status
  |--------------------------------------------------------------------------
  */

  return "PENDING";
}