import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { QuidaxConfigurationError, QuidaxProviderError } from "./quidax.errors.js";
import type { QuidaxConfig } from "./quidax.types.js";

export class QuidaxClient {
  private readonly http: AxiosInstance;
  private readonly config: QuidaxConfig;

  constructor(config: QuidaxConfig) {
    if (!config.apiKey) throw new QuidaxConfigurationError("QUIDAX_API_KEY is not configured.");
    if (!config.baseUrl) throw new QuidaxConfigurationError("QUIDAX_BASE_URL is not configured.");

    this.config = config;
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ""),
      timeout: config.timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
  }

  async request<T>(request: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.http.request<T>(request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const providerBody = error.response?.data as { message?: string; error?: string; code?: string } | undefined;
        throw new QuidaxProviderError(
          providerBody?.message || providerBody?.error || "Quidax request failed.",
          {
            code: providerBody?.code || error.code || "QUIDAX_REQUEST_FAILED",
            status: error.response?.status,
            retryable: Boolean(!error.response || error.response.status === 429 || error.response.status >= 500),
          }
        );
      }
      throw new QuidaxProviderError("Quidax request failed.");
    }
  }

  path(template: string, values: Record<string, string> = {}): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = values[key];
      if (!value) throw new QuidaxConfigurationError(`Missing path value for Quidax endpoint: ${key}`);
      return encodeURIComponent(value);
    });
  }
}
