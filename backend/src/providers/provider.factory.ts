import StripeProvider
  from "./stripe.provider.js";

import PaystackProvider
  from "./paystack.provider.js";

import FlutterwaveProvider
  from "./flutterwave.provider.js";

import CoinbaseProvider
  from "./coinbase.provider.js";

import BinanceProvider
  from "./binance.provider.js";

import BaseProvider
  from "./base.provider.js";

import env
  from "../config/env.js";

export default class ProviderFactory {

  static create(
    provider: string
  ): BaseProvider {

    switch (
      provider.toLowerCase()
    ) {

      case "paystack":

        return new PaystackProvider(
          env.PAYSTACK_SECRET_KEY
        );

      case "stripe":

        return new StripeProvider(
          env.STRIPE_SECRET_KEY
        );

      case "flutterwave":

        return new FlutterwaveProvider(
          env.FLUTTERWAVE_SECRET_KEY
        );

      case "coinbase":

        return new CoinbaseProvider(
          env.COINBASE_API_KEY
        );

      case "binance":

        return new BinanceProvider(
          env.BINANCE_API_KEY,
          env.BINANCE_SECRET_KEY
        );

      default:

        throw new Error(
          `Unsupported production payment provider: ${provider}`
        );
    }
  }

  /**
   * Create a provider instance with explicitly supplied credentials.
   * Used for multi-account support where credentials vary by selected account.
   */
  static createWithSecret(
    provider: string,
    credentials: { secretKey?: string; apiKey?: string; apiSecret?: string }
  ): BaseProvider {

    switch (
      provider.toLowerCase()
    ) {

      case "paystack":

        if (!credentials.secretKey) {
          throw new Error(
            "Paystack requires secretKey"
          );
        }

        return new PaystackProvider(
          credentials.secretKey
        );

      case "stripe":

        if (!credentials.secretKey) {
          throw new Error(
            "Stripe requires secretKey"
          );
        }

        return new StripeProvider(
          credentials.secretKey
        );

      case "flutterwave":

        if (!credentials.secretKey) {
          throw new Error(
            "Flutterwave requires secretKey"
          );
        }

        return new FlutterwaveProvider(
          credentials.secretKey
        );

      case "coinbase":

        if (!credentials.apiKey) {
          throw new Error(
            "Coinbase requires apiKey"
          );
        }

        return new CoinbaseProvider(
          credentials.apiKey
        );

      case "binance":

        if (!credentials.apiKey || !credentials.apiSecret) {
          throw new Error(
            "Binance requires apiKey and apiSecret"
          );
        }

        return new BinanceProvider(
          credentials.apiKey,
          credentials.apiSecret
        );

      default:

        throw new Error(
          `Unsupported production payment provider: ${provider}`
        );
    }
  }
}