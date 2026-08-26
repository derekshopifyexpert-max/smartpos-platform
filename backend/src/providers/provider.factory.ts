import FlutterwaveProvider from "./flutterwave.provider.js";
import CoinbaseProvider from "./coinbase.provider.js";
import BinanceProvider from "./binance.provider.js";
import BaseProvider from "./base.provider.js";

import env from "../config/env.js";

export default class ProviderFactory {
  /**
   * Create a provider using the application's default
   * environment credentials.
   *
   * Flutterwave is the SmartPOS fiat/card payment provider.
   * Coinbase/Binance remain available here only where the
   * existing BaseProvider contract requires them.
   */
  static create(provider: string): BaseProvider {
    const normalizedProvider = String(provider)
      .trim()
      .toLowerCase();

    switch (normalizedProvider) {
      case "flutterwave": {
        const secretKey =
          env.FLUTTERWAVE_SECRET_KEY;

        if (!secretKey?.trim()) {
          throw new Error(
            "Flutterwave secret key is not configured."
          );
        }

        return new FlutterwaveProvider(
          secretKey
        );
      }

      case "coinbase": {
        const apiKey =
          env.COINBASE_API_KEY;

        if (!apiKey?.trim()) {
          throw new Error(
            "Coinbase API key is not configured."
          );
        }

        return new CoinbaseProvider(
          apiKey
        );
      }

      case "binance": {
        const apiKey =
          env.BINANCE_API_KEY;

        const apiSecret =
          env.BINANCE_SECRET_KEY;

        if (
          !apiKey?.trim() ||
          !apiSecret?.trim()
        ) {
          throw new Error(
            "Binance API credentials are not configured."
          );
        }

        return new BinanceProvider(
          apiKey,
          apiSecret
        );
      }

      default:
        throw new Error(
          `Unsupported production payment provider: ${provider}`
        );
    }
  }

  /**
   * Create a provider with credentials resolved from a
   * PaymentProviderAccount.
   *
   * SmartPOS uses this path for merchant-specific
   * payment-provider accounts.
   */
  static createWithSecret(
    provider: string,
    credentials: {
      secretKey?: string;
      apiKey?: string;
      apiSecret?: string;
    }
  ): BaseProvider {
    const normalizedProvider = String(provider)
      .trim()
      .toLowerCase();

    switch (normalizedProvider) {
      case "flutterwave": {
        const secretKey =
          credentials.secretKey?.trim();

        if (!secretKey) {
          throw new Error(
            "Flutterwave requires secretKey."
          );
        }

        return new FlutterwaveProvider(
          secretKey
        );
      }

      case "coinbase": {
        const apiKey =
          credentials.apiKey?.trim();

        if (!apiKey) {
          throw new Error(
            "Coinbase requires apiKey."
          );
        }

        return new CoinbaseProvider(
          apiKey
        );
      }

      case "binance": {
        const apiKey =
          credentials.apiKey?.trim();

        const apiSecret =
          credentials.apiSecret?.trim();

        if (!apiKey || !apiSecret) {
          throw new Error(
            "Binance requires apiKey and apiSecret."
          );
        }

        return new BinanceProvider(
          apiKey,
          apiSecret
        );
      }

      default:
        throw new Error(
          `Unsupported production payment provider: ${provider}`
        );
    }
  }
}