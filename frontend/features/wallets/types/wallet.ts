export interface WalletAddressRecord {
  id: string;
  address: string;
  blockchainId?: string | null;
  label?: string | null;
  isActive?: boolean;
}

export interface WalletRecord {
  id: string;
  merchantId: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  balance?: number | string | null;
  availableBalance?: number | string | null;
  reservedBalance?: number | string | null;
  status?: string | null;
  address?: string | null;
  blockchainId?: string | null;
  publicKey?: string | null;
  encryptedPrivateKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  blockchain?: {
    id?: string | null;
    name?: string | null;
  } | null;
  walletAddresses?: WalletAddressRecord[];
}

export interface CreateWalletPayload {
  merchantId: string;
  name?: string;
  currency?: string;
  blockchain?: string;
  network?: string;
  asset?: string;
  type?: string;
  address?: string;
  walletAddress?: string;
  metadata?: Record<string, unknown>;
}
