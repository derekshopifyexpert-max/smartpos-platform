import type { TransakEnvironment } from "./transak.types.js";

export const TRANSAK_PROVIDER = "TRANSAK" as const;

export const TRANSAK_BASE_URLS: Record<TransakEnvironment, string> = {
  staging: "https://api-stg.transak.com",
  production: "https://api.transak.com",
};

export const TRANSAK_GATEWAY_BASE_URLS: Record<TransakEnvironment, string> = {
  staging: "https://api-gateway-stg.transak.com",
  production: "https://api-gateway.transak.com",
};

export const TRANSAK_PATHS = {
  refreshToken: "/partners/api/v2/refresh-token",
  countries: "/partners/api/v2/countries",
  fiatCurrencies: "/partners/api/v2/fiat-currencies",
  cryptoCurrencies: "/partners/api/v2/crypto-currencies",
  networks: "/partners/api/v2/networks",
  paymentMethods: "/partners/api/v2/payment-methods",
} as const;

export const TRANSAK_TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "CANCELED",
  "EXPIRED",
]);
