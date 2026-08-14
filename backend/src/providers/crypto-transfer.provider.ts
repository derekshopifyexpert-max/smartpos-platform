import { Prisma } from "@prisma/client";

export interface ValidateCryptoAddressInput {
  asset: string;
  network: string;
  address: string;
}

export interface SendCryptoTransactionInput {
  asset: string;
  network: string;
  fromAddress?: string;
  toAddress: string;
  amount: Prisma.Decimal | string | number;
  reference?: string;
}

export interface CryptoTransferResult {
  success: boolean;
  status: string;
  message: string;
  transactionHash?: string;
  blockExplorerUrl?: string;
  raw?: unknown;
}

export interface CryptoTransferProvider {
  validateAddress(input: ValidateCryptoAddressInput): Promise<boolean>;
  sendTransaction(input: SendCryptoTransactionInput): Promise<CryptoTransferResult>;
  getTransaction(txHash: string): Promise<CryptoTransferResult>;
  getConfirmations(txHash: string): Promise<number>;
}

export class NotConfiguredCryptoTransferProvider implements CryptoTransferProvider {
  async validateAddress(): Promise<boolean> {
    return false;
  }

  async sendTransaction(): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message:
        "No crypto transfer provider is configured for SmartPOS settlement.",
    };
  }

  async getTransaction(): Promise<CryptoTransferResult> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      message: "No crypto transfer provider is configured.",
    };
  }

  async getConfirmations(): Promise<number> {
    return 0;
  }
}
