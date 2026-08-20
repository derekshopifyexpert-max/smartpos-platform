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

function apiData(value: unknown): unknown {
  const body = record(value);
  if (body.status === "error") {
    const details = record(body.data);
    throw new QuidaxProviderError(
      String(details.message ?? body.message ?? "Quidax request failed."),
      { code: String(details.code ?? "QUIDAX_API_ERROR") },
    );
  }
  return body.data ?? value;
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
    const response = await this.client.request<unknown>({ method: "GET", url: "/users/me/wallets" });
    const data = apiData(response);
    if (!Array.isArray(data)) throw new QuidaxProviderError("Quidax wallets response was malformed.", { code: "QUIDAX_INVALID_RESPONSE" });
    return data.map((item) => {
      const value = record(item);
      return {
        asset: requiredString(value.currency, "wallet currency"),
        available: requiredString(value.balance, "wallet balance"),
        locked: typeof value.locked === "string" ? value.locked : undefined,
        total: typeof value.balance === "string" ? value.balance : undefined,
        updatedAt: typeof value.updated_at === "string" ? value.updated_at : undefined,
      };
    });
  }

  async getBalance(asset: string): Promise<ProviderBalance> {
    const balances = await this.getBalances();
    const balance = balances.find((item) => item.asset.toUpperCase() === asset.toUpperCase());
    if (!balance) throw new QuidaxProviderError(`Quidax wallet for ${asset} was not found.`, { code: "ASSET_UNSUPPORTED" });
    return this.toBalance(balance);
  }

  async getQuote(_request: CryptoQuoteRequest): Promise<CryptoQuoteResponse> {
    throw new QuidaxProviderError(
      "The documented fiat-to-crypto quote uses Quidax Ramp Merchant API, which requires a separate ramp merchant credential. The exchange API key cannot be assumed to authorize that flow.",
      { code: "QUIDAX_RAMP_CONFIGURATION_REQUIRED", category: "CAPABILITY_NOT_CONFIGURED" },
    );
  }

  async buy(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    return this.createOrder({ ...request, side: "BUY" });
  }

  async sell(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    return this.createOrder({ ...request, side: "SELL" });
  }

  private async createOrder(request: CryptoOrderRequest): Promise<CryptoOrderResponse> {
    const response = await this.client.request<unknown>({
      method: "POST",
      url: "/users/me/orders",
      data: {
        market: `${request.baseAsset}${request.quoteAsset}`.toLowerCase(),
        side: request.side.toLowerCase(),
        ord_type: request.limitPrice ? "limit" : "market",
        price: request.limitPrice?.toString(),
        volume: request.amount.toString(),
      },
    });
    return this.normalizeOrder(record(apiData(response)), request);
  }

  async getOrder(orderId: string): Promise<CryptoOrderResponse> {
    const response = await this.client.request<unknown>({ method: "GET", url: `/users/me/orders/${encodeURIComponent(orderId)}` });
    return this.normalizeOrder(record(apiData(response)));
  }

  async getTrades(orderId: string): Promise<unknown[]> {
    const order = await this.getOrder(orderId);
    const trades = order.metadata?.trades;
    return Array.isArray(trades) ? trades : [];
  }

  async getAssets(): Promise<unknown[]> {
    const markets = await this.getMarkets();
    const assets = new Map<string, { symbol: string; markets: string[] }>();
    for (const market of markets) {
      const value = record(market);
      const base = typeof value.base_unit === "string" ? value.base_unit : undefined;
      if (!base) continue;
      const existing = assets.get(base) ?? { symbol: base, markets: [] };
      if (typeof value.id === "string") existing.markets.push(value.id);
      assets.set(base, existing);
    }
    return [...assets.values()];
  }

  async getMarkets(): Promise<unknown[]> {
    const response = await this.client.request<unknown>({ method: "GET", url: "/markets" });
    const data = apiData(response);
    if (!Array.isArray(data)) throw new QuidaxProviderError("Quidax markets response was malformed.", { code: "QUIDAX_INVALID_RESPONSE" });
    return data;
  }

  async getWithdrawalFee(asset: string, network: string) {
    const response = await this.client.request<unknown>({
      method: "GET",
      url: `/users/me/fee_rule?currency=${encodeURIComponent(asset.toLowerCase())}&amount=0&network=${encodeURIComponent(network.toLowerCase())}`,
    });
    const value = record(apiData(response));
    return { asset, network, fee: String(value.fee), minimum: undefined };
  }

  async createWithdrawal(request: QuidaxWithdrawalRequest): Promise<QuidaxWithdrawal> {
    const response = await this.client.request<unknown>({
      method: "POST",
      url: "/users/me/withdraws",
      data: {
        currency: request.asset.toLowerCase(),
        amount: request.amount,
        fund_uid: request.address,
        network: request.network,
        reference: request.idempotencyKey,
      },
    });
    return this.normalizeWithdrawal(record(apiData(response)));
  }

  async getWithdrawal(withdrawalId: string): Promise<QuidaxWithdrawal> {
    const response = await this.client.request<unknown>({ method: "GET", url: `/users/me/withdraws/${encodeURIComponent(withdrawalId)}` });
    return this.normalizeWithdrawal(record(apiData(response)));
  }

  private normalizeWithdrawal(value: Record<string, unknown>): QuidaxWithdrawal {
    return {
      id: requiredString(value.id, "withdrawal ID"),
      status: requiredString(value.status, "withdrawal status"),
      txHash: typeof value.txId === "string" ? value.txId : undefined,
      fee: typeof value.fee === "string" || typeof value.fee === "number" ? String(value.fee) : undefined,
      amount: requiredString(value.amount, "withdrawal amount"),
      asset: requiredString(value.currency, "withdrawal asset"),
      network: typeof value.network === "string" ? value.network : undefined,
      createdAt: typeof value.created_at === "string" ? value.created_at : undefined,
      updatedAt: typeof value.updated_at === "string" ? value.updated_at : undefined,
    };
  }

  private normalizeOrder(value: Record<string, unknown>, request?: CryptoOrderRequest): CryptoOrderResponse {
    const orderId = requiredString(value.id, "order ID");
    const side = String(value.side ?? request?.side ?? "").toUpperCase() as "BUY" | "SELL";
    if (side !== "BUY" && side !== "SELL") throw new QuidaxProviderError("Quidax response did not include a valid order side.", { code: "QUIDAX_INVALID_RESPONSE" });
    const volume = record(value.volume);
    const originVolume = record(value.origin_volume);
    const executedVolume = record(value.executed_volume);
    const price = record(value.price);
    const avgPrice = record(value.avg_price);
    const requestedAmount = decimal(originVolume.amount ?? volume.amount ?? request?.amount?.toString(), "requested amount");
    const executedRaw = executedVolume.amount;
    const executedAmount = executedRaw === undefined ? new Prisma.Decimal("0") : decimal(executedRaw, "executed amount");
    const status = normalizeOrderStatus(String(value.status ?? ""), executedAmount, requestedAmount);
    const priceRaw = avgPrice.amount ?? price.amount;
    const feeRaw = value.fee ?? value.total_fee;
    const market = value.market ?? value.symbol ?? (request ? `${request.baseAsset}_${request.quoteAsset}` : undefined);

    return {
      orderId,
      provider: "QUIDAX",
      symbol: requiredString(typeof market === "object" ? record(market).id : market, "market"),
      baseAsset: request?.baseAsset ?? String(record(market).base_unit ?? ""),
      quoteAsset: request?.quoteAsset ?? String(record(market).quote_unit ?? ""),
      side,
      status,
      requestedAmount,
      executedAmount,
      averagePrice: priceRaw === undefined ? new Prisma.Decimal("0") : decimal(priceRaw, "average price"),
      totalFee: feeRaw === undefined ? new Prisma.Decimal("0") : decimal(feeRaw, "fee"),
      feeCurrency: String(value.fee_currency ?? request?.quoteAsset ?? ""),
      createdAt: value.created_at ? new Date(String(value.created_at)) : new Date(),
      updatedAt: value.updated_at ? new Date(String(value.updated_at)) : new Date(),
      metadata: { rawStatus: value.status, trades: value.trades },
    };
  }

  private toBalance(balance: QuidaxBalanceRecord): ProviderBalance {
    const available = new Prisma.Decimal(balance.available);
    const reserved = balance.locked === undefined ? new Prisma.Decimal("0") : new Prisma.Decimal(balance.locked);
    const total = balance.total === undefined ? available.add(reserved) : new Prisma.Decimal(balance.total);
    return { asset: balance.asset, available, reserved, total };
  }
}
