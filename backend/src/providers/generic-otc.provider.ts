import axios, { AxiosInstance } from "axios";

type QuoteRequest = {
  fiatAmount: number;
  fiatCurrency: string;
  asset: string;
  network: string;
  reference?: string;
};

type QuoteResponse = {
  providerQuoteId?: string;
  cryptoAmount: string;
  rate?: string;
  expiresAt?: string;
  raw?: any;
};

type ExecuteRequest = {
  providerQuoteId?: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  asset: string;
  network: string;
  destination: string;
  reference: string;
};

type ExecuteResponse = {
  success: boolean;
  providerTxId?: string;
  transactionHash?: string;
  raw?: any;
};

export default class GenericOtcProvider {
  private readonly client: AxiosInstance;
  private readonly metadata: any;

  constructor(opts: { baseUrl: string; apiKey?: string; apiSecret?: string; metadata?: any }) {
    this.client = axios.create({ baseURL: opts.baseUrl, timeout: 30000 });
    this.metadata = opts.metadata ?? {};

    if (opts.apiKey) {
      const authHeader = this.metadata.authHeader ?? "Authorization";
      const authScheme = this.metadata.authScheme ?? "Bearer";
      this.client.defaults.headers.common[authHeader] = `${authScheme} ${opts.apiKey}`;
    }
  }

  async requestQuote(input: QuoteRequest): Promise<QuoteResponse> {
    const ep = this.metadata.endpoints?.quote;
    if (!ep) throw new Error("quote endpoint not configured for provider");

    const url = ep;
    const payload = {
      amount: input.fiatAmount,
      currency: input.fiatCurrency,
      asset: input.asset,
      network: input.network,
      reference: input.reference,
    };

    const res = await this.client.post(url, payload);
    const d = res.data;

    return {
      providerQuoteId: d?.id ?? d?.quoteId,
      cryptoAmount: d?.cryptoAmount ?? d?.quoteAmount ?? d?.amount ?? "0",
      rate: d?.rate ?? undefined,
      expiresAt: d?.expiresAt ?? d?.validUntil ?? undefined,
      raw: d,
    };
  }

  async executeSwap(input: ExecuteRequest): Promise<ExecuteResponse> {
    const ep = this.metadata.endpoints?.execute;
    if (!ep) throw new Error("execute endpoint not configured for provider");

    const payload = {
      quoteId: input.providerQuoteId,
      amount: input.fiatAmount,
      currency: input.fiatCurrency,
      asset: input.asset,
      network: input.network,
      destination: input.destination,
      reference: input.reference,
    };

    const res = await this.client.post(ep, payload);
    const d = res.data;

    return {
      success: Boolean(d && (d.success === true || res.status >= 200 && res.status < 300)),
      providerTxId: d?.id ?? d?.providerTxId ?? d?.orderId,
      transactionHash: d?.txHash ?? d?.transactionHash ?? d?.hash,
      raw: d,
    };
  }

  async getStatus(providerTxId: string) {
    const ep = this.metadata.endpoints?.status;
    if (!ep) throw new Error("status endpoint not configured for provider");

    const path = ep.replace("{txId}", encodeURIComponent(providerTxId));
    const res = await this.client.get(path);
    return res.data;
  }
}
