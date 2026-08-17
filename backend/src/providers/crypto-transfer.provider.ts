import { Prisma } from "@prisma/client";

export interface ValidateCryptoAddressInput {
  asset: string;
  network: string;
  address: string;
}

export interface SendCryptoTransactionInput {
  asset: string;
  network: string;
  fromAddress?: string;
  toAddress: string;
  amount: Prisma.Decimal | string | number;
  reference?: string;
}

export interface CryptoTransferResult {
  success: boolean;
  status: string;
  message: string;
  transactionHash?: string;
  blockExplorerUrl?: string;
  raw?: unknown;
}

export interface CryptoTransferProvider {
  validateAddress(input: ValidateCryptoAddressInput): Promise<boolean>;
  sendTransaction(input: SendCryptoTransactionInput): Promise<CryptoTransferResult>;
  getTransaction(txHash: string): Promise<CryptoTransferResult>;
  getConfirmations(txHash: string): Promise<number>;
}

export class NotConfiguredCryptoTransferProvider implements CryptoTransferProvider {
  async validateAddress(): Promise<boolean> {
    return false;
  }

  async sendTransaction(): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message:
        "No crypto transfer provider is configured for SmartPOS settlement.",
    };
  }

  async getTransaction(): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message: "No crypto transfer provider is configured.",
    };
  }

  async getConfirmations(): Promise<number> {
    return 0;
  }
}

// Generic HTTP-backed crypto provider adapter.
// Configure via `ExchangeProvider` DB `baseUrl`, `apiKey`, `apiSecret` and
// `metadata` to map endpoints. Metadata example:
// {
//   "endpoints": {
//     "validateAddress": "/v1/address/validate",
//     "sendTransaction": "/v1/tx/send",
//     "getTransaction": "/v1/tx/{txHash}",
//     "getConfirmations": "/v1/tx/{txHash}/confirmations"
//   },
//   "authHeader": "Authorization",
//   "authScheme": "Bearer"
// }
import axios from "axios";

export class GenericHttpCryptoProvider implements CryptoTransferProvider {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly metadata: any;

  constructor(opts: { baseUrl: string; apiKey?: string; apiSecret?: string; metadata?: any }) {
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.metadata = opts.metadata ?? {};
  }

  private authHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const authHeader = this.metadata.authHeader ?? "Authorization";
    const authScheme = this.metadata.authScheme ?? "Bearer";

    if (this.apiKey) {
      headers[authHeader] = `${authScheme} ${this.apiKey}`;
    }

    return headers;
  }

  private endpoint(name: string) {
    return (this.metadata.endpoints && this.metadata.endpoints[name]) || null;
  }

  async validateAddress(input: ValidateCryptoAddressInput): Promise<boolean> {
    const ep = this.endpoint("validateAddress");
    if (!ep) return false;

    try {
      const url = new URL(ep, this.baseUrl).toString();
      const response = await axios.post(url, input, { headers: this.authHeaders(), timeout: 15000 });
      // Accept many shapes: { success: true }, { valid: true }, { data: { valid: true } }
      const d = response.data;
      return Boolean(d && (d.success === true || d.valid === true || d.data?.valid === true));
    } catch (e) {
      return false;
    }
  }

  async sendTransaction(input: SendCryptoTransactionInput): Promise<CryptoTransferResult> {
    const ep = this.endpoint("sendTransaction");
    if (!ep) return {
      success: false,
      status: "NOT_CONFIGURED",
      message: "sendTransaction endpoint not configured",
    };

    try {
      const url = new URL(ep, this.baseUrl).toString();
      const payload = {
        asset: input.asset,
        network: input.network,
        to: input.toAddress,
        amount: input.amount,
        reference: input.reference,
        from: input.fromAddress,
      };

      const response = await axios.post(url, payload, { headers: this.authHeaders(), timeout: 30000 });
      const d = response.data;

      // Try extract tx hash from common positions
      const txHash = d?.txHash || d?.transactionHash || d?.data?.txHash || d?.data?.transactionHash || d?.hash || null;

      return {
        success: Boolean(d && (d.success === true || response.status >= 200 && response.status < 300)),
        status: d?.status ?? (response.status === 200 ? "submitted" : String(response.status)),
        message: d?.message ?? "",
        transactionHash: txHash,
        blockExplorerUrl: d?.explorerUrl ?? d?.data?.explorerUrl ?? undefined,
        raw: d,
      };
    } catch (err) {
      const anyErr = err as any;
      return {
        success: false,
        status: anyErr?.response?.status ? String(anyErr.response.status) : "error",
        message: anyErr?.message ?? "send failed",
        raw: anyErr?.response?.data ?? anyErr,
      };
    }
  }

  async getTransaction(_txHash: string): Promise<CryptoTransferResult> {
    const ep = this.endpoint("getTransaction");
    if (!ep) return { success: false, status: "NOT_CONFIGURED", message: "getTransaction endpoint not configured" };

    try {
      const path = ep.replace("{txHash}", encodeURIComponent(_txHash));
      const url = new URL(path, this.baseUrl).toString();
      const response = await axios.get(url, { headers: this.authHeaders(), timeout: 15000 });
      return { success: true, status: response.data?.status ?? "unknown", message: response.data?.message ?? "", transactionHash: _txHash, raw: response.data };
    } catch (err) {
      const anyErr = err as any;
      return { success: false, status: "error", message: anyErr?.message ?? "failed", raw: anyErr?.response?.data ?? anyErr };
    }
  }

  async getConfirmations(_txHash: string): Promise<number> {
    const ep = this.endpoint("getConfirmations");
    if (!ep) return 0;

    try {
      const path = ep.replace("{txHash}", encodeURIComponent(_txHash));
      const url = new URL(path, this.baseUrl).toString();
      const response = await axios.get(url, { headers: this.authHeaders(), timeout: 15000 });
      const d = response.data;
      return Number(d?.confirmations ?? d?.data?.confirmations ?? 0) || 0;
    } catch (e) {
      return 0;
    }
  }
}
