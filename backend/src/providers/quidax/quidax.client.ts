import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from "axios";

import {
  QuidaxConfigurationError,
  QuidaxProviderError,
} from "./quidax.errors.js";

import type { QuidaxConfig } from "./quidax.types.js";

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function extractProviderMessage(
  responseData: unknown,
  fallback: string,
): string {
  if (
    responseData &&
    typeof responseData === "object" &&
    !Array.isArray(responseData)
  ) {
    const body =
      responseData as Record<string, unknown>;

    if (
      typeof body.message === "string" &&
      body.message.trim()
    ) {
      return body.message;
    }

    if (
      typeof body.error === "string" &&
      body.error.trim()
    ) {
      return body.error;
    }

    if (
      typeof body.detail === "string" &&
      body.detail.trim()
    ) {
      return body.detail;
    }

    if (
      body.data &&
      typeof body.data === "object" &&
      !Array.isArray(body.data)
    ) {
      const data =
        body.data as Record<string, unknown>;

      if (
        typeof data.message === "string" &&
        data.message.trim()
      ) {
        return data.message;
      }

      if (
        typeof data.error === "string" &&
        data.error.trim()
      ) {
        return data.error;
      }

      if (
        typeof data.detail === "string" &&
        data.detail.trim()
      ) {
        return data.detail;
      }
    }
  }

  if (typeof responseData === "string") {
    return responseData;
  }

  return fallback;
}

function extractProviderCode(
  responseData: unknown,
  fallback: string,
): string {
  if (
    responseData &&
    typeof responseData === "object" &&
    !Array.isArray(responseData)
  ) {
    const body =
      responseData as Record<string, unknown>;

    if (
      typeof body.code === "string" &&
      body.code.trim()
    ) {
      return body.code;
    }

    if (
      body.data &&
      typeof body.data === "object" &&
      !Array.isArray(body.data)
    ) {
      const data =
        body.data as Record<string, unknown>;

      if (
        typeof data.code === "string" &&
        data.code.trim()
      ) {
        return data.code;
      }
    }
  }

  return fallback;
}

export class QuidaxClient {
  private readonly http: AxiosInstance;

  private readonly rampHttp?: AxiosInstance;

  private readonly config: QuidaxConfig;

  constructor(config: QuidaxConfig) {
    const apiKey =
      config.apiKey?.trim();

    const baseUrl =
      config.baseUrl?.trim();

    if (!apiKey) {
      throw new QuidaxConfigurationError(
        "QUIDAX_API_KEY is not configured.",
      );
    }

    if (!baseUrl) {
      throw new QuidaxConfigurationError(
        "QUIDAX_BASE_URL is not configured.",
      );
    }

    this.config = {
      ...config,
      apiKey,
      baseUrl,
    };

    /*
     * Quidax Exchange API.
     *
     * Current Quidax Exchange API base URL:
     *
     * https://openapi.quidax.io/exchange-open-api/api/v1
     *
     * QUIDAX_BASE_URL should contain the complete
     * Exchange API base path.
     */
    const exchangeBaseUrl =
      cleanBaseUrl(baseUrl);

    this.http =
      axios.create({
        baseURL:
          exchangeBaseUrl,

        timeout:
          config.timeoutMs || 15000,

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        validateStatus:
          () => true,
      });

    /*
     * Quidax Ramp uses a separate
     * authentication mechanism.
     *
     * Exchange API:
     * Authorization: Bearer <secret>
     *
     * Ramp:
     * x-private-key: <ramp private key>
     *
     * QUIDAX_RAMP_BASE_URL is currently configured
     * as:
     *
     * https://ramp-be.quidax.io
     *
     * The Ramp API itself is under /api/v1.
     *
     * Therefore we intentionally keep the environment
     * variable as the host and add /api/v1 to the
     * Axios baseURL here.
     */
    const rampBaseUrl =
      config.rampBaseUrl?.trim();

    const rampPrivateKey =
      config.rampPrivateKey?.trim();

    if (
      rampBaseUrl &&
      rampPrivateKey
    ) {
      const cleanRampBaseUrl =
        cleanBaseUrl(rampBaseUrl);

      /*
       * Avoid accidentally producing:
       *
       * /api/v1/api/v1
       *
       * if somebody later supplies a base URL that
       * already contains /api/v1.
       */
      const rampApiBaseUrl =
        cleanRampBaseUrl.endsWith(
          "/api/v1",
        )
          ? cleanRampBaseUrl
          : `${cleanRampBaseUrl}/api/v1`;

      this.rampHttp =
        axios.create({
          baseURL:
            rampApiBaseUrl,

          timeout:
            config.timeoutMs || 15000,

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "x-private-key":
              rampPrivateKey,
          },

          validateStatus:
            () => true,
        });
    }
  }

  /**
   * Make an authenticated Quidax Exchange API request.
   *
   * Quidax uses:
   *
   * Authorization: Bearer <secret_key>
   */
  async request<T>(
    request: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response =
        await this.http.request<T>(
          request,
        );

      /*
       * Axios normally rejects non-2xx responses.
       * We intentionally use validateStatus above so
       * that we can convert Quidax's response into our
       * own QuidaxProviderError consistently.
       */
      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        this.throwExchangeError(
          response.status,
          response.data,
        );
      }

      return response.data;
    } catch (error) {
      if (
        error instanceof
        QuidaxProviderError
      ) {
        throw error;
      }

      if (
        error instanceof
        QuidaxConfigurationError
      ) {
        throw error;
      }

      if (
        axios.isAxiosError(error)
      ) {
        this.throwAxiosError(
          error,
          "Quidax request failed.",
        );
      }

      throw new QuidaxProviderError(
        "Quidax request failed.",
        {
          code:
            "QUIDAX_REQUEST_FAILED",

          category:
            "QUIDAX_REQUEST_FAILED",

          retryable:
            false,
        },
      );
    }
  }

  /**
   * Make an authenticated Quidax Ramp request.
   *
   * The configured Ramp Axios instance already has
   * /api/v1 in its baseURL.
   */
  async rampRequest<T>(
    request: AxiosRequestConfig,
  ): Promise<T> {
    if (!this.rampHttp) {
      throw new QuidaxConfigurationError(
        "Quidax Ramp is not configured. Set QUIDAX_RAMP_BASE_URL and QUIDAX_RAMP_PRIVATE_KEY.",
      );
    }

    try {
      const response =
        await this.rampHttp.request<T>(
          request,
        );

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        this.throwRampError(
          response.status,
          response.data,
        );
      }

      return response.data;
    } catch (error) {
      if (
        error instanceof
        QuidaxProviderError
      ) {
        throw error;
      }

      if (
        error instanceof
        QuidaxConfigurationError
      ) {
        throw error;
      }

      if (
        axios.isAxiosError(error)
      ) {
        this.throwAxiosError(
          error,
          "Quidax Ramp request failed.",
          true,
        );
      }

      throw new QuidaxProviderError(
        "Quidax Ramp request failed.",
        {
          code:
            "QUIDAX_RAMP_REQUEST_FAILED",

          category:
            "RAMP_REQUEST_FAILED",

          retryable:
            false,
        },
      );
    }
  }

  /**
   * Build a safe Quidax endpoint path.
   */
  path(
    template: string,
    values: Record<
      string,
      string
    > = {},
  ): string {
    return template.replace(
      /\{(\w+)\}/g,
      (
        _match,
        key: string,
      ) => {
        const value =
          values[key];

        if (
          value === undefined ||
          value === null ||
          value === ""
        ) {
          throw new QuidaxConfigurationError(
            `Missing path value for Quidax endpoint: ${key}`,
          );
        }

        return encodeURIComponent(
          value,
        );
      },
    );
  }

  /**
   * Convert an HTTP error from the
   * Exchange API into QuidaxProviderError.
   */
  private throwExchangeError(
    status: number,
    responseData: unknown,
  ): never {
    const message =
      extractProviderMessage(
        responseData,
        "Quidax request failed.",
      );

    const code =
      extractProviderCode(
        responseData,
        "QUIDAX_REQUEST_FAILED",
      );

    if (status === 401) {
      throw new QuidaxProviderError(
        "Quidax rejected the API credentials (401 Unauthorized). Verify that QUIDAX_API_KEY is the current active Quidax Exchange API secret, that QUIDAX_BASE_URL points to the correct Quidax Exchange API environment, and that any IP restrictions allow this backend server.",
        {
          code:
            "QUIDAX_AUTHENTICATION_FAILED",

          status: 401,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (status === 403) {
      throw new QuidaxProviderError(
        "Quidax denied this request (403 Forbidden). Check the API key permissions and IP restrictions in Quidax API Management.",
        {
          code:
            "QUIDAX_FORBIDDEN",

          status: 403,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (status === 404) {
      throw new QuidaxProviderError(
        `Quidax endpoint was not found (404). Check QUIDAX_BASE_URL and the requested API endpoint. Provider message: ${message}`,
        {
          code:
            code ===
            "QUIDAX_REQUEST_FAILED"
              ? "QUIDAX_NOT_FOUND"
              : code,

          status: 404,

          retryable:
            false,

          category:
            "NOT_FOUND",
        },
      );
    }

    if (status === 429) {
      throw new QuidaxProviderError(
        `Quidax rate limit exceeded (429). ${message}`,
        {
          code:
            "QUIDAX_RATE_LIMITED",

          status: 429,

          retryable:
            true,

          category:
            "RATE_LIMITED",
        },
      );
    }

    throw new QuidaxProviderError(
      message,
      {
        code,

        status,

        retryable:
          status >= 500,

        category:
          status >= 500
            ? "PROVIDER_ERROR"
            : "QUIDAX_REQUEST_FAILED",
      },
    );
  }

  /**
   * Convert an HTTP error from the
   * Ramp API into QuidaxProviderError.
   */
  private throwRampError(
    status: number,
    responseData: unknown,
  ): never {
    const message =
      extractProviderMessage(
        responseData,
        "Quidax Ramp request failed.",
      );

    const code =
      extractProviderCode(
        responseData,
        "QUIDAX_RAMP_REQUEST_FAILED",
      );

    if (status === 401) {
      throw new QuidaxProviderError(
        "Quidax Ramp rejected the private key (401 Unauthorized). Verify QUIDAX_RAMP_PRIVATE_KEY.",
        {
          code:
            "QUIDAX_RAMP_AUTHENTICATION_FAILED",

          status: 401,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (status === 403) {
      throw new QuidaxProviderError(
        "Quidax Ramp denied this request (403 Forbidden). Check the Ramp private key, merchant permissions, account capability, and any IP restrictions.",
        {
          code:
            "QUIDAX_RAMP_FORBIDDEN",

          status: 403,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (status === 404) {
      throw new QuidaxProviderError(
        `Quidax Ramp endpoint was not found (404). Check QUIDAX_RAMP_BASE_URL and the requested Ramp API endpoint. Provider message: ${message}`,
        {
          code:
            "QUIDAX_RAMP_NOT_FOUND",

          status: 404,

          retryable:
            false,

          category:
            "NOT_FOUND",
        },
      );
    }

    if (status === 429) {
      throw new QuidaxProviderError(
        `Quidax Ramp rate limit exceeded (429). ${message}`,
        {
          code:
            "QUIDAX_RAMP_RATE_LIMITED",

          status: 429,

          retryable:
            true,

          category:
            "RATE_LIMITED",
        },
      );
    }

    throw new QuidaxProviderError(
      message,
      {
        code,

        status,

        retryable:
          status >= 500,

        category:
          status >= 500
            ? "RAMP_PROVIDER_ERROR"
            : "RAMP_REQUEST_FAILED",
      },
    );
  }

  /**
   * Handle Axios transport failures.
   */
  private throwAxiosError(
    error: AxiosError,
    fallback: string,
    ramp = false,
  ): never {
    const status =
      error.response?.status;

    const responseData =
      error.response?.data;

    const message =
      extractProviderMessage(
        responseData,
        error.message ||
          fallback,
      );

    const code =
      extractProviderCode(
        responseData,
        error.code ||
          (
            ramp
              ? "QUIDAX_RAMP_REQUEST_FAILED"
              : "QUIDAX_REQUEST_FAILED"
          ),
      );

    if (
      ramp &&
      status === 401
    ) {
      throw new QuidaxProviderError(
        "Quidax Ramp rejected the private key (401 Unauthorized). Verify QUIDAX_RAMP_PRIVATE_KEY.",
        {
          code:
            "QUIDAX_RAMP_AUTHENTICATION_FAILED",

          status: 401,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (
      ramp &&
      status === 403
    ) {
      throw new QuidaxProviderError(
        "Quidax Ramp denied this request (403 Forbidden). Check the Ramp private key, merchant permissions, account capability, and any IP restrictions.",
        {
          code:
            "QUIDAX_RAMP_FORBIDDEN",

          status: 403,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (
      !ramp &&
      status === 401
    ) {
      throw new QuidaxProviderError(
        "Quidax rejected the API credentials (401 Unauthorized). Verify that QUIDAX_API_KEY is the current active Exchange API secret and that QUIDAX_BASE_URL points to the correct Quidax Exchange API environment.",
        {
          code:
            "QUIDAX_AUTHENTICATION_FAILED",

          status: 401,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (
      !ramp &&
      status === 403
    ) {
      throw new QuidaxProviderError(
        "Quidax denied this request (403 Forbidden). Check the API key permissions and IP restrictions in Quidax API Management.",
        {
          code:
            "QUIDAX_FORBIDDEN",

          status: 403,

          retryable:
            false,

          category:
            "AUTHENTICATION_FAILED",
        },
      );
    }

    if (
      ramp &&
      status === 404
    ) {
      throw new QuidaxProviderError(
        `Quidax Ramp endpoint was not found (404). Check QUIDAX_RAMP_BASE_URL and the requested Ramp API endpoint. Provider message: ${message}`,
        {
          code:
            "QUIDAX_RAMP_NOT_FOUND",

          status: 404,

          retryable:
            false,

          category:
            "NOT_FOUND",
        },
      );
    }

    if (
      !ramp &&
      status === 404
    ) {
      throw new QuidaxProviderError(
        `Quidax endpoint was not found (404). Check QUIDAX_BASE_URL and the requested API endpoint. Provider message: ${message}`,
        {
          code:
            "QUIDAX_NOT_FOUND",

          status: 404,

          retryable:
            false,

          category:
            "NOT_FOUND",
        },
      );
    }

    throw new QuidaxProviderError(
      message,
      {
        code,

        status,

        retryable:
          !status ||
          status === 429 ||
          status >= 500,

        category:
          ramp
            ? "RAMP_REQUEST_FAILED"
            : "QUIDAX_REQUEST_FAILED",
      },
    );
  }
}