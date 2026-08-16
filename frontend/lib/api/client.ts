import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosRequestConfig,
} from "axios";

import { useAuthStore } from "@/store/auth.store";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

function normalizeHeaders(
  headers: AxiosRequestConfig["headers"]
): AxiosHeaders {
  if (headers instanceof AxiosHeaders) {
    return headers;
  }

  const normalized = new AxiosHeaders();

  if (!headers) {
    return normalized;
  }

  if (typeof headers === "string") {
    return AxiosHeaders.from(headers);
  }

  Object.entries(headers).forEach(
    ([key, value]) => {
      if (value !== undefined) {
        normalized.set(key, value);
      }
    }
  );

  return normalized;
}

api.interceptors.request.use(
  (config) => {
    const token =
      useAuthStore.getState().token;

    const headers =
      normalizeHeaders(config.headers);

    if (token) {
      headers.set(
        "Authorization",
        `Bearer ${token}`
      );
    }

    config.headers = headers;

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      const currentPath =
        window.location.pathname;

      if (
        currentPath !== "/login" &&
        currentPath !== "/"
      ) {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  if (axios.isAxiosError(error)) {
    const responseData =
      error.response?.data;

    if (
      responseData &&
      typeof responseData === "object"
    ) {
      const data =
        responseData as Record<
          string,
          unknown
        >;

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
        data.error &&
        typeof data.error === "object"
      ) {
        const nested =
          data.error as Record<
            string,
            unknown
          >;

        if (
          typeof nested.message === "string" &&
          nested.message.trim()
        ) {
          return nested.message;
        }
      }

      if (Array.isArray(data.errors)) {
        const messages =
          data.errors
            .map((item) => {
              if (
                typeof item === "string"
              ) {
                return item;
              }

              if (
                item &&
                typeof item === "object"
              ) {
                const value =
                  item as Record<
                    string,
                    unknown
                  >;

                if (
                  typeof value.message ===
                    "string" &&
                  value.message.trim()
                ) {
                  return value.message;
                }

                if (
                  typeof value.error ===
                    "string" &&
                  value.error.trim()
                ) {
                  return value.error;
                }
              }

              return null;
            })
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            );

        if (messages.length > 0) {
          return messages.join(", ");
        }
      }

      if (
        typeof data.detail === "string" &&
        data.detail.trim()
      ) {
        return data.detail;
      }
    }

    if (
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      return "The request timed out. Please try again.";
    }

    if (!error.response) {
      return "Unable to reach SmartPOS. Check the connection and try again.";
    }

    if (error.message?.trim()) {
      return error.message;
    }
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export function isApiRequestError(
  error: unknown
): error is AxiosError {
  return axios.isAxiosError(error);
}

export function withAuth(
  config: AxiosRequestConfig = {}
): AxiosRequestConfig {
  const token =
    useAuthStore.getState().token;

  const headers =
    normalizeHeaders(config.headers);

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  return {
    ...config,
    headers,
  };
}