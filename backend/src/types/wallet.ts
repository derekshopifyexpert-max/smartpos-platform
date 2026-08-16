import { Prisma } from "@prisma/client";

export interface CreateWalletBody {
  name: string;

  currency: string;

  blockchain: string;

  network: string;

  asset: string;

  type?: string;

  address: string;

  metadata?: Record<string, unknown>;
}

export interface CreateWalletRequestData
  extends CreateWalletBody {
  merchantId?: string | null;
}

export interface WalletTransferBody {
  fromWalletId: string;

  toWalletId: string;

  amount: number | string;
}

export interface WalletAmountBody {
  amount: number | string;
}

export interface WalletBalanceData {
  balance?: Prisma.Decimal;
  availableBalance?: Prisma.Decimal;
  reservedBalance?: Prisma.Decimal;
}