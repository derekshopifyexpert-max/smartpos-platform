import { Prisma } from "@prisma/client";

export interface CreateWalletBody {
  merchantId: string;

  name: string;

  currency: string;

  blockchain: string;

  network: string;

  asset: string;

  /*
   * Required because SmartPOS stores an
   * existing merchant-owned public address.
   */
  address: string;

  type?: string;

  metadata?: Record<
    string,
    unknown
  >;

  balance?: Prisma.Decimal;

  availableBalance?: Prisma.Decimal;

  reservedBalance?: Prisma.Decimal;
}