// Exchange Quote - Real provider pricing
export interface ExchangeQuote {
  id: string;
  baseAsset: string;
  quoteAsset: string;
  amount: string; // Decimal as string
  quoteAmount: string; // Decimal as string
  rate: string; // Decimal as string
  side: "BUY" | "SELL";
  expiresAt: string; // ISO timestamp
  ttlSeconds: number;
  provider: string;
  fee?: string; // Provider fee
  metadata?: Record<string, any>;
  createdAt: string;
}

// Exchange Order - Real provider order
export interface ExchangeOrder {
  id: string;
  orderId: string; // Provider's order ID
  symbol: string;
  side: "BUY" | "SELL";
  amount: string; // Requested amount
  filledAmount: string; // Actual filled amount
  avgPrice: string;
  status: "PENDING" | "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED" | "FAILED";
  fee?: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    clientOrderId?: string;
    quoteId?: string;
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
  total: string;
  reserved?: string;
  provider?: string;
}

// Quote Request
export interface GetQuoteRequest {
  baseAsset: string;
  quoteAsset: string;
  side: "BUY" | "SELL";
  amount: string;
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

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
