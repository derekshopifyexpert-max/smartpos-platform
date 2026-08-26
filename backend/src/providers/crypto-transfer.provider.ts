import axios, {
  AxiosError,
} from "axios";

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
  amount:
    | Prisma.Decimal
    | string
    | number;
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
  validateAddress(
    input: ValidateCryptoAddressInput,
  ): Promise<boolean>;

  sendTransaction(
    input: SendCryptoTransactionInput,
  ): Promise<CryptoTransferResult>;

  getTransaction(
    txHash: string,
  ): Promise<CryptoTransferResult>;

  getConfirmations(
    txHash: string,
  ): Promise<number>;
}

export class NotConfiguredCryptoTransferProvider
  implements CryptoTransferProvider
{
  async validateAddress(
    _input: ValidateCryptoAddressInput,
  ): Promise<boolean> {
    return false;
  }

  async sendTransaction(
    _input: SendCryptoTransactionInput,
  ): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message:
        "No crypto transfer provider is configured for SmartPOS settlement.",
    };
  }

  async getTransaction(
    _txHash: string,
  ): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message:
        "No crypto transfer provider is configured.",
    };
  }

  async getConfirmations(
    _txHash: string,
  ): Promise<number> {
    return 0;
  }
}

interface GenericHttpCryptoProviderOptions {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  metadata?: Record<string, unknown>;
}

interface GenericCryptoEndpoints {
  validateAddress?: string;
  sendTransaction?: string;
  getTransaction?: string;
  getConfirmations?: string;
}

export class GenericHttpCryptoProvider
  implements CryptoTransferProvider
{
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly metadata: Record<
    string,
    unknown
  >;

  constructor(
    opts: GenericHttpCryptoProviderOptions,
  ) {
    if (!opts.baseUrl?.trim()) {
      throw new Error(
        "Crypto transfer provider base URL is required.",
      );
    }

    this.baseUrl =
      opts.baseUrl.trim();

    this.apiKey =
      opts.apiKey?.trim() ||
      undefined;

    this.apiSecret =
      opts.apiSecret?.trim() ||
      undefined;

    this.metadata =
      opts.metadata ?? {};
  }

  private endpoints():
    GenericCryptoEndpoints {
    const endpoints =
      this.metadata.endpoints;

    return (
      endpoints &&
      typeof endpoints ===
        "object" &&
      !Array.isArray(endpoints)
        ? endpoints as GenericCryptoEndpoints
        : {}
    );
  }

  private authHeaders():
    Record<string, string> {
    const headers: Record<
      string,
      string
    > = {
      "Content-Type":
        "application/json",

      Accept:
        "application/json",
    };

    const authHeader =
      typeof this.metadata.authHeader ===
        "string" &&
      this.metadata.authHeader.trim()
        ? this.metadata.authHeader.trim()
        : "Authorization";

    const authScheme =
      typeof this.metadata.authScheme ===
        "string"
        ? this.metadata.authScheme.trim()
        : "Bearer";

    if (this.apiKey) {
      headers[authHeader] =
        authScheme
          ? `${authScheme} ${this.apiKey}`
          : this.apiKey;
    }

    if (this.apiSecret) {
      const secretHeader =
        typeof this.metadata.secretHeader ===
          "string" &&
        this.metadata.secretHeader.trim()
          ? this.metadata.secretHeader.trim()
          : undefined;

      if (secretHeader) {
        headers[secretHeader] =
          this.apiSecret;
      }
    }

    return headers;
  }

  private endpoint(
    name: keyof GenericCryptoEndpoints,
  ): string | undefined {
    const endpoint =
      this.endpoints()[name];

    return typeof endpoint ===
      "string" &&
      endpoint.trim()
      ? endpoint.trim()
      : undefined;
  }

  private buildUrl(
    endpoint: string,
    txHash?: string,
  ): string {
    const path =
      txHash !== undefined
        ? endpoint.replace(
            "{txHash}",
            encodeURIComponent(
              txHash,
            ),
          )
        : endpoint;

    return new URL(
      path,
      this.baseUrl.endsWith("/")
        ? this.baseUrl
        : `${this.baseUrl}/`,
    ).toString();
  }

  async validateAddress(
    input: ValidateCryptoAddressInput,
  ): Promise<boolean> {
    const endpoint =
      this.endpoint(
        "validateAddress",
      );

    if (!endpoint) {
      return false;
    }

    try {
      const response =
        await axios.post(
          this.buildUrl(endpoint),
          input,
          {
            headers:
              this.authHeaders(),
            timeout: 15_000,
          },
        );

      const data =
        response.data;

      return Boolean(
        data &&
          (
            data.success === true ||
            data.valid === true ||
            data.data?.valid === true
          ),
      );
    } catch {
      return false;
    }
  }

  async sendTransaction(
    input: SendCryptoTransactionInput,
  ): Promise<CryptoTransferResult> {
    const endpoint =
      this.endpoint(
        "sendTransaction",
      );

    if (!endpoint) {
      return {
        success: false,
        status: "NOT_CONFIGURED",
        message:
          "sendTransaction endpoint not configured.",
      };
    }

    try {
      const response =
        await axios.post(
          this.buildUrl(endpoint),
          {
            asset:
              input.asset,

            network:
              input.network,

            to:
              input.toAddress,

            amount:
              input.amount,

            reference:
              input.reference,

            ...(input.fromAddress
              ? {
                  from:
                    input.fromAddress,
                }
              : {}),
          },
          {
            headers:
              this.authHeaders(),
            timeout: 30_000,
          },
        );

      const data =
        response.data;

      const transactionHash =
        data?.txHash ??
        data?.transactionHash ??
        data?.data?.txHash ??
        data?.data?.transactionHash ??
        data?.hash ??
        undefined;

      return {
        success:
          data?.success === true ||
          (
            response.status >= 200 &&
            response.status < 300
          ),

        status:
          typeof data?.status ===
          "string"
            ? data.status
            : "submitted",

        message:
          typeof data?.message ===
          "string"
            ? data.message
            : "Crypto transaction submitted.",

        transactionHash:
          typeof transactionHash ===
          "string"
            ? transactionHash
            : undefined,

        blockExplorerUrl:
          typeof data?.explorerUrl ===
          "string"
            ? data.explorerUrl
            : typeof data?.data?.explorerUrl ===
              "string"
              ? data.data.explorerUrl
              : undefined,

        raw:
          data,
      };
    } catch (error) {
      return this.createTransferError(
        "Crypto transaction submission failed.",
        error,
      );
    }
  }

  async getTransaction(
    txHash: string,
  ): Promise<CryptoTransferResult> {
    const endpoint =
      this.endpoint(
        "getTransaction",
      );

    if (!endpoint) {
      return {
        success: false,
        status: "NOT_CONFIGURED",
        message:
          "getTransaction endpoint not configured.",
      };
    }

    if (!txHash?.trim()) {
      return {
        success: false,
        status: "INVALID_INPUT",
        message:
          "Transaction hash is required.",
      };
    }

    try {
      const response =
        await axios.get(
          this.buildUrl(
            endpoint,
            txHash,
          ),
          {
            headers:
              this.authHeaders(),
            timeout: 15_000,
          },
        );

      const data =
        response.data;

      return {
        success:
          response.status >= 200 &&
          response.status < 300,

        status:
          typeof data?.status ===
          "string"
            ? data.status
            : "unknown",

        message:
          typeof data?.message ===
          "string"
            ? data.message
            : "Transaction retrieved.",

        transactionHash:
          txHash,

        blockExplorerUrl:
          typeof data?.explorerUrl ===
          "string"
            ? data.explorerUrl
            : typeof data?.data?.explorerUrl ===
              "string"
              ? data.data.explorerUrl
              : undefined,

        raw:
          data,
      };
    } catch (error) {
      return this.createTransferError(
        "Failed to retrieve crypto transaction.",
        error,
        txHash,
      );
    }
  }

  async getConfirmations(
    txHash: string,
  ): Promise<number> {
    const endpoint =
      this.endpoint(
        "getConfirmations",
      );

    if (!endpoint) {
      return 0;
    }

    if (!txHash?.trim()) {
      return 0;
    }

    try {
      const response =
        await axios.get(
          this.buildUrl(
            endpoint,
            txHash,
          ),
          {
            headers:
              this.authHeaders(),
            timeout: 15_000,
          },
        );

      const data =
        response.data;

      const confirmations =
        data?.confirmations ??
        data?.data?.confirmations ??
        0;

      const numeric =
        Number(confirmations);

      return Number.isFinite(
        numeric,
      ) && numeric >= 0
        ? numeric
        : 0;
    } catch {
      return 0;
    }
  }

  private createTransferError(
    fallbackMessage: string,
    error: unknown,
    transactionHash?: string,
  ): CryptoTransferResult {
    if (
      error instanceof AxiosError
    ) {
      const providerMessage =
        error.response?.data?.message;

      return {
        success: false,

        status:
          error.response?.status
            ? String(
                error.response.status,
              )
            : "error",

        message:
          typeof providerMessage ===
          "string" &&
          providerMessage.trim()
            ? providerMessage.trim()
            : fallbackMessage,

        transactionHash,

        raw:
          error.response?.data,
      };
    }

    return {
      success: false,
      status: "error",
      message:
        error instanceof Error &&
        error.message
          ? error.message
          : fallbackMessage,
      transactionHash,
    };
  }
}