import axios from "axios";

import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  CreateWalletPayload,
  WalletApiResponse,
  WalletListApiResponse,
  WalletRecord,
} from "@/features/wallets/types/wallet";

function extractApiError(
  error: unknown,
  fallback: string
): Error {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (
      responseData &&
      typeof responseData === "object"
    ) {
      const data =
        responseData as Record<string, unknown>;

      if (
        typeof data.message === "string" &&
        data.message.trim()
      ) {
        return new Error(data.message);
      }

      if (
        typeof data.error === "string" &&
        data.error.trim()
      ) {
        return new Error(data.error);
      }

      if (
        data.error &&
        typeof data.error === "object"
      ) {
        const nested =
          data.error as Record<string, unknown>;

        if (
          typeof nested.message === "string" &&
          nested.message.trim()
        ) {
          return new Error(nested.message);
        }
      }

      if (
        Array.isArray(data.errors) &&
        data.errors.length > 0
      ) {
        const messages = data.errors
          .map((item) => {
            if (
              typeof item === "string"
            ) {
              return item;
            }

            if (
              item &&
              typeof item === "object"
            ) {
              const value =
                item as Record<
                  string,
                  unknown
                >;

              if (
                typeof value.message ===
                  "string" &&
                value.message.trim()
              ) {
                return value.message;
              }
            }

            return null;
          })
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          );

        if (messages.length > 0) {
          return new Error(
            messages.join(", ")
          );
        }
      }
    }

    if (error.message?.trim()) {
      return new Error(error.message);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

function assertMerchantId(
  merchantId: string
): string {
  const value = merchantId.trim();

  if (!value) {
    throw new Error(
      "Merchant account is required."
    );
  }

  return value;
}

function assertWalletAddress(
  address: string
): string {
  const value = address.trim();

  if (!value) {
    throw new Error(
      "Wallet address is required."
    );
  }

  return value;
}

function assertWalletPayload(
  payload: CreateWalletPayload
): CreateWalletPayload {
  const merchantId =
    assertMerchantId(
      payload.merchantId
    );

  const name =
    payload.name.trim();

  const currency =
    payload.currency.trim();

  const blockchain =
    payload.blockchain.trim();

  const network =
    payload.network.trim();

  const asset =
    payload.asset.trim();

  const address =
    assertWalletAddress(
      payload.address
    );

  if (!name) {
    throw new Error(
      "Wallet name is required."
    );
  }

  if (!currency) {
    throw new Error(
      "Wallet currency is required."
    );
  }

  if (!blockchain) {
    throw new Error(
      "Blockchain is required."
    );
  }

  if (!network) {
    throw new Error(
      "Network is required."
    );
  }

  if (!asset) {
    throw new Error(
      "Wallet asset is required."
    );
  }

  return {
    ...payload,

    merchantId,
    name,
    currency,
    blockchain,
    network,
    asset,
    address,
  };
}

function getWalletAddress(
  wallet: WalletRecord
): string | null {
  const directAddress =
    wallet.address?.trim();

  if (directAddress) {
    return directAddress;
  }

  const primaryAddress =
    wallet.walletAddresses?.find(
      (item) =>
        item.isActive !== false &&
        item.address?.trim()
    )?.address;

  return (
    primaryAddress?.trim() || null
  );
}

/**
 * Load all settlement wallets belonging
 * to the authenticated merchant.
 */
export async function getMerchantWallets(
  merchantId: string
): Promise<WalletRecord[]> {
  const normalizedMerchantId =
    assertMerchantId(
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
      !response.data?.success
    ) {
      throw new Error(
        response.data?.message ??
          "Unable to load merchant wallets."
      );
    }

    return Array.isArray(
      response.data.data
    )
      ? response.data.data
      : [];
  } catch (error) {
    throw extractApiError(
      error,
      "Unable to load merchant wallets."
    );
  }
}

/**
 * Save a merchant-controlled settlement wallet.
 *
 * SmartPOS does not generate the wallet address.
 * The supplied public address is sent to the backend
 * for network validation and persistence.
 */
export async function createWallet(
  payload: CreateWalletPayload
): Promise<WalletRecord> {
  const normalizedPayload =
    assertWalletPayload(
      payload
    );

  try {
    const response =
      await api.post<WalletApiResponse>(
        ENDPOINTS.wallets.create,
        normalizedPayload
      );

    if (
      !response.data?.success ||
      !response.data.data
    ) {
      throw new Error(
        response.data?.message ??
          "Wallet could not be saved."
      );
    }

    const wallet =
      response.data.data;

    /*
     * Do not accept a successful response
     * that does not contain the persisted
     * public settlement address.
     */
    const address =
      getWalletAddress(wallet);

    if (!address) {
      throw new Error(
        "The wallet was saved, but the backend did not return its public address."
      );
    }

    return wallet;
  } catch (error) {
    throw extractApiError(
      error,
      "Unable to save wallet."
    );
  }
}

/**
 * Load one wallet.
 */
export async function getWallet(
  id: string
): Promise<WalletRecord> {
  const walletId =
    id.trim();

  if (!walletId) {
    throw new Error(
      "Wallet ID is required."
    );
  }

  try {
    const response =
      await api.get<WalletApiResponse>(
        ENDPOINTS.wallets.detail(
          walletId
        )
      );

    if (
      !response.data?.success ||
      !response.data.data
    ) {
      throw new Error(
        response.data?.message ??
          "Wallet not found."
      );
    }

    return response.data.data;
  } catch (error) {
    throw extractApiError(
      error,
      "Unable to load wallet."
    );
  }
}