import env from "../../config/env.js";
import { TRANSAK_PATHS } from "./transak.constants.js";
import { TransakConfigurationError } from "./transak.errors.js";
import { transakClient } from "./transak.client.js";
import type {
  TransakCapabilities,
  TransakCapabilityItem,
  TransakOrder,
  TransakQuote,
  TransakQuoteRequest,
  TransakWidgetSession,
  TransakWidgetSessionRequest,
} from "./transak.types.js";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function data(value: unknown): unknown {
  const root = record(value);
  return root.data ?? root.result ?? value;
}

function items(value: unknown): TransakCapabilityItem[] {
  const candidate = data(value);
  const list = Array.isArray(candidate) ? candidate : record(candidate).data;
  return Array.isArray(list)
    ? list.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => ({
        id: typeof item.id === "string" ? item.id : undefined,
        name: typeof item.name === "string" ? item.name : undefined,
        symbol: typeof item.symbol === "string" ? item.symbol : undefined,
        code: typeof item.code === "string" ? item.code : undefined,
        network: typeof item.network === "string" ? item.network : undefined,
        currency: typeof item.currency === "string" ? item.currency : undefined,
        countryCode: typeof item.countryCode === "string" ? item.countryCode : undefined,
        status: typeof item.status === "string" ? item.status : undefined,
        metadata: item,
      }))
    : [];
}

function requiredPath(value: string, name: string): string {
  if (!value.trim()) throw new TransakConfigurationError(`${name} is not configured on the backend.`);
  return value;
}

export class TransakProvider {
  async getCapabilities(): Promise<TransakCapabilities> {
    const [countries, fiatCurrencies, cryptoCurrencies, networks, paymentMethods] = await Promise.all([
      transakClient.request<unknown>({ method: "GET", url: TRANSAK_PATHS.countries }, { retrySafe: true }),
      transakClient.request<unknown>({ method: "GET", url: TRANSAK_PATHS.fiatCurrencies }, { retrySafe: true }),
      transakClient.request<unknown>({ method: "GET", url: TRANSAK_PATHS.cryptoCurrencies }, { retrySafe: true }),
      transakClient.request<unknown>({ method: "GET", url: TRANSAK_PATHS.networks }, { retrySafe: true }),
      transakClient.request<unknown>({ method: "GET", url: TRANSAK_PATHS.paymentMethods }, { retrySafe: true }),
    ]);

    return {
      countries: items(countries),
      fiatCurrencies: items(fiatCurrencies),
      cryptoCurrencies: items(cryptoCurrencies),
      networks: items(networks),
      paymentMethods: items(paymentMethods),
    };
  }

  async getQuote(request: TransakQuoteRequest): Promise<TransakQuote> {
    const response = await transakClient.request<unknown>({
      method: "POST",
      url: requiredPath(env.TRANSAK_QUOTE_PATH, "TRANSAK_QUOTE_PATH"),
      data: request,
    }, { userIp: request.userIp });
    const payload = record(data(response));
    return {
      quoteId: String(payload.quoteId ?? payload.id ?? ""),
      fiatAmount: String(payload.fiatAmount ?? request.fiatAmount),
      fiatCurrency: String(payload.fiatCurrency ?? request.fiatCurrency),
      cryptoAmount: payload.cryptoAmount == null ? undefined : String(payload.cryptoAmount),
      cryptoCurrency: String(payload.cryptoCurrency ?? request.cryptoCurrency),
      network: String(payload.network ?? request.network),
      rate: payload.rate == null ? undefined : String(payload.rate),
      fees: Array.isArray(payload.fees) ? payload.fees.map((fee) => {
        const item = record(fee);
        return { type: typeof item.type === "string" ? item.type : undefined, amount: item.amount == null ? undefined : String(item.amount), currency: typeof item.currency === "string" ? item.currency : undefined };
      }) : undefined,
      expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
      provider: "TRANSAK",
      metadata: payload,
    };
  }

  async verifyWallet(input: { walletAddress: string; cryptoCurrency: string; network: string; countryCode: string; userIp: string }): Promise<UnknownRecord> {
    const response = await transakClient.request<unknown>({
      method: "POST",
      url: requiredPath(env.TRANSAK_WALLET_VERIFICATION_PATH, "TRANSAK_WALLET_VERIFICATION_PATH"),
      data: input,
    }, { userIp: input.userIp });
    return record(data(response));
  }

  async createWidgetSession(request: TransakWidgetSessionRequest): Promise<TransakWidgetSession> {
    const response = await transakClient.request<unknown>({
      method: "POST",
      url: requiredPath(env.TRANSAK_WIDGET_SESSION_PATH, "TRANSAK_WIDGET_SESSION_PATH"),
      data: {
        ...request,
        referrerDomain: env.TRANSAK_REFERRER_DOMAIN || undefined,
      },
    }, { gateway: true, userIp: request.userIp });
    const payload = record(data(response));
    const widgetUrl = payload.widgetUrl ?? payload.url;
    const sessionId = payload.sessionId ?? payload.id;
    if (typeof widgetUrl !== "string" || typeof sessionId !== "string") {
      throw new Error("Transak secure widget session did not return a widget URL and session ID.");
    }
    return { widgetUrl, sessionId, expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined };
  }

  async getOrder(providerOrderId: string): Promise<TransakOrder> {
    const response = await transakClient.request<unknown>({
      method: "GET",
      url: `${requiredPath(env.TRANSAK_ORDER_PATH, "TRANSAK_ORDER_PATH")}/${encodeURIComponent(providerOrderId)}`,
    }, { retrySafe: true });
    const payload = record(data(response));
    return this.normalizeOrder(payload, providerOrderId);
  }

  private normalizeOrder(payload: UnknownRecord, fallbackId: string): TransakOrder {
    return {
      providerOrderId: String(payload.providerOrderId ?? payload.orderId ?? payload.id ?? fallbackId),
      status: String(payload.status ?? "PROVIDER_STATUS_UNKNOWN"),
      providerStatus: typeof payload.status === "string" ? payload.status : undefined,
      fiatAmount: payload.fiatAmount == null ? undefined : String(payload.fiatAmount),
      fiatCurrency: typeof payload.fiatCurrency === "string" ? payload.fiatCurrency : undefined,
      cryptoAmount: payload.cryptoAmount == null ? undefined : String(payload.cryptoAmount),
      cryptoCurrency: typeof payload.cryptoCurrency === "string" ? payload.cryptoCurrency : undefined,
      network: typeof payload.network === "string" ? payload.network : undefined,
      walletAddress: typeof payload.walletAddress === "string" ? payload.walletAddress : undefined,
      transactionHash: typeof payload.transactionHash === "string" ? payload.transactionHash : undefined,
      transactionLink: typeof payload.transactionLink === "string" ? payload.transactionLink : undefined,
      createdAt: typeof payload.createdAt === "string" ? payload.createdAt : undefined,
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : undefined,
      completedAt: typeof payload.completedAt === "string" ? payload.completedAt : undefined,
      failureReason: typeof payload.failureReason === "string" ? payload.failureReason : undefined,
      metadata: payload,
    };
  }
}

export const transakProvider = new TransakProvider();
