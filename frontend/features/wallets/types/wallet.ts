export interface WalletAddressRecord {
  id: string;
  address: string;
  blockchainId?: string | null;
  label?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WalletBlockchainRecord {
  id?: string | null;
  name?: string | null;
  nativeCurrency?: string | null;
  blockTime?: number | null;
  isActive?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface WalletRecord {
  id: string;

  merchantId?: string | null;

  name: string;

  type?: string | null;

  currency?: number | string | null;

  balance?: number | string | null;

  availableBalance?: number | string | null;

  reservedBalance?: number | string | null;

  status?: string | null;

  address?: string | null;

  blockchainId?: string | null;

  blockchain?: WalletBlockchainRecord | null;

  network?: string | null;

  asset?: string | null;

  metadata?: Record<string, unknown> | null;

  createdAt?: string | null;

  updatedAt?: string | null;

  walletAddresses?: WalletAddressRecord[];
}

export interface CreateWalletPayload {
  name: string;

  currency: string;

  blockchain: string;

  network: string;

  asset: string;

  address: string;

  type?: string;

  metadata?: Record<string, unknown>;
}

export interface WalletApiResponse {
  success: boolean;

  data?: WalletRecord;

  message?: string;

  error?: string;
}

export interface WalletListApiResponse {
  success: boolean;

  data?: WalletRecord[];

  message?: string;

  error?: string;
}