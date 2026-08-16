export interface WalletAddressRecord {
  id: string;
  walletId?: string;
  address: string;
  blockchainId?: string | null;
  label?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WalletRecord {
  id: string;
  merchantId?: string | null;

  name: string;

  type?: string | null;
  currency?: string | null;

  balance?: number | string | null;
  availableBalance?: number | string | null;
  reservedBalance?: number | string | null;

  status?: string | null;

  /**
   * Existing public settlement address supplied by the merchant.
   *
   * SmartPOS does not generate this address.
   */
  address?: string | null;

  blockchainId?: string | null;

  /**
   * Public metadata only.
   *
   * Private keys, encrypted private keys, seed phrases and
   * mnemonics must never appear in this interface.
   */
  publicKey?: string | null;

  metadata?: Record<string, unknown> | null;

  createdAt?: string;
  updatedAt?: string;

  blockchain?: {
    id?: string | null;
    name?: string | null;
    chainId?: number | null;
    nativeCurrency?: string | null;
    blockTime?: number | null;
    explorerUrl?: string | null;
    isActive?: boolean | null;
  } | null;

  walletAddresses?: WalletAddressRecord[];
}

export interface CreateWalletPayload {
  merchantId: string;

  name: string;

  currency: string;

  blockchain: string;

  network: string;

  asset: string;

  /**
   * Existing public wallet address supplied by the merchant.
   *
   * SmartPOS stores and validates this address.
   * SmartPOS never generates it.
   */
  address: string;

  type?: string;

  metadata?: Record<string, unknown>;
}