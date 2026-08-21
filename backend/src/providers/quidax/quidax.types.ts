import { Prisma } from "@prisma/client";
import type {
  CryptoOrderRequest,
  CryptoOrderResponse,
  CryptoQuoteRequest,
  CryptoQuoteResponse,
  IExchangeProvider,
  ProviderAccountInfo,
  ProviderBalance,
} from "../exchange-provider.interface.js";

export interface QuidaxConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;

  /**
   * Quidax Ramp Merchant API.
   *
   * Example:
   * https://ramp-be.quidax.io/api/v1
   */
  rampBaseUrl?: string;

  /**
   * Private key issued for the Quidax Ramp Merchant API.
   *
   * This is NOT the same credential as the Exchange API key.
   */
  rampPrivateKey?: string;

  /**
   * Used only for selecting the Ramp environment/configuration.
   */
  environment?: string;
}

export interface QuidaxWithdrawalRequest {
  asset: string;
  network: string;
  address: string;
  amount: string;
  idempotencyKey: string;
}

export interface QuidaxWithdrawal {
  id: string;
  status: string;
  txHash?: string;
  fee?: string;
  amount: string;
  asset: string;
  network?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuidaxBalanceRecord {
  asset: string;
  available: string;
  locked?: string;
  total?: string;
  updatedAt?: string;
}

/**
 * Normalized response from Quidax Ramp purchase quote.
 *
 * The actual Ramp API response can evolve, so the adapter keeps the
 * original response in metadata while normalizing the values required
 * by SmartPOS.
 */
export interface QuidaxRampQuote {
  quoteId: string;
  fiatCurrency: string;
  token: string;
  tokenNetwork: string;
  fiatAmount: string;
  tokenAmount: string;
  price?: string;
  fee?: string;
  expiresAt?: string;
  expiresIn?: number;
  raw: Record<string, unknown>;
}

export interface QuidaxProvider extends IExchangeProvider {
  getBalances(): Promise<QuidaxBalanceRecord[]>;

  getWithdrawalFee(
    asset: string,
    network: string
  ): Promise<{
    fee: string;
    minimum?: string;
    asset: string;
    network: string;
  }>;

  createWithdrawal(
    request: QuidaxWithdrawalRequest
  ): Promise<QuidaxWithdrawal>;

  getWithdrawal(
    withdrawalId: string
  ): Promise<QuidaxWithdrawal>;

  getAssets(): Promise<unknown[]>;

  getMarkets(): Promise<unknown[]>;

  getTrades(orderId: string): Promise<unknown[]>;

  /**
   * Get a fiat -> crypto quote through Quidax Ramp.
   */
  getRampQuote(
    request: CryptoQuoteRequest & {
      network?: string;
    }
  ): Promise<CryptoQuoteResponse>;
}

export type {
  CryptoOrderRequest,
  CryptoOrderResponse,
  CryptoQuoteRequest,
  CryptoQuoteResponse,
  ProviderAccountInfo,
  ProviderBalance,
};

export { Prisma };