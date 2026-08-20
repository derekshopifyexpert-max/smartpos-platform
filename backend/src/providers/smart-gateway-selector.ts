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

    // Fiat-provider capability filtering belongs to provider metadata.
    // Crypto providers are not selected by this fiat gateway selector.

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
