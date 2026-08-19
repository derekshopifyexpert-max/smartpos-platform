export interface TransakCapabilityItem {
  id?: string;
  name?: string;
  symbol?: string;
  code?: string;
  network?: string;
  currency?: string;
  countryCode?: string;
  status?: string;
}

export interface TransakCapabilities {
  countries: TransakCapabilityItem[];
  fiatCurrencies: TransakCapabilityItem[];
  cryptoCurrencies: TransakCapabilityItem[];
  networks: TransakCapabilityItem[];
  paymentMethods: TransakCapabilityItem[];
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
}

export interface TransakTransaction {
  id: string;
  partnerOrderId?: string | null;
  transakOrderId?: string | null;
  status: string;
  providerStatus?: string | null;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount?: string | null;
  cryptoCurrency: string;
  network: string;
  walletAddress: string;
  transactionHash?: string | null;
  transactionLink?: string | null;
  feeAmount?: string | null;
  feeCurrency?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}
