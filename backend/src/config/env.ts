import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  NODE_ENV:
    process.env.NODE_ENV ||
    "development",

  PORT:
    Number(
      process.env.PORT ||
      4000
    ),

  HOST:
    process.env.HOST ||
    "0.0.0.0",

  TRUST_PROXY:
    process.env.TRUST_PROXY === "true",

  DATABASE_URL:
    required(
      "DATABASE_URL"
    ),

  JWT_SECRET:
    required(
      "JWT_SECRET"
    ),

  JWT_REFRESH_SECRET:
    required(
      "JWT_REFRESH_SECRET"
    ),

  JWT_EXPIRES_IN:
    process.env.JWT_EXPIRES_IN ||
    "7d",

  JWT_ACCESS_EXPIRES_IN:
    process.env.JWT_ACCESS_EXPIRES_IN ||
    "15m",

  JWT_REFRESH_EXPIRES_IN:
    process.env.JWT_REFRESH_EXPIRES_IN ||
    "30d",

  REDIS_URL:
    required(
      "REDIS_URL"
    ),

  STRIPE_SECRET_KEY:
    process.env.STRIPE_SECRET_KEY ||
    "",

  PAYSTACK_SECRET_KEY:
    process.env.PAYSTACK_SECRET_KEY ||
    "",

  TRANSAK_ENV:
    process.env.TRANSAK_ENV === "production" ? "production" as const : process.env.TRANSAK_ENV === "staging" ? "staging" as const : undefined,

  TRANSAK_API_KEY:
    process.env.TRANSAK_API_KEY ||
    "",

  TRANSAK_API_SECRET:
    process.env.TRANSAK_API_SECRET ||
    "",

  TRANSAK_ACCESS_TOKEN:
    process.env.TRANSAK_ACCESS_TOKEN ||
    "",

  TRANSAK_API_BASE_URL:
    process.env.TRANSAK_API_BASE_URL ||
    "",

  TRANSAK_API_GATEWAY_BASE_URL:
    process.env.TRANSAK_API_GATEWAY_BASE_URL ||
    "",

  TRANSAK_REFERRER_DOMAIN:
    process.env.TRANSAK_REFERRER_DOMAIN ||
    "",

  TRANSAK_WEBHOOK_SECRET:
    process.env.TRANSAK_WEBHOOK_SECRET ||
    "",

  TRANSAK_WIDGET_SESSION_PATH:
    process.env.TRANSAK_WIDGET_SESSION_PATH ||
    "",

  TRANSAK_QUOTE_PATH:
    process.env.TRANSAK_QUOTE_PATH ||
    "",

  TRANSAK_WALLET_VERIFICATION_PATH:
    process.env.TRANSAK_WALLET_VERIFICATION_PATH ||
    "",

  TRANSAK_ORDER_PATH:
    process.env.TRANSAK_ORDER_PATH ||
    "",

  FLUTTERWAVE_SECRET_KEY:
    process.env.FLUTTERWAVE_SECRET_KEY ||
    "",

  COINBASE_API_KEY:
    process.env.COINBASE_API_KEY ||
    "",

  BINANCE_API_KEY:
    process.env.BINANCE_API_KEY ||
    "",

  BINANCE_SECRET_KEY:
    process.env.BINANCE_SECRET_KEY ||
    "",

  SMTP_HOST:
    process.env.SMTP_HOST ||
    "",

  SMTP_PORT:
    Number(
      process.env.SMTP_PORT ||
      587
    ),

  SMTP_SECURE:
    process.env.SMTP_SECURE ||
    "false",

  SMTP_USER:
    process.env.SMTP_USER ||
    "",

  SMTP_PASSWORD:
    process.env.SMTP_PASSWORD ||
    "",

  SMTP_FROM:
    process.env.SMTP_FROM ||
    "",

  AWS_REGION:
    process.env.AWS_REGION ||
    "",

  AWS_ACCESS_KEY:
    process.env.AWS_ACCESS_KEY ||
    "",

  AWS_SECRET_KEY:
    process.env.AWS_SECRET_KEY ||
    "",

  S3_BUCKET:
    process.env.S3_BUCKET ||
    "",

  // ========== EXCHANGE PROVIDER (Crypto Liquidity) ==========
  EXCHANGE_PROVIDER_NAME:
    process.env.EXCHANGE_PROVIDER_NAME ||
    "",

  EXCHANGE_PROVIDER_BASE_URL:
    process.env.EXCHANGE_PROVIDER_BASE_URL ||
    "",

  EXCHANGE_PROVIDER_API_KEY:
    process.env.EXCHANGE_PROVIDER_API_KEY ||
    "",

  EXCHANGE_PROVIDER_API_SECRET:
    process.env.EXCHANGE_PROVIDER_API_SECRET ||
    "",

  QUIDAX_API_KEY:
    process.env.QUIDAX_API_KEY ||
    "",

  QUIDAX_BASE_URL:
    process.env.QUIDAX_BASE_URL ||
    "",

  QUIDAX_ENVIRONMENT:
    process.env.QUIDAX_ENVIRONMENT ||
    "sandbox",

  QUIDAX_TIMEOUT_MS:
    Number(process.env.QUIDAX_TIMEOUT_MS || 15000),

  SMARTPOS_WEBHOOK_SECRET:
    process.env.SMARTPOS_WEBHOOK_SECRET ||
    "",


  // ========== BLOCKCHAIN & SETTLEMENT ==========
  BLOCKCHAIN_NETWORK:
    (process.env.BLOCKCHAIN_NETWORK || process.env.BLOCKCHAIN_NETWORK_NAME || "ETHEREUM").trim().toUpperCase(),

  BLOCKCHAIN_RPC_URL:
    process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "",

  RPC_URL:
    process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "",

  BLOCKCHAIN_CHAIN_ID:
    Number(process.env.BLOCKCHAIN_CHAIN_ID || process.env.CHAIN_ID || 1),

  BLOCKCHAIN_CONFIRMATIONS_REQUIRED:
    Number(process.env.BLOCKCHAIN_CONFIRMATIONS_REQUIRED || 1),

  BLOCKCHAIN_USDT_CONTRACT_ADDRESS:
    process.env.BLOCKCHAIN_USDT_CONTRACT_ADDRESS || "",

  BLOCKCHAIN_USDT_DECIMALS:
    Number(process.env.BLOCKCHAIN_USDT_DECIMALS || 6),

  BROADCAST_PRIVATE_KEY:
    process.env.BROADCAST_PRIVATE_KEY ||
    "",

  // ========== FEATURE FLAGS ==========
  USE_MOCK_CRYPTO_PROVIDER:
    process.env.USE_MOCK_CRYPTO_PROVIDER === "true",

  ENABLE_CONFIRMATION_WORKER:
    process.env.ENABLE_CONFIRMATION_WORKER !== "false",

  ENABLE_RECONCILIATION_WORKER:
    process.env.ENABLE_RECONCILIATION_WORKER !== "false",

  CONFIRMATION_POLL_INTERVAL_MS:
    Number(process.env.CONFIRMATION_POLL_INTERVAL_MS || 30000),

  RECONCILIATION_POLL_INTERVAL_MS:
    Number(process.env.RECONCILIATION_POLL_INTERVAL_MS || 60000),
};

export default env;
