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
    _input: GatewaySelectionInput,
  ): PaymentProvider {
    const active = providers
      .filter(
        provider => provider.isActive,
      )
      .sort((a, b) => {
        if (
          a.priority !==
          b.priority
        ) {
          return (
            a.priority -
            b.priority
          );
        }

        return (
          a.createdAt.getTime() -
          b.createdAt.getTime()
        );
      });

    if (!active.length) {
      throw new Error(
        "No active payment provider found.",
      );
    }

    return active[0];
  }
}