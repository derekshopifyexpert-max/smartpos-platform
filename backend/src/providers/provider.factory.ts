import FlutterwaveProvider from "./flutterwave.provider.js";
import BaseProvider from "./base.provider.js";

import env from "../config/env.js";

export default class ProviderFactory {
  /**
   * Create a payment provider using the application's
   * configured credentials.
   *
   * SmartPOS payment provider:
   * - Flutterwave = fiat/card payments and card withdrawals
   *
   * Crypto exchange is NOT handled here.
   * Crypto exchange uses the Quidax exchange provider adapter.
   */
  static create(provider: string): BaseProvider {
    const normalizedProvider = String(provider ?? "")
      .trim()
      .toLowerCase();

    switch (normalizedProvider) {
      case "flutterwave": {
        const secretKey = env.FLUTTERWAVE_SECRET_KEY;

        if (!secretKey?.trim()) {
          throw new Error(
            "Flutterwave secret key is not configured.",
          );
        }

        return new FlutterwaveProvider(secretKey);
      }

      default:
        throw new Error(
          `Unsupported production payment provider: ${provider}`,
        );
    }
  }

  /**
   * Create a payment provider with merchant-specific
   * credentials resolved from PaymentProviderAccount.
   */
  static createWithSecret(
    provider: string,
    credentials: {
      secretKey?: string;
      apiKey?: string;
      apiSecret?: string;
    },
  ): BaseProvider {
    const normalizedProvider = String(provider ?? "")
      .trim()
      .toLowerCase();

    switch (normalizedProvider) {
      case "flutterwave": {
        const secretKey = credentials.secretKey?.trim();

        if (!secretKey) {
          throw new Error(
            "Flutterwave requires secretKey.",
          );
        }

        return new FlutterwaveProvider(secretKey);
      }

      default:
        throw new Error(
          `Unsupported production payment provider: ${provider}`,
        );
    }
  }
}
