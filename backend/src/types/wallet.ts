export interface CreateWalletBody {
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
