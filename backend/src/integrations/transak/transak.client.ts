import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import crypto from "node:crypto";
import env from "../../config/env.js";
import { TRANSAK_BASE_URLS, TRANSAK_GATEWAY_BASE_URLS } from "./transak.constants.js";
import { TransakConfigurationError, TransakProviderError } from "./transak.errors.js";
import { transakAuthService } from "./transak.auth.service.js";

function correlationId(): string {
  return `smartpos-${crypto.randomUUID()}`;
}

export class TransakClient {
  private readonly http: AxiosInstance;

  constructor() {
    const environment = env.TRANSAK_ENV || "staging";
    const baseURL = env.TRANSAK_API_BASE_URL || TRANSAK_BASE_URLS[environment];
    this.http = axios.create({ baseURL, timeout: 15_000 });
  }

  async request<T>(config: AxiosRequestConfig, options: { gateway?: boolean; userIp?: string; retrySafe?: boolean } = {}): Promise<T> {
    const environment = env.TRANSAK_ENV;
    if (!environment || !env.TRANSAK_API_KEY || !env.TRANSAK_API_SECRET) {
      throw new TransakConfigurationError(
        "Transak is not configured. Set TRANSAK_ENV, TRANSAK_API_KEY, and TRANSAK_API_SECRET on the backend."
      );
    }
    const token = await transakAuthService.getAccessToken();
    const baseURL = options.gateway
      ? env.TRANSAK_API_GATEWAY_BASE_URL || TRANSAK_GATEWAY_BASE_URLS[environment]
      : env.TRANSAK_API_BASE_URL || TRANSAK_BASE_URLS[environment];
    const headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
      "x-api-key": env.TRANSAK_API_KEY,
      "x-correlation-id": correlationId(),
      ...(options.userIp ? { "x-user-ip": options.userIp } : {}),
    };

    try {
      const response = await this.http.request<T>({ ...config, baseURL, headers });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const retryable = Boolean(options.retrySafe && (!statusCode || statusCode >= 500 || statusCode === 429));
        throw new TransakProviderError("Transak request failed.", { statusCode, retryable });
      }
      throw error;
    }
  }
}

export const transakClient = new TransakClient();
