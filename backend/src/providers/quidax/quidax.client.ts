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
    const apiKey = config.apiKey?.trim();
    const baseUrl = config.baseUrl?.trim();

    if (!apiKey) {
      throw new QuidaxConfigurationError(
        "QUIDAX_API_KEY is not configured."
      );
    }

    if (!baseUrl) {
      throw new QuidaxConfigurationError(
        "QUIDAX_BASE_URL is not configured."
      );
    }

    this.config = {
      ...config,
      apiKey,
      baseUrl,
    };

    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ""),
      timeout: config.timeoutMs || 15000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    /*
     * Quidax Ramp uses a separate authentication mechanism.
     *
     * Exchange API:
     *   Authorization: Bearer <api-key>
     *
     * Ramp:
     *   x-private-key: <ramp-private-key>
     */
    const rampBaseUrl = config.rampBaseUrl?.trim();
    const rampPrivateKey = config.rampPrivateKey?.trim();

    if (rampBaseUrl && rampPrivateKey) {
      this.rampHttp = axios.create({
        baseURL: rampBaseUrl.replace(/\/+$/, ""),
        timeout: config.timeoutMs || 15000,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-private-key": rampPrivateKey,
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
        const status =
          error.response?.status;

        const responseData =
          error.response?.data;

        let providerMessage =
          "Quidax request failed.";

        if (
          responseData &&
          typeof responseData === "object"
        ) {
          const body =
            responseData as Record<string, unknown>;

          if (
            typeof body.message === "string" &&
            body.message.trim()
          ) {
            providerMessage =
              body.message;
          } else if (
            typeof body.error === "string" &&
            body.error.trim()
          ) {
            providerMessage =
              body.error;
          }
        }

        if (status === 401) {
          throw new QuidaxProviderError(
            "Quidax rejected the API credentials (401 Unauthorized). Verify that QUIDAX_API_KEY is the current active Exchange API secret and that its IP restrictions allow this server.",
            {
              code: "QUIDAX_AUTHENTICATION_FAILED",
              status: 401,
              retryable: false,
              category:
                "AUTHENTICATION_FAILED",
            }
          );
        }

        if (status === 403) {
          throw new QuidaxProviderError(
            "Quidax denied this request (403 Forbidden). Check the API key permissions and IP restrictions in Quidax API Management.",
            {
              code: "QUIDAX_FORBIDDEN",
              status: 403,
              retryable: false,
              category:
                "AUTHENTICATION_FAILED",
            }
          );
        }

        throw new QuidaxProviderError(
          providerMessage,
          {
            code:
              typeof (
                responseData as any
              )?.code === "string"
                ? (responseData as any).code
                    : error.code ||
                      "QUIDAX_REQUEST_FAILED",

            status,

            retryable:
              !status ||
              status === 429 ||
              status >= 500,
          }
        );
      }

      throw new QuidaxProviderError(
        "Quidax request failed.",
        {
          code: "QUIDAX_REQUEST_FAILED",
          category:
            "QUIDAX_REQUEST_FAILED",
        }
      );
    }
  }

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
        await this.rampHttp.request<T>(
          request
        );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status =
          error.response?.status;

        const responseData =
          error.response?.data;

        let providerMessage =
          "Quidax Ramp request failed.";

        if (
          responseData &&
          typeof responseData === "object"
        ) {
          const body =
            responseData as Record<string, unknown>;

          if (
            typeof body.message === "string" &&
            body.message.trim()
          ) {
            providerMessage =
              body.message;
          } else if (
            typeof body.error === "string" &&
            body.error.trim()
          ) {
            providerMessage =
              body.error;
          }
        }

        if (status === 401) {
          throw new QuidaxProviderError(
            "Quidax Ramp rejected the private key (401 Unauthorized).",
            {
              code:
                "QUIDAX_RAMP_AUTHENTICATION_FAILED",
              status: 401,
              retryable: false,
              category:
                "AUTHENTICATION_FAILED",
            }
          );
        }

        if (status === 403) {
          throw new QuidaxProviderError(
            "Quidax Ramp denied this request (403 Forbidden).",
            {
              code:
                "QUIDAX_RAMP_FORBIDDEN",
              status: 403,
              retryable: false,
              category:
                "AUTHENTICATION_FAILED",
            }
          );
        }

        throw new QuidaxProviderError(
          providerMessage,
          {
            code:
              typeof (
                responseData as any
              )?.code === "string"
                ? (responseData as any).code
                    : error.code ||
                      "QUIDAX_RAMP_REQUEST_FAILED",

            status,

            retryable:
              !status ||
              status === 429 ||
              status >= 500,

            category:
              "RAMP_REQUEST_FAILED",
          }
        );
      }

      throw new QuidaxProviderError(
        "Quidax Ramp request failed.",
        {
          code:
            "QUIDAX_RAMP_REQUEST_FAILED",
          category:
            "RAMP_REQUEST_FAILED",
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