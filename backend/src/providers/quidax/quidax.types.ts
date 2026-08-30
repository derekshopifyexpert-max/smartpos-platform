import type {
  CryptoOrderRequest,
  CryptoOrderResponse,
  CryptoQuoteRequest,
  CryptoQuoteResponse,
  IExchangeProvider,
  ProviderAccountInfo,
  ProviderBalance,
} from "../exchange-provider.interface.js";

/*
|--------------------------------------------------------------------------
| Quidax Configuration
|--------------------------------------------------------------------------
*/

export interface QuidaxConfig {
  /**
   * Quidax Exchange API key.
   */
  apiKey: string;

  /**
   * Quidax Exchange API base URL.
   *
   * Example:
   * https://www.quidax.com/api/v1
   */
  baseUrl: string;

  /**
   * HTTP request timeout in milliseconds.
   */
  timeoutMs: number;

  /**
   * Quidax Ramp Merchant API base URL.
   *
   * Example:
   * https://ramp-be.quidax.io/api/v1
   */
  rampBaseUrl?: string;

  /**
   * Private key issued for the Quidax Ramp Merchant API.
   *
   * This is separate from the Exchange API key.
   */
  rampPrivateKey?: string;

  /**
   * Ramp environment/configuration selector.
   *
   * Examples may include:
   * - sandbox
   * - production
   */
  environment?: string;
}

/*
|--------------------------------------------------------------------------
| Quidax Wallet / Balance
|--------------------------------------------------------------------------
*/

export interface QuidaxBalanceRecord {
  /**
   * Quidax currency symbol.
   *
   * Example:
   * USDT
   * NGN
   * BTC
   */
  asset: string;

  /**
   * Available balance.
   */
  available: string;

  /**
   * Locked/reserved balance.
   */
  locked?: string;

  /**
   * Total balance.
   */
  total?: string;

  /**
   * Provider wallet update timestamp.
   */
  updatedAt?: string;
}

/*
|--------------------------------------------------------------------------
| Quidax Withdrawal
|--------------------------------------------------------------------------
*/

export interface QuidaxWithdrawalRequest {
  /**
   * Asset being withdrawn.
   */
  asset: string;

  /**
   * Blockchain/network used for the withdrawal.
   */
  network: string;

  /**
   * Destination wallet address.
   */
  address: string;

  /**
   * Withdrawal amount as a decimal string.
   */
  amount: string;

  /**
   * SmartPOS idempotency/reference key.
   */
  idempotencyKey: string;
}

export interface QuidaxWithdrawal {
  /**
   * Quidax withdrawal identifier.
   */
  id: string;

  /**
   * Provider withdrawal status.
   */
  status: string;

  /**
   * Blockchain transaction hash.
   */
  txHash?: string;

  /**
   * Withdrawal fee.
   */
  fee?: string;

  /**
   * Withdrawal amount.
   */
  amount: string;

  /**
   * Withdrawn asset.
   */
  asset: string;

  /**
   * Blockchain/network.
   */
  network?: string;

  /**
   * Provider creation timestamp.
   */
  createdAt?: string;

  /**
   * Provider update timestamp.
   */
  updatedAt?: string;
}

/*
|--------------------------------------------------------------------------
| Quidax Ramp Quote
|--------------------------------------------------------------------------
*/

/**
 * Normalized representation of a Quidax Ramp purchase quote.
 *
 * The Ramp API response may evolve. The provider adapter therefore
 * normalizes the fields SmartPOS needs while retaining the original
 * provider response in the quote metadata.
 */
export interface QuidaxRampQuote {
  /**
   * Provider quote identifier.
   */
  quoteId: string;

  /**
   * Fiat currency used to purchase the crypto asset.
   */
  fiatCurrency: string;

  /**
   * Crypto token being purchased.
   */
  token: string;

  /**
   * Blockchain/network for the token.
   */
  tokenNetwork: string;

  /**
   * Fiat amount supplied.
   */
  fiatAmount: string;

  /**
   * Crypto amount received.
   */
  tokenAmount: string;

  /**
   * Provider exchange price/rate.
   */
  price?: string;

  /**
   * Provider fee.
   */
  fee?: string;

  /**
   * Quote expiration timestamp.
   */
  expiresAt?: string;

  /**
   * Quote lifetime in seconds.
   */
  expiresIn?: number;

  /**
   * Original provider response.
   */
  raw: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Quidax Provider Contract
|--------------------------------------------------------------------------
*/

export interface QuidaxProvider
  extends IExchangeProvider {
  /**
   * Get all Quidax wallets/balances.
   */
  getBalances(): Promise<
    QuidaxBalanceRecord[]
  >;

  /**
   * Get the withdrawal fee for an asset/network.
   */
  getWithdrawalFee(
    asset: string,
    network: string,
  ): Promise<{
    fee: string;
    minimum?: string;
    asset: string;
    network: string;
  }>;

  /**
   * Create a crypto withdrawal.
   */
  createWithdrawal(
    request: QuidaxWithdrawalRequest,
  ): Promise<QuidaxWithdrawal>;

  /**
   * Get a previously-created withdrawal.
   */
  getWithdrawal(
    withdrawalId: string,
  ): Promise<QuidaxWithdrawal>;

  /**
   * Get normalized asset information derived from
   * Quidax markets.
   */
  getAssets(): Promise<unknown[]>;

  /**
   * Get Quidax markets.
   */
  getMarkets(): Promise<unknown[]>;

  /**
   * Get trades belonging to an order.
   */
  getTrades(
    orderId: string,
  ): Promise<unknown[]>;

  /**
   * Get a fiat-to-crypto Quidax Ramp purchase quote.
   *
   * The network is optional at the shared interface level,
   * but the Quidax Ramp implementation requires it at runtime.
   */
  getRampQuote(
    request: CryptoQuoteRequest & {
      network?: string;
    },
  ): Promise<CryptoQuoteResponse>;
}

/*
|--------------------------------------------------------------------------
| Shared Type Re-exports
|--------------------------------------------------------------------------
|
| These keep existing Quidax imports compatible without duplicating
| the shared provider definitions.
|--------------------------------------------------------------------------
*/

export type {
  CryptoOrderRequest,
  CryptoOrderResponse,
  CryptoQuoteRequest,
  CryptoQuoteResponse,
  ProviderAccountInfo,
  ProviderBalance,
};