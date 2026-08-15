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

  /*
   * This is the merchant's public settlement address.
   * SmartPOS does not generate or own it.
   */
  address?: string | null;

  blockchainId?: string | null;

  /*
   * Kept for compatibility with existing API responses.
   * The backend must never expose private key material.
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

  /*
   * Required because SmartPOS stores an existing
   * merchant-owned wallet rather than generating one.
   */
  address: string;

  type?: string;

  metadata?: Record<string, unknown>;
}