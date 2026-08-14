import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { CreateWalletPayload, WalletRecord } from "@/features/wallets/types/wallet";

export async function getMerchantWallets(merchantId: string): Promise<WalletRecord[]> {
  const response = await api.get<{ success: boolean; data: WalletRecord[] }>(
    ENDPOINTS.wallets.list(merchantId)
  );

  return response.data.data;
}

export async function createWallet(payload: CreateWalletPayload): Promise<WalletRecord> {
  const response = await api.post<{ success: boolean; data: WalletRecord }>(
    ENDPOINTS.wallets.create,
    payload
  );

  return response.data.data;
}

export async function getWallet(id: string): Promise<WalletRecord> {
  const response = await api.get<{ success: boolean; data: WalletRecord }>(
    ENDPOINTS.wallets.detail(id)
  );

  return response.data.data;
}
