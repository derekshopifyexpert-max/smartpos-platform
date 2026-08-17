import {
  Prisma
} from "@prisma/client";

import { FastifyInstance } from "fastify";

import crypto from "crypto";
import { ethers } from "ethers";

export default class BlockchainService {

  constructor(
    private readonly app: FastifyInstance
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  private generateTxHash(): string {

    return crypto
      .randomBytes(32)
      .toString("hex");

  }

  /*
  |--------------------------------------------------------------------------
  | Blockchain Transaction
  |--------------------------------------------------------------------------
  */

  async createTransaction(data: {

    blockchain: any;

    walletId?: string;

    fromAddress: string;

    toAddress: string;

    amount: Prisma.Decimal;

    currency: any;

    fee?: Prisma.Decimal;

    gasPrice?: Prisma.Decimal;

    nonce?: number;

    metadata?: Prisma.JsonValue;

    payload?: Prisma.JsonValue;

  }) {

    // allow caller to provide txHash when provider returns it (provider-managed broadcast)
    const providedTxHash = (data as any).txHash ?? null;

    // create DB record first
    const record = await this.app.prisma.blockchainTransaction.create({
      data: {
        txHash: providedTxHash ?? this.generateTxHash(),
        blockchainId: data.blockchain,
        walletId: data.walletId,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        amount: data.amount,
        currency: data.currency,
        fee: data.fee ?? new Prisma.Decimal(0),
        gasPrice: data.gasPrice,
        nonce: data.nonce,
        metadata: data.metadata ?? Prisma.JsonNull,
        data: data.payload ?? Prisma.JsonNull,
        status: "pending",
      },
    });

    // If provider already returned a tx hash, just return the record.
    if (providedTxHash) return record;

    // If environment provides an RPC URL and a PRIVATE_KEY, attempt to broadcast
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.BROADCAST_PRIVATE_KEY;

    const supportedNative = new Set(["ETH", "MATIC", "BNB"]);

    if (rpcUrl && privateKey && supportedNative.has(String(data.currency).toUpperCase())) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        const value = ethers.parseEther(String(data.amount));

        const tx = await wallet.sendTransaction({ to: data.toAddress, value });

        // update record with real txHash
        const updated = await this.app.prisma.blockchainTransaction.update({ where: { id: record.id }, data: { txHash: tx.hash, metadata: { ...(record.metadata as any), broadcastedBy: 'local-signer' } } });

        return updated;
      } catch (err) {
        // on error, leave the record as pending and attach metadata
        await this.app.prisma.blockchainTransaction.update({ where: { id: record.id }, data: { metadata: { ...(record.metadata as any), broadcastError: String(err) } } });
        return record;
      }
    }

    return record;

  }

  async markConfirmed(

    txId: string,

    blockNumber: number,

    blockHash: string,

    confirmations: number

  ) {

    return this.app.prisma.blockchainTransaction.update({

      where: {

        id: txId

      },

      data: {

        blockNumber,

        blockHash,

        confirmations,

        status: "confirmed"

      }

    });

  }

  async markFailed(

    txId: string

  ) {

    return this.app.prisma.blockchainTransaction.update({

      where: {

        id: txId

      },

      data: {

        status: "failed"

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Confirmations
  |--------------------------------------------------------------------------
  */

  async addConfirmation(data: {

    txId: string;

    confirmations: number;

    blockHash?: string;

    blockTime?: Date;

    metadata?: Prisma.JsonValue;

  }) {

    await this.app.prisma.blockchainTransaction.update({

      where: {

        id: data.txId

      },

      data: {

        confirmations: data.confirmations

      }

    });

    return this.app.prisma.blockchainConfirmation.create({

      data: {

        txId: data.txId,

        confirmations: data.confirmations,

        blockHash: data.blockHash,

        blockTime: data.blockTime,

        metadata: data.metadata ?? Prisma.JsonNull,

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Wallet Transfer
  |--------------------------------------------------------------------------
  */

  async createWalletTransfer(data: {

    merchantId: string;

    fromWalletId: string;

    toWalletId: string;

    amount: Prisma.Decimal;

    currency: any;

    fee?: Prisma.Decimal;

    type: string;

    cryptoConversionId?: string;

    blockchainTxId?: string;

    metadata?: Prisma.JsonValue;

  }) {

    const reference =
      `WT-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

    return this.app.prisma.walletTransfer.create({

      data: {

        merchantId: data.merchantId,

        fromWalletId: data.fromWalletId,

        toWalletId: data.toWalletId,

        amount: data.amount,

        currency: data.currency,

        fee: data.fee ??
          new Prisma.Decimal(0),

        type: data.type,

        status: "pending",

        reference,

        blockchainTxId:
          data.blockchainTxId,

        cryptoConversionId:
          data.cryptoConversionId,

        metadata: data.metadata ?? Prisma.JsonNull,

      }

    });

  }

  async completeWalletTransfer(

    walletTransferId: string

  ) {

    return this.app.prisma.walletTransfer.update({

      where: {

        id: walletTransferId

      },

      data: {

        status: "completed",

        completedAt: new Date()

      }

    });

  }

  async failWalletTransfer(

    walletTransferId: string

  ) {

    return this.app.prisma.walletTransfer.update({

      where: {

        id: walletTransferId

      },

      data: {

        status: "failed"

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Blockchain Fees
  |--------------------------------------------------------------------------
  */

  async latestFee(

    blockchain: any,

    feeType: string

  ) {

    return this.app.prisma.blockchainFee.findFirst({

      where: {

        blockchain,

        feeType

      },

      orderBy: {

        timestamp: "desc"

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Lookup
  |--------------------------------------------------------------------------
  */

  async findTransaction(

    txId: string

  ) {

    return this.app.prisma.blockchainTransaction.findUnique({

      where: {

        id: txId

      },

      include: {
        wallet: true,
        confirmationsHistory: true,
        walletTransfer: true

      }

    });

  }

  async findTransfer(

    transferId: string

  ) {

    return this.app.prisma.walletTransfer.findUnique({

      where: {

        id: transferId

      },

      include: {

        merchant: true,

        fromWallet: true,

        toWallet: true,

        blockchainTransaction: true,

        cryptoConversion: true

      }

    });

  }

}
