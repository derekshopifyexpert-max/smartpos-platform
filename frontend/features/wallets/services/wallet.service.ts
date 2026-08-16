import {
  api,
  getApiErrorMessage,
} from "@/lib/api/client";

import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  CreateWalletPayload,
  WalletApiResponse,
  WalletListApiResponse,
  WalletRecord,
} from "@/features/wallets/types/wallet";

function requireString(
  value: unknown,
  message: string
): string {
  if (typeof value !== "string") {
    throw new Error(message);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function requireWalletId(
  id: unknown
): string {
  return requireString(
    id,
    "Wallet ID is required."
  );
}

function requireWalletName(
  name: unknown
): string {
  return requireString(
    name,
    "Wallet name is required."
  );
}

function requireAddress(
  address: unknown
): string {
  return requireString(
    address,
    "Public wallet address is required."
  );
}

function normalizeCreateWalletPayload(
  payload: CreateWalletPayload
): CreateWalletPayload {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    throw new Error(
      "Wallet information is required."
    );
  }

  return {
    name: requireWalletName(
      payload.name
    ),

    currency: requireString(
      payload.currency,
      "Wallet currency is required."
    ),

    blockchain: requireString(
      payload.blockchain,
      "Blockchain is required."
    ),

    network: requireString(
      payload.network,
      "Network is required."
    ),

    asset: requireString(
      payload.asset,
      "Wallet asset is required."
    ),

    address: requireAddress(
      payload.address
    ),

    ...(payload.type
      ? {
          type: payload.type.trim(),
        }
      : {}),

    ...(payload.metadata
      ? {
          metadata: payload.metadata,
        }
      : {}),
  };
}

function getWalletAddress(
  wallet: WalletRecord
): string | null {
  if (
    typeof wallet.address === "string" &&
    wallet.address.trim()
  ) {
    return wallet.address.trim();
  }

  if (
    Array.isArray(
      wallet.walletAddresses
    )
  ) {
    const activeAddress =
      wallet.walletAddresses.find(
        (item) =>
          item &&
          typeof item.address ===
            "string" &&
          item.address.trim() &&
          item.isActive !== false
      );

    if (activeAddress?.address) {
      return activeAddress.address.trim();
    }

    const firstAddress =
      wallet.walletAddresses.find(
        (item) =>
          item &&
          typeof item.address ===
            "string" &&
          item.address.trim()
      );

    if (firstAddress?.address) {
      return firstAddress.address.trim();
    }
  }

  return null;
}

/**
 * Load every saved wallet.
 *
 * No authenticated user or merchant ID
 * is required for this wallet-management
 * flow.
 */
export async function getWallets(): Promise<
  WalletRecord[]
> {
  try {
    const response =
      await api.get<WalletListApiResponse>(
        ENDPOINTS.wallets.list
      );

    if (
      response.data?.success !== true
    ) {
      throw new Error(
        response.data?.message ??
          response.data?.error ??
          "Unable to load wallets."
      );
    }

    return Array.isArray(
      response.data.data
    )
      ? response.data.data
      : [];
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to load wallets."
      )
    );
  }
}

/**
 * Backwards-compatible alias.
 */
export async function getMerchantWallets(): Promise<
  WalletRecord[]
> {
  return getWallets();
}

/**
 * Save an existing public wallet address.
 *
 * The address comes from the user.
 * SmartPOS does not generate it.
 */
export async function createWallet(
  payload: CreateWalletPayload
): Promise<WalletRecord> {
  const normalizedPayload =
    normalizeCreateWalletPayload(
      payload
    );

  try {
    const response =
      await api.post<WalletApiResponse>(
        ENDPOINTS.wallets.create,
        normalizedPayload
      );

    if (
      response.data?.success !== true
    ) {
      throw new Error(
        response.data?.message ??
          response.data?.error ??
          "Wallet could not be saved."
      );
    }

    const wallet =
      response.data.data;

    if (!wallet) {
      throw new Error(
        "The server did not return the saved wallet."
      );
    }

    const address =
      getWalletAddress(wallet);

    if (!address) {
      throw new Error(
        "The wallet was saved without a public address."
      );
    }

    return wallet;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to save wallet."
      )
    );
  }
}

export async function getWallet(
  id: string
): Promise<WalletRecord> {
  const walletId =
    requireWalletId(id);

  try {
    const response =
      await api.get<WalletApiResponse>(
        ENDPOINTS.wallets.detail(
          walletId
        )
      );

    if (
      response.data?.success !== true
    ) {
      throw new Error(
        response.data?.message ??
          response.data?.error ??
          "Wallet not found."
      );
    }

    if (!response.data.data) {
      throw new Error(
        "Wallet not found."
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to load wallet."
      )
    );
  }
}

export async function deleteWallet(
  id: string
): Promise<{ id: string }> {
  const walletId = requireWalletId(id);

  try {
    const response = await api.delete(
      ENDPOINTS.wallets.detail(walletId)
    );

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message ?? response.data?.error ?? "Unable to delete wallet."
      );
    }

    return { id: walletId };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to delete wallet."));
  }
}