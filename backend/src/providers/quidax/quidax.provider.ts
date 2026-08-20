import { Prisma } from "@prisma/client";
import {
  IExchangeProvider,
  normalizeOrderStatus,
  type CryptoOrderRequest,
  type CryptoOrderResponse,
  type CryptoQuoteRequest,
  type CryptoQuoteResponse,
  type ProviderAccountInfo,
  type ProviderBalance,
} from "../exchange-provider.interface.js";
import { QuidaxClient } from "./quidax.client.js";
import { QuidaxConfigurationError, QuidaxProviderError } from "./quidax.errors.js";
import type { QuidaxBalanceRecord, QuidaxConfig, QuidaxProvider, QuidaxWithdrawal, QuidaxWithdrawalRequest } from "./quidax.types.js";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const body = record(value);
  for (const key of ["data", "items", "results", "markets", "assets", "balances", "trades"]) {
    if (Array.isArray(body[key])) return body[key] as unknown[];
  }
  return [];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QuidaxProviderError(`Quidax response did not include ${field}.`, { code: "QUIDAX_INVALID_RESPONSE" });
  }
  return value;
}

function decimal(value: unknown, field: string): Prisma.Decimal {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new QuidaxProviderError(`Quidax response did not include ${field}.`, { code: "QUIDAX_INVALID_RESPONSE" });
  }
  return new Prisma.Decimal(String(value));
}

function bodyData(value: unknown): Record<string, unknown> {
  const body = record(value);
  return record(body.data ?? body);
}

export class QuidaxProviderAdapter implements QuidaxProvider {
  readonly name = "QUIDAX";
  private readonly client: QuidaxClient;
  private readonly config: QuidaxConfig;

  constructor(config: QuidaxConfig) {
    this.config = config;
    this.client = new QuidaxClient(config);
  }

  async getAccountInfo(): Promise<ProviderAccountInfo> {
    const balances = await this.getBalances();
    return {
      accountId: "UNAVAILABLE",
      accountName: "Quidax account unavailable",
      status: "ACTIVE",
      balances: balances.map((balance) => this.toBalance(balance)),
    };
  }

  async getBalances(): Promise<QuidaxBalanceRecord[]> {
    throw this.notVerified("provider balances");
  }

  async getBalance(asset: string): Promise<ProviderBalance> {
    throw this.notVerified(`balance for ${asset}`);
  }

  async getQuote(_request: CryptoQuoteRequest): Promise<CryptoQuoteResponse> {
    throw this.notVerified("quotes/market pricing");
  }

  async buy(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    throw this.notVerified("BUY orders");
  }

  async sell(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    throw this.notVerified("SELL orders");
  }

  private async createOrder(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    throw this.notVerified(`${request.side} order request body`);
  }

  async getOrder(orderId: string): Promise<CryptoOrderResponse> {
    throw this.notVerified(`order status for ${orderId}`);
  }

  async getTrades(orderId: string): Promise<unknown[]> {
    throw this.notVerified(`order fills for ${orderId}`);
  }

  async getAssets(): Promise<unknown[]> {
    throw this.notVerified("supported assets");
  }

  async getMarkets(): Promise<unknown[]> {
    throw this.notVerified("supported markets");
  }

  async getWithdrawalFee(asset: string, network: string) {
    throw this.notVerified(`withdrawal fee for ${asset} on ${network}`);
  }

  async createWithdrawal(request: QuidaxWithdrawalRequest): Promise<QuidaxWithdrawal> {
    throw this.notVerified(`withdrawal request for ${request.asset}`);
  }

  async getWithdrawal(withdrawalId: string): Promise<QuidaxWithdrawal> {
    throw this.notVerified(`withdrawal status for ${withdrawalId}`);
  }

  private notVerified(operation: string): QuidaxProviderError {
    return new QuidaxProviderError(
      `Quidax ${operation} is not enabled because its official endpoint, authentication, request, and response contract is not verified in this environment.`,
      { code: "QUIDAX_CONTRACT_NOT_VERIFIED", category: "CAPABILITY_NOT_VERIFIED" }
    );
  }

  private normalizeWithdrawal(value: Record<string, unknown>): QuidaxWithdrawal {
    return {
      id: requiredString(value.id ?? value.withdrawal_id, "withdrawal ID"),
      status: requiredString(value.status, "withdrawal status"),
      txHash: typeof value.tx_hash === "string" ? value.tx_hash : typeof value.txHash === "string" ? value.txHash : undefined,
      fee: typeof value.fee === "string" || typeof value.fee === "number" ? String(value.fee) : undefined,
      amount: requiredString(value.amount, "withdrawal amount"),
      asset: requiredString(value.currency ?? value.asset, "withdrawal asset"),
      network: typeof value.network === "string" ? value.network : undefined,
      createdAt: typeof value.created_at === "string" ? value.created_at : undefined,
      updatedAt: typeof value.updated_at === "string" ? value.updated_at : undefined,
    };
  }

  private normalizeOrder(value: Record<string, unknown>, request?: CryptoOrderRequest): CryptoOrderResponse {
    const orderId = requiredString(value.id ?? value.order_id, "order ID");
    const side = String(value.side ?? request?.side ?? "").toUpperCase() as "BUY" | "SELL";
    if (side !== "BUY" && side !== "SELL") throw new QuidaxProviderError("Quidax response did not include a valid order side.", { code: "QUIDAX_INVALID_RESPONSE" });
    const requestedAmount = decimal(value.volume ?? value.amount ?? request?.amount?.toString(), "requested amount");
    const executedRaw = value.executed_volume ?? value.filled_volume ?? value.filled_amount;
    const executedAmount = executedRaw === undefined ? new Prisma.Decimal("0") : decimal(executedRaw, "executed amount");
    const status = normalizeOrderStatus(String(value.status ?? ""), executedAmount, requestedAmount);
    const priceRaw = value.average_price ?? value.avg_price ?? value.price;
    const feeRaw = value.fee ?? value.total_fee;
    const market = value.market ?? value.symbol ?? (request ? `${request.baseAsset}_${request.quoteAsset}` : undefined);

    return {
      orderId,
      provider: "QUIDAX",
      symbol: requiredString(market, "market"),
      baseAsset: request?.baseAsset ?? String(value.base_asset ?? ""),
      quoteAsset: request?.quoteAsset ?? String(value.quote_asset ?? ""),
      side,
      status,
      requestedAmount,
      executedAmount,
      averagePrice: priceRaw === undefined ? new Prisma.Decimal("0") : decimal(priceRaw, "average price"),
      totalFee: feeRaw === undefined ? new Prisma.Decimal("0") : decimal(feeRaw, "fee"),
      feeCurrency: String(value.fee_currency ?? request?.quoteAsset ?? ""),
      createdAt: value.created_at ? new Date(String(value.created_at)) : new Date(),
      updatedAt: value.updated_at ? new Date(String(value.updated_at)) : new Date(),
      metadata: { rawStatus: value.status, unavailableFields: [priceRaw === undefined ? "averagePrice" : undefined, feeRaw === undefined ? "fee" : undefined].filter(Boolean) },
    };
  }

  private toBalance(balance: QuidaxBalanceRecord): ProviderBalance {
    const available = new Prisma.Decimal(balance.available);
    const reserved = balance.locked === undefined ? new Prisma.Decimal("0") : new Prisma.Decimal(balance.locked);
    const total = balance.total === undefined ? available.add(reserved) : new Prisma.Decimal(balance.total);
    return { asset: balance.asset, available, reserved, total };
  }
}
