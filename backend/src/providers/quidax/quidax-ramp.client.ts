import axios, { AxiosInstance } from "axios";
import { QuidaxConfigurationError, QuidaxProviderError } from "./quidax.errors.js";

export interface QuidaxRampCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface QuidaxRampWalletAddress {
  address: string;
  network: string;
}

export interface QuidaxOnRampRequest {
  fromCurrency: "ngn" | "ghs";
  toCurrency: "usdt" | "usdc" | "cngn";
  fromAmount: string;
  merchantReference: string;
  customer: QuidaxRampCustomer;
  walletAddress: QuidaxRampWalletAddress;
}

export interface QuidaxOnRampResponse {
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export default class QuidaxRampClient {
  private readonly http: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly privateKey: string,
    timeoutMs = 15000,
  ) {
    if (!baseUrl) {
      throw new QuidaxConfigurationError(
        "QUIDAX_RAMP_BASE_URL is not configured."
      );
    }

    if (!privateKey) {
      throw new QuidaxConfigurationError(
        "QUIDAX_PRIVATE_KEY is not configured."
      );
    }

    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ""),
      timeout: timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-private-key": privateKey,
      },
    });
  }

  async initiateOnRamp(
    request: QuidaxOnRampRequest,
  ): Promise<QuidaxOnRampResponse> {
    try {
      const response = await this.http.post(
        "/api/v1/merchants/custodial/on_ramp_transactions/initiate",
        {
          from_currency: request.fromCurrency,
          to_currency: request.toCurrency,
          from_amount: request.fromAmount,
          merchant_reference: request.merchantReference,
          customer: request.customer,
          wallet_address: request.walletAddress,
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const body = error.response?.data as
          | {
              message?: string;
              error?: string;
              code?: string;
            }
          | undefined;

        throw new QuidaxProviderError(
          body?.message ||
            body?.error ||
            "Quidax Ramp request failed.",
          {
            code:
              body?.code ||
              error.code ||
              "QUIDAX_RAMP_REQUEST_FAILED",
            status: error.response?.status,
            retryable:
              !error.response ||
              error.response.status === 429 ||
              error.response.status >= 500,
          },
        );
      }

      throw new QuidaxProviderError(
        "Quidax Ramp request failed.",
        {
          code: "QUIDAX_RAMP_REQUEST_FAILED",
        },
      );
    }
  }
}