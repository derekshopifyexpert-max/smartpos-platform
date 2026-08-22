// Exchange Quote - Real provider pricing
export interface ExchangeQuote {
  /**
   * Provider quote identifier.
   *
   * The backend/provider uses quoteId.
   */
  quoteId: string;

  /**
   * Provider name, e.g. QUIDAX.
   */
  provider: string;

  /**
   * Trading pair.
   */
  symbol: string;

  baseAsset: string;
  quoteAsset: string;

  side: "BUY" | "SELL";

  /**
   * Price expressed as quote currency per base asset.
   */
  price: string;

  /**
   * Amount supplied to the provider.
   *
   * For BUY this is the fiat input amount.
   * For SELL this is the crypto input amount.
   */
  inputAmount: string;

  /**
   * Amount received from the provider.
   *
   * For BUY this is the crypto output.
   * For SELL this is the fiat output.
   */
  outputAmount: string;

  /**
   * Provider fee.
   */
  fee: string;

  /**
   * Currency in which the fee is charged.
   */
  feeCurrency: string;

  /**
   * Fee as a percentage of the input amount.
   */
  feePercentage: string;

  /**
   * ISO timestamp.
   */
  expiresAt: string;

  /**
   * Remaining quote lifetime in seconds when generated.
   */
  expiresIn: number;

  /**
   * ISO timestamp representing provider response time.
   */
  providerTimestamp: string;

  /**
   * Backend/provider metadata.
   */
  metadata?: Record<string, unknown>;
}

// Real provider order
export interface ExchangeOrder {
  orderId: string;

  provider: string;

  symbol: string;

  baseAsset: string;

  quoteAsset: string;

  side: "BUY" | "SELL";

  status:
    | "PENDING"
    | "OPEN"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "EXPIRED"
    | "FAILED";

  requestedAmount: string;

  executedAmount: string;

  averagePrice: string;

  totalFee: string;

  feeCurrency: string;

  createdAt: string;

  updatedAt: string;

  metadata?: {
    rawStatus?: string;
    trades?: unknown;
    clientOrderId?: string;
    quoteId?: string;
    [key: string]: unknown;
  };
}

// Exchange Trade - Individual fills
export interface ExchangeTrade {
  id: string;
  orderId: string;
  price: string;
  amount: string;
  fee: string;
  timestamp: string;
}

// Provider Balance
export interface ProviderBalance {
  asset: string;
  available: string;
  reserved: string;
  total: string;
}

// Quote Request
export interface GetQuoteRequest {
  baseAsset: string;
  quoteAsset: string;
  side: "BUY" | "SELL";
  amount: string;

  /**
   * Required by the Quidax Ramp BUY quote flow.
   */
  network?: string;

  ttlSeconds?: number;
}

// BUY/SELL Order Request
export interface ExecuteOrderRequest {
  baseAsset: string;
  quoteAsset: string;
  amount: string;
  quoteId?: string;
  clientOrderId?: string;
  limitPrice?: string;
}

// Blockchain Transaction - Settlement on-chain
export interface BlockchainTransaction {
  id: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  currency: string;
  fee?: string;
  gasPrice?: string;
  blockNumber?: number;
  confirmations: number;
  status:
    | "PENDING"
    | "BROADCASTED"
    | "CONFIRMING"
    | "CONFIRMED"
    | "REVERTED"
    | "FAILED"
    | "SETTLED";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// Settlement Status
export interface SettlementStatus {
  id: string;
  exchangeOrderId: string;
  blockchainTxId?: string;
  status:
    | "PENDING"
    | "BROADCASTED"
    | "CONFIRMING"
    | "CONFIRMED"
    | "FAILED"
    | "SETTLED";

  destinationWallet?: {
    id: string;
    name: string;
    address: string;
    network: string;
    asset: string;
  };

  amount: string;

  blockchainConfirmations?: number;

  requiredConfirmations?: number;

  transactionHash?: string;

  createdAt: string;

  updatedAt: string;
}

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}