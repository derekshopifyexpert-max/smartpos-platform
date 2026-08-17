import { PaymentProvider } from "@prisma/client";

export interface GatewaySelectionInput {
  merchantId: string;
  currency: string;
  amount: number;
  paymentMethod: string;
}

export default class SmartGatewaySelector {

  select(
    providers: PaymentProvider[],
    _input: GatewaySelectionInput
  ): PaymentProvider {

    // Filter out inactive providers
    let candidates = providers.filter(p => p.isActive);

    // Exclude providers that clearly do not support the requested currency
    // (simple mapping by provider name to supported currency set).
    const currency = _input.currency?.toUpperCase();

    candidates = candidates.filter(p => {
      const name = p.name.toLowerCase();

      if (name === "paystack") {
        // Paystack in our platform is configured to accept NGN only
        return currency === "NGN";
      }

      // Default: assume provider supports all currencies
      return true;
    });

    const active = candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();

    });

    if (!active.length) {
      throw new Error("No active payment provider found.");
    }

    return active[0];

  }

}
