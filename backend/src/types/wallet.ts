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

export interface WalletTransferBody {
  fromWalletId: string;
  toWalletId: string;
  amount: number | string;
}

export interface WalletAmountBody {
  amount: number | string;
}

export interface CreateWalletRequestData
  extends CreateWalletBody {
  merchantId: string;
}