import { Prisma } from "@prisma/client";
import {
  CryptoTransferProvider,
  ValidateCryptoAddressInput,
  SendCryptoTransactionInput,
  CryptoTransferResult,
} from "./crypto-transfer.provider.js";

export default class MockCryptoProvider implements CryptoTransferProvider {
  async validateAddress(input: ValidateCryptoAddressInput): Promise<boolean> {
    // naive validation: accept non-empty strings and basic hex address
    if (!input.address || typeof input.address !== "string") return false;
    const a = input.address.trim();
    if (!a) return false;
    // accept typical 0x hex addresses or any non-empty string in dev
    return /^0x[0-9a-fA-F]{20,64}$/.test(a) || a.length > 10;
  }

  async sendTransaction(input: SendCryptoTransactionInput): Promise<CryptoTransferResult> {
    // Return a fake tx hash and success for local testing
    const txHash = `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

    return {
      success: true,
      status: "submitted",
      message: "Mock transaction submitted",
      transactionHash: txHash,
      blockExplorerUrl: `https://explorer.mock/tx/${txHash}`,
      raw: {
        mocked: true,
        input: {
          asset: input.asset,
          network: input.network,
          toAddress: input.toAddress,
          amount: input.amount,
          reference: input.reference,
        },
        txHash,
      },
    };
  }

  async getTransaction(_txHash: string): Promise<CryptoTransferResult> {
    return {
      success: true,
      status: "submitted",
      message: "Mock transaction found",
      transactionHash: _txHash,
      raw: { mocked: true },
    };
  }

  async getConfirmations(_txHash: string): Promise<number> {
    return 0;
  }
}
