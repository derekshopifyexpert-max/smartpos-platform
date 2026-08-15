import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  CreateWalletPayload,
  WalletRecord,
} from "@/features/wallets/types/wallet";

export async function getMerchantWallets(
  merchantId?: string
): Promise<WalletRecord[]> {
  if (merchantId) {
    const response = await api.get<{
      success: boolean;
      data: WalletRecord[];
    }>(ENDPOINTS.wallets.list(merchantId));

    return response.data.data ?? [];
  }

  /*
   * The dashboard is allowed to operate after login without requiring
   * a merchantId in the frontend session.
   *
   * If the backend provides a wallet-list endpoint that resolves the
   * authenticated merchant from the session, use that endpoint here.
   *
   * Until then, return an empty list instead of blocking the page.
   */
  return [];
}

export async function createWallet(
  payload: CreateWalletPayload
): Promise<WalletRecord> {
  const response = await api.post<{
    success: boolean;
    data: WalletRecord;
  }>(ENDPOINTS.wallets.create, payload);

  return response.data.data;
}

export async function getWallet(id: string): Promise<WalletRecord> {
  const response = await api.get<{
    success: boolean;
    data: WalletRecord;
  }>(ENDPOINTS.wallets.detail(id));

  return response.data.data;
}