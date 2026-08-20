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

export interface QuidaxProvider extends IExchangeProvider {
  getBalances(): Promise<QuidaxBalanceRecord[]>;
  getWithdrawalFee(asset: string, network: string): Promise<{ fee: string; minimum?: string; asset: string; network: string }>;
  createWithdrawal(request: QuidaxWithdrawalRequest): Promise<QuidaxWithdrawal>;
  getWithdrawal(withdrawalId: string): Promise<QuidaxWithdrawal>;
  getAssets(): Promise<unknown[]>;
  getMarkets(): Promise<unknown[]>;
  getTrades(orderId: string): Promise<unknown[]>;
}

export type { CryptoOrderRequest, CryptoOrderResponse, CryptoQuoteRequest, CryptoQuoteResponse, ProviderAccountInfo, ProviderBalance };
export { Prisma };
