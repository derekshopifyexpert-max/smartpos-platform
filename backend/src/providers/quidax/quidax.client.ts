import axios, {
  AxiosInstance,
  AxiosRequestConfig,
} from "axios";

import {
  QuidaxConfigurationError,
  QuidaxProviderError,
} from "./quidax.errors.js";

import type { QuidaxConfig } from "./quidax.types.js";

export class QuidaxClient {
  private readonly http: AxiosInstance;
  private readonly rampHttp?: AxiosInstance;
  private readonly config: QuidaxConfig;

  constructor(config: QuidaxConfig) {
    if (!config.apiKey) {
      throw new QuidaxConfigurationError(
        "QUIDAX_API_KEY is not configured."
      );
    }

    if (!config.baseUrl) {
      throw new QuidaxConfigurationError(
        "QUIDAX_BASE_URL is not configured."
      );
    }

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

    /**
     * Quidax Ramp uses a DIFFERENT authentication mechanism:
     *
     * x-private-key: <Ramp private key>
     *
     * The Exchange API key must not be used for Ramp requests.
     */
    if (config.rampBaseUrl && config.rampPrivateKey) {
      this.rampHttp = axios.create({
        baseURL: config.rampBaseUrl.replace(/\/$/, ""),
        timeout: config.timeoutMs,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-private-key": config.rampPrivateKey,
        },
      });
    }
  }

  async request<T>(
    request: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response =
        await this.http.request<T>(request);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const providerBody =
          error.response?.data as
            | {
                message?: string;
                error?: string;
                code?: string;
              }
            | undefined;

        throw new QuidaxProviderError(
          providerBody?.message ||
            providerBody?.error ||
            "Quidax request failed.",
          {
            code:
              providerBody?.code ||
              error.code ||
              "QUIDAX_REQUEST_FAILED",

            status:
              error.response?.status,

            retryable:
              Boolean(
                !error.response ||
                  error.response.status === 429 ||
                  error.response.status >= 500
              ),
          }
        );
      }

      throw new QuidaxProviderError(
        "Quidax request failed."
      );
    }
  }

  /**
   * Make an authenticated request against Quidax Ramp.
   */
  async rampRequest<T>(
    request: AxiosRequestConfig
  ): Promise<T> {
    if (!this.rampHttp) {
      throw new QuidaxConfigurationError(
        "Quidax Ramp is not configured. Set QUIDAX_RAMP_BASE_URL and QUIDAX_PRIVATE_KEY."
      );
    }

    try {
      const response =
        await this.rampHttp.request<T>(request);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const providerBody =
          error.response?.data as
            | {
                message?: string;
                error?: string;
                code?: string;
              }
            | undefined;

        throw new QuidaxProviderError(
          providerBody?.message ||
            providerBody?.error ||
            "Quidax Ramp request failed.",
          {
            code:
              providerBody?.code ||
              error.code ||
              "QUIDAX_RAMP_REQUEST_FAILED",

            status:
              error.response?.status,

            retryable:
              Boolean(
                !error.response ||
                  error.response.status === 429 ||
                  error.response.status >= 500
              ),

            category:
              error.response?.status === 403
                ? "AUTHENTICATION_FAILED"
                : "RAMP_REQUEST_FAILED",
          }
        );
      }

      throw new QuidaxProviderError(
        "Quidax Ramp request failed.",
        {
          code: "QUIDAX_RAMP_REQUEST_FAILED",
          category: "RAMP_REQUEST_FAILED",
        }
      );
    }
  }

  path(
    template: string,
    values: Record<string, string> = {}
  ): string {
    return template.replace(
      /\{(\w+)\}/g,
      (_, key: string) => {
        const value = values[key];

        if (!value) {
          throw new QuidaxConfigurationError(
            `Missing path value for Quidax endpoint: ${key}`
          );
        }

        return encodeURIComponent(value);
      }
    );
  }
}