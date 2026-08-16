import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { getWallets } from "@/features/wallets/services/wallet.service";

import type {
  Transaction,
  TransactionListResponse,
} from "../types/transaction";

export async function getTransactions(
  page = 1,
  limit = 10
): Promise<TransactionListResponse["data"]> {
  try {
    const response = await api.get<TransactionListResponse>(
      ENDPOINTS.transactions.list,
      {
        params: {
          page,
          limit,
        },
      }
    );

    return response.data.data;
  } catch (err) {
    // Retry using a fallback merchant if unauthenticated or not authorized.
    try {
      const wallets = await getWallets();

      const fallbackMerchantId =
        wallets?.[0]?.merchantId ?? null;

      if (!fallbackMerchantId) {
        throw err;
      }

      const retry = await api.get<TransactionListResponse>(
        ENDPOINTS.transactions.list,
        {
          params: {
            page,
            limit,
            merchantId: fallbackMerchantId,
          },
        }
      );

      return retry.data.data;
    } catch (inner) {
      throw inner;
    }
  }
}

export async function getTransaction(
  id: string
): Promise<Transaction> {
  const response = await api.get<{
    success: boolean;
    data: Transaction;
  }>(
    ENDPOINTS.transactions.detail(id)
  );

  return response.data.data;
}


/*
|--------------------------------------------------------------------------
| Start Transaction
|--------------------------------------------------------------------------
*/

export async function startTransaction(
  payload: unknown
) {

  const response =
    await api.post(
      "/transactions/start",
      payload
    );

  return response.data.data;

}

/*
|--------------------------------------------------------------------------
| Execute Payment
|--------------------------------------------------------------------------
*/

export async function executePayment(
  payload: {
    transactionId: string;
    fromCurrency: string;
    toCurrency: string;
  }
) {

  const response =
    await api.post(
      "/transactions/execute",
      payload
    );

  return response.data.data;

}
