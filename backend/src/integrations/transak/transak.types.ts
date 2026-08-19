export type TransakEnvironment = "staging" | "production";

export interface TransakConfig {
  environment: TransakEnvironment;
  apiKey: string;
  apiSecret: string;
  apiBaseUrl: string;
  apiGatewayBaseUrl: string;
  referrerDomain?: string;
  webhookSecret?: string;
  widgetSessionPath?: string;
  quotePath?: string;
  walletVerificationPath?: string;
  orderPath?: string;
}

export interface TransakCapabilityItem {
  id?: string;
  name?: string;
  symbol?: string;
  code?: string;
  network?: string;
  currency?: string;
  countryCode?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface TransakCapabilities {
  countries: TransakCapabilityItem[];
  fiatCurrencies: TransakCapabilityItem[];
  cryptoCurrencies: TransakCapabilityItem[];
  networks: TransakCapabilityItem[];
  paymentMethods: TransakCapabilityItem[];
}

export interface TransakQuoteRequest {
  fiatCurrency: string;
  fiatAmount: string;
  cryptoCurrency: string;
  network: string;
  countryCode: string;
  paymentMethod?: string;
  walletAddress: string;
  userIp: string;
}

export interface TransakQuote {
  quoteId: string;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount?: string;
  cryptoCurrency: string;
  network: string;
  rate?: string;
  fees?: Array<{ type?: string; amount?: string; currency?: string }>;
  expiresAt?: string;
  provider: "TRANSAK";
  metadata?: Record<string, unknown>;
}

export interface TransakWidgetSessionRequest {
  fiatCurrency: string;
  fiatAmount: string;
  cryptoCurrency: string;
  network: string;
  walletAddress: string;
  countryCode: string;
  quoteId?: string;
  userIp: string;
}

export interface TransakWidgetSession {
  sessionId: string;
  widgetUrl: string;
  expiresAt?: string;
}

export interface TransakOrder {
  providerOrderId: string;
  status: string;
  fiatAmount?: string;
  fiatCurrency?: string;
  cryptoAmount?: string;
  cryptoCurrency?: string;
  network?: string;
  walletAddress?: string;
  transactionHash?: string;
  transactionLink?: string;
  fees?: Array<{ type?: string; amount?: string; currency?: string }>;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  failureReason?: string;
  providerStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface TransakWebhookEvent {
  eventId?: string;
  eventType: string;
  providerOrderId: string;
  status?: string;
  payload: Record<string, unknown>;
}
