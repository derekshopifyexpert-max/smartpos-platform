import {
  Prisma,
  SettlementStatus
} from "@prisma/client";

import { FastifyInstance } from "fastify";

import crypto from "crypto";

export default class SettlementService {

  constructor(
    private readonly app: FastifyInstance
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  private generateReference(): string {

    return `SET-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

  }

  /*
  |--------------------------------------------------------------------------
  | Settlement
  |--------------------------------------------------------------------------
  */

  async createSettlement(data: {

    merchantId: string;

    walletId: string;

    bankAccountId?: string;

    batchId?: string;

    amount: Prisma.Decimal;

    currency: any;

    fee?: Prisma.Decimal;

    metadata?: Prisma.JsonValue;

  }) {

    const fee =
      data.fee ??
      new Prisma.Decimal(0);

    const netAmount =
      data.amount.sub(fee);

    return this.app.prisma.settlement.create({

      data: {

        merchantId: data.merchantId,

        walletId: data.walletId,

        bankAccountId: data.bankAccountId,

        batchId: data.batchId,

        amount: data.amount,

        currency: data.currency,

        fee,

        netAmount,

        metadata: data.metadata ?? Prisma.JsonNull,

        reference:
          this.generateReference(),

        status:
          SettlementStatus.PENDING

      }

    });

  }

  async processSettlement(

    settlementId: string

  ) {

    return this.app.prisma.settlement.update({

      where: {

        id: settlementId

      },

      data: {

        status:
          SettlementStatus.PROCESSING,

        processedAt:
          new Date(),

        attemptCount: {

          increment: 1

        }

      }

    });

  }

  async completeSettlement(

    settlementId: string

  ) {

    return this.app.prisma.settlement.update({

      where: {

        id: settlementId

      },

      data: {

        status:
          SettlementStatus.COMPLETED,

        completedAt:
          new Date()

      }

    });

  }

  async failSettlement(

    settlementId: string

  ) {

    return this.app.prisma.settlement.update({

      where: {

        id: settlementId

      },

      data: {

        status:
          SettlementStatus.FAILED,

        attemptCount: {

          increment: 1

        }

      }

    });

  }

  async listCryptoSettlements(merchantId: string) {
    const paymentIntents = await this.app.prisma.paymentIntent.findMany({
      where: {
        merchantId,
        transactions: {
          some: {
            OR: [
              { cryptoConversionId: { not: null } },
              { blockchainTransactionId: { not: null } },
            ],
          },
        },
      },
      include: {
        paymentProviderAccount: {
          select: { id: true, displayName: true, provider: true, currency: true, status: true },
        },
        customer: { select: { email: true } },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            cryptoConversion: true,
            blockchainTransaction: {
              include: { blockchain: { select: { name: true, explorerUrl: true } } },
            },
            wallet: { select: { id: true, name: true, currency: true, status: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(paymentIntents.map((paymentIntent) => this.normalizeCryptoSettlement(paymentIntent)));
  }

  async getCryptoSettlement(merchantId: string, paymentIntentId: string) {
    const paymentIntent = await this.app.prisma.paymentIntent.findFirst({
      where: {
        id: paymentIntentId,
        merchantId,
        transactions: {
          some: {
            OR: [
              { cryptoConversionId: { not: null } },
              { blockchainTransactionId: { not: null } },
            ],
          },
        },
      },
      include: {
        paymentProviderAccount: {
          select: { id: true, displayName: true, provider: true, currency: true, status: true },
        },
        customer: { select: { email: true } },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            cryptoConversion: true,
            blockchainTransaction: {
              include: { blockchain: { select: { name: true, explorerUrl: true } } },
            },
            wallet: { select: { id: true, name: true, currency: true, status: true, address: true } },
          },
        },
      },
    });

    if (!paymentIntent) return null;
    return this.normalizeCryptoSettlement(paymentIntent);
  }

  private async normalizeCryptoSettlement(paymentIntent: any) {
    const transaction = paymentIntent.transactions[0];
    const conversion = transaction?.cryptoConversion;
    const order = conversion?.exchangeOrderId
      ? await this.app.prisma.exchangeOrder.findFirst({
          where: { id: conversion.exchangeOrderId, merchantId: paymentIntent.merchantId },
          include: { exchangeProvider: { select: { name: true } }, trades: true },
        })
      : null;
    const blockchain = transaction?.blockchainTransaction;
    const metadata = conversion?.metadata && typeof conversion.metadata === "object"
      ? conversion.metadata as Record<string, unknown>
      : {};
    const settlementMetadata = transaction?.metadata && typeof transaction.metadata === "object"
      ? (transaction.metadata as Record<string, unknown>).cryptoSettlement as Record<string, unknown> | undefined
      : undefined;

    return {
      id: paymentIntent.id,
      payment: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerEmail: paymentIntent.customer?.email,
        createdAt: paymentIntent.createdAt,
        updatedAt: paymentIntent.updatedAt,
      },
      paymentProviderAccount: paymentIntent.paymentProviderAccount,
      conversion: conversion ? {
        id: conversion.id,
        fromCurrency: conversion.fromCurrency,
        toCurrency: conversion.toCurrency,
        requestedAmount: conversion.fromAmount,
        quotedAmount: metadata.quoteAmount,
        acquiredAmount: conversion.toAmount,
        rate: conversion.rate,
        fee: conversion.fee,
        status: conversion.status,
        quoteId: metadata.quoteId,
        quoteExpiresAt: metadata.quoteExpiresAt,
        createdAt: conversion.createdAt,
        updatedAt: conversion.updatedAt,
      } : null,
      order: order ? {
        id: order.id,
        providerOrderId: order.orderId,
        provider: order.exchangeProvider.name,
        symbol: order.symbol,
        side: order.side,
        requestedAmount: order.amount,
        filledAmount: order.filledAmount,
        averagePrice: order.avgPrice,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        clientOrderId: (order.metadata as Record<string, unknown> | null)?.clientOrderId,
        quoteId: (order.metadata as Record<string, unknown> | null)?.quoteId,
        fills: order.trades,
      } : null,
      wallet: transaction?.wallet,
      blockchain: blockchain ? {
        id: blockchain.id,
        txHash: blockchain.txHash,
        network: blockchain.blockchain.name,
        explorerUrl: blockchain.blockchain.explorerUrl,
        fromAddress: blockchain.fromAddress,
        toAddress: blockchain.toAddress,
        amount: blockchain.amount,
        currency: blockchain.currency,
        fee: blockchain.fee,
        blockNumber: blockchain.blockNumber,
        confirmations: blockchain.confirmations,
        status: blockchain.status,
        createdAt: blockchain.createdAt,
        updatedAt: blockchain.updatedAt,
      } : null,
      settlement: settlementMetadata ?? { status: conversion?.status ?? "PENDING" },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Batch
  |--------------------------------------------------------------------------
  */

  async createBatch(data: {

    merchantId: string;

    totalAmount: Prisma.Decimal;

    currency: any;

    totalFees: Prisma.Decimal;

    totalNet: Prisma.Decimal;

    transactionCount: number;

    metadata?: Prisma.JsonValue;

  }) {

    return this.app.prisma.settlementBatch.create({

      data: {

        merchantId: data.merchantId,

        batchReference:

          `BATCH-${Date.now()}`,

        totalAmount:
          data.totalAmount,

        currency:
          data.currency,

        totalFees:
          data.totalFees,

        totalNet:
          data.totalNet,

        transactionCount:
          data.transactionCount,

        metadata:
          data.metadata ?? Prisma.JsonNull

      }

    });

  }

  async completeBatch(

    batchId: string

  ) {

    return this.app.prisma.settlementBatch.update({

      where: {

        id: batchId

      },

      data: {

        status:
          SettlementStatus.COMPLETED,

        completedAt:
          new Date()

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Lookup
  |--------------------------------------------------------------------------
  */

  async findSettlement(

    settlementId: string

  ) {

    return this.app.prisma.settlement.findUnique({

      where: {

        id: settlementId

      },

      include: {

        merchant: true,

        wallet: true,

        bankAccount: true,

        settlementBatch: true,

        attempts: true,

        fees: true

      }

    });

  }

  async merchantSettlements(

    merchantId: string

  ) {

    return this.app.prisma.settlement.findMany({

      where: {

        merchantId

      },

      orderBy: {

        createdAt: "desc"

      }

    });

  }

  async batchSettlements(

    batchId: string

  ) {

    return this.app.prisma.settlement.findMany({

      where: {

        batchId

      }

    });

  }

}
