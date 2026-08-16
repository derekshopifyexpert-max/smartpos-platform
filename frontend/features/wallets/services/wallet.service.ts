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

    ...(typeof payload.type === "string" &&
    payload.type.trim()
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

    if (
      activeAddress?.address
    ) {
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

    if (
      firstAddress?.address
    ) {
      return firstAddress.address.trim();
    }
  }

  return null;
}

/**
 * Load all wallets available to the authenticated user.
 *
 * SmartPOS uses the authenticated API session as the source
 * of identity. The frontend does not require a merchantId
 * before requesting saved wallets.
 *
 * This is intentionally different from the old implementation,
 * which rejected the request when merchantId was unavailable.
 *
 * Backend route:
 * GET /wallets
 */
export async function getMerchantWallets(
  _merchantId?: string
): Promise<WalletRecord[]> {
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
          "Unable to load saved wallets."
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
        "Unable to load saved wallets."
      )
    );
  }
}

/**
 * Load all saved wallets for the authenticated user.
 *
 * This is the primary wallet-list function.
 *
 * The request relies on the authenticated API session.
 * No merchantId is required from the frontend.
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
 * Save an existing public wallet address.
 *
 * SmartPOS does not generate or own the wallet.
 * The merchant supplies the existing public address.
 *
 * No private key, seed phrase, or other sensitive
 * wallet material is accepted or returned here.
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

/**
 * Get one saved wallet by ID.
 */
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

/**
 * Delete one saved wallet by ID.
 */
export async function deleteWallet(
  id: string
): Promise<{ id: string }> {
  const walletId =
    requireWalletId(id);

  try {
    const response =
      await api.delete(
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
          "Unable to delete wallet."
      );
    }

    return {
      id: walletId,
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to delete wallet."
      )
    );
  }
}