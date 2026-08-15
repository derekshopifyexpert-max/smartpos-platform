import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  CreateWalletPayload,
  WalletRecord,
} from "@/features/wallets/types/wallet";

interface WalletListResponse {
  success: boolean;
  data: WalletRecord[];
  message?: string;
}

interface WalletResponse {
  success: boolean;
  data: WalletRecord;
  message?: string;
}

function extractApiMessage(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: unknown;
            error?: unknown;
          };
        };
      }
    ).response;

    const data = response?.data;

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Wallet request failed.";
}

export async function getMerchantWallets(
  merchantId: string
): Promise<WalletRecord[]> {
  if (!merchantId?.trim()) {
    throw new Error(
      "Merchant account is required to load wallets."
    );
  }

  try {
    const response =
      await api.get<WalletListResponse>(
        ENDPOINTS.wallets.list(
          merchantId.trim()
        )
      );

    return response.data.data ?? [];
  } catch (error) {
    throw new Error(
      extractApiMessage(error)
    );
  }
}

export async function createWallet(
  payload: CreateWalletPayload
): Promise<WalletRecord> {
  if (!payload.merchantId?.trim()) {
    throw new Error(
      "Merchant account is required."
    );
  }

  if (!payload.name?.trim()) {
    throw new Error(
      "Wallet name is required."
    );
  }

  if (!payload.asset?.trim()) {
    throw new Error(
      "Wallet asset is required."
    );
  }

  if (!payload.network?.trim()) {
    throw new Error(
      "Wallet network is required."
    );
  }

  if (!payload.address?.trim()) {
    throw new Error(
      "Wallet address is required."
    );
  }

  try {
    const response =
      await api.post<WalletResponse>(
        ENDPOINTS.wallets.create,
        {
          ...payload,
          merchantId:
            payload.merchantId.trim(),
          name:
            payload.name.trim(),
          currency:
            payload.currency.trim().toUpperCase(),
          blockchain:
            payload.blockchain.trim().toUpperCase(),
          network:
            payload.network.trim().toUpperCase(),
          asset:
            payload.asset.trim().toUpperCase(),
          address:
            payload.address.trim(),
          type:
            payload.type ?? "CRYPTO",
        }
      );

    if (!response.data?.data) {
      throw new Error(
        "The server did not return the saved wallet."
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      extractApiMessage(error)
    );
  }
}

export async function getWallet(
  id: string
): Promise<WalletRecord> {
  if (!id?.trim()) {
    throw new Error(
      "Wallet ID is required."
    );
  }

  try {
    const response =
      await api.get<WalletResponse>(
        ENDPOINTS.wallets.detail(
          id.trim()
        )
      );

    return response.data.data;
  } catch (error) {
    throw new Error(
      extractApiMessage(error)
    );
  }
}