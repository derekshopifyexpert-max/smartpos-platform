import {
  getApiErrorMessage,
  api,
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

function requireMerchantId(
  merchantId: unknown
): string {
  return requireString(
    merchantId,
    "Merchant account is required."
  );
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

function requireWalletAddress(
  address: unknown
): string {
  return requireString(
    address,
    "Wallet public address is required."
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
    ...payload,

    merchantId:
      requireMerchantId(
        payload.merchantId
      ),

    name:
      requireWalletName(
        payload.name
      ),

    currency:
      requireString(
        payload.currency,
        "Wallet currency is required."
      ),

    blockchain:
      requireString(
        payload.blockchain,
        "Blockchain is required."
      ),

    network:
      requireString(
        payload.network,
        "Network is required."
      ),

    asset:
      requireString(
        payload.asset,
        "Wallet asset is required."
      ),

    address:
      requireWalletAddress(
        payload.address
      ),
  };
}

function getWalletAddress(
  wallet: WalletRecord
): string | null {
  const directAddress =
    typeof wallet.address ===
      "string"
      ? wallet.address.trim()
      : "";

  if (directAddress) {
    return directAddress;
  }

  const addresses =
    Array.isArray(
      wallet.walletAddresses
    )
      ? wallet.walletAddresses
      : [];

  const activeAddress =
    addresses.find(
      (item) =>
        item &&
        typeof item.address ===
          "string" &&
        item.address.trim() &&
        item.isActive !== false
    );

  if (activeAddress) {
    return (
      activeAddress.address.trim() ||
      null
    );
  }

  const firstAddress =
    addresses.find(
      (item) =>
        item &&
        typeof item.address ===
          "string" &&
        item.address.trim()
    );

  if (firstAddress) {
    return (
      firstAddress.address.trim() ||
      null
    );
  }

  return null;
}

/**
 * Load all wallets belonging to a merchant.
 */
export async function getMerchantWallets(
  merchantId: string
): Promise<WalletRecord[]> {
  const normalizedMerchantId =
    requireMerchantId(
      merchantId
    );

  try {
    const response =
      await api.get<WalletListApiResponse>(
        ENDPOINTS.wallets.list(
          normalizedMerchantId
        )
      );

    if (
      response.data?.success !== true
    ) {
      throw new Error(
        response.data?.message ??
          response.data?.error ??
          "Unable to load merchant wallets."
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
        "Unable to load merchant wallets."
      )
    );
  }
}

/**
 * Create a merchant settlement wallet.
 *
 * SmartPOS does not generate or fabricate
 * blockchain addresses in the frontend.
 *
 * The supplied public address is validated
 * and persisted by the backend.
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
          "Wallet could not be created."
      );
    }

    const wallet =
      response.data.data;

    if (!wallet) {
      throw new Error(
        "The wallet was created but no wallet data was returned."
      );
    }

    const persistedAddress =
      getWalletAddress(wallet);

    if (!persistedAddress) {
      throw new Error(
        "The wallet was created, but the backend did not return its persisted public address."
      );
    }

    return wallet;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to create wallet."
      )
    );
  }
}

/**
 * Load one wallet by ID.
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