import { api } from "@/lib/api/client";
import type { SettlementStatus } from "../types/settlement";

export interface InitiateCryptoSettlementRequest {
  transactionId?: string;
  asset?: string;
  network?: string;
  destinationAddress?: string;
  walletId?: string;
}

class SettlementService {
  /**
   * Initiate real crypto settlement
   * POST /payment-intents/:id/crypto-settlement
   * 
   * This connects the real backend infrastructure:
   * 1. Gets live quote from exchange provider
   * 2. Executes real BUY order
   * 3. Uses actual filled amount for blockchain transfer
   * 4. Initiates real USDT transfer on blockchain
   * 5. Returns real transaction hash and confirmation requirements
   */
  async initiateCryptoSettlement(
    paymentIntentId: string,
    request: InitiateCryptoSettlementRequest
  ): Promise<SettlementStatus> {
    const response = await api.post(
      `/payment-intents/${paymentIntentId}/crypto-settlement`,
      request
    );

    if (!response.data.success) {
      throw new Error(
        response.data.message ||
          response.data.error ||
          "Failed to initiate crypto settlement"
      );
    }

    return response.data.data;
  }

  /**
   * Get settlement status
   * GET /payment-intents/:id
   * 
   * Returns current settlement progress and blockchain state
   */
  async getSettlementStatus(
    paymentIntentId: string
  ): Promise<SettlementStatus> {
    const response = await api.get(
      `/payment-intents/${paymentIntentId}`
    );

    if (!response.data.success) {
      throw new Error(
        response.data.message ||
          response.data.error ||
          "Failed to get settlement status"
      );
    }

    return response.data.data;
  }
}

export const settlementService = new SettlementService();
