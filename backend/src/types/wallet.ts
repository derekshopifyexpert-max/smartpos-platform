export interface CreateWalletBody {
  name: string;
  currency: string;
  blockchain: string;
  network: string;
  asset: string;

  /*
   * Existing public wallet address supplied by
   * the merchant.
   *
   * SmartPOS does not generate wallet addresses.
   */
  address: string;

  type?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface WalletCreateData
  extends CreateWalletBody {
  merchantId: string;
}

export interface WalletIdParams {
  id: string;
}

export interface MerchantWalletParams {
  merchantId: string;
}

export interface WalletAmountBody {
  amount:
    | number
    | string;
}

export interface WalletTransferBody {
  fromWalletId: string;
  toWalletId: string;
  amount:
    | number
    | string;
}