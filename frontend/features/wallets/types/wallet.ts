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

  currency?: string | null;

  balance?: number | string | null;

  availableBalance?: number | string | null;

  reservedBalance?: number | string | null;

  status?: string | null;

  /**
   * Primary public settlement address.
   *
   * SmartPOS never generates this address.
   * It is supplied by the merchant and persisted by the backend.
   */
  address?: string | null;

  blockchainId?: string | null;

  blockchain?: WalletBlockchainRecord | null;

  metadata?: Record<string, unknown> | null;

  createdAt?: string | null;

  updatedAt?: string | null;

  walletAddresses?: WalletAddressRecord[];
}

/**
 * Data submitted when saving a merchant-controlled
 * settlement wallet.
 *
 * The address is required because SmartPOS does not
 * generate wallets or wallet addresses.
 */
export interface CreateWalletPayload {
  merchantId: string;

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
  data: WalletRecord;
  message?: string;
}

export interface WalletListApiResponse {
  success: boolean;
  data: WalletRecord[];
  message?: string;
}
