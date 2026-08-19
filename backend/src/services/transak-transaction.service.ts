import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED", "CANCELED", "EXPIRED"]);

export interface CreateTransakTransactionInput {
  merchantId: string;
  customerId?: string;
  paymentIntentId?: string;
  transakQuoteId?: string;
  fiatCurrency: string;
  fiatAmount: string;
  cryptoCurrency: string;
  network: string;
  walletAddress: string;
  paymentMethod?: string;
  cryptoAmount?: string;
  quoteRate?: string;
  feeAmount?: string;
  feeCurrency?: string;
}

export default class TransakTransactionService {
  constructor(private readonly app: FastifyInstance) {}

  async createOrGet(input: CreateTransakTransactionInput, transactionId?: string) {
    if (transactionId) {
      const existing = await this.app.prisma.transakTransaction.findFirst({
        where: { id: transactionId, merchantId: input.merchantId },
      });
      if (existing) return existing;
    }

    const partnerOrderId = `SP-${crypto.randomUUID()}`;
    return this.app.prisma.transakTransaction.create({
      data: {
        merchantId: input.merchantId,
        customerId: input.customerId,
        paymentIntentId: input.paymentIntentId,
        transakQuoteId: input.transakQuoteId,
        partnerOrderId,
        direction: "BUY",
        fiatCurrency: input.fiatCurrency,
        fiatAmount: new Prisma.Decimal(input.fiatAmount),
        cryptoAmount: input.cryptoAmount ? new Prisma.Decimal(input.cryptoAmount) : undefined,
        cryptoCurrency: input.cryptoCurrency,
        network: input.network,
        walletAddress: input.walletAddress,
        paymentMethod: input.paymentMethod,
        provider: "TRANSAK",
        status: "PAYMENT_SETUP",
        quoteRate: input.quoteRate ? new Prisma.Decimal(input.quoteRate) : undefined,
        feeAmount: input.feeAmount ? new Prisma.Decimal(input.feeAmount) : undefined,
        feeCurrency: input.feeCurrency,
      },
    });
  }

  async markSessionFailure(id: string, merchantId: string, reason: string) {
    return this.app.prisma.transakTransaction.updateMany({
      where: { id, merchantId },
      data: { status: "FAILED", failureReason: reason, failedAt: new Date() },
    });
  }

  async list(merchantId: string) {
    return this.app.prisma.transakTransaction.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async get(merchantId: string, id: string) {
    return this.app.prisma.transakTransaction.findFirst({ where: { merchantId, id } });
  }

  async applyProviderOrder(merchantId: string, order: {
    providerOrderId: string;
    status: string;
    providerStatus?: string;
    fiatAmount?: string;
    cryptoAmount?: string;
    transactionHash?: string;
    transactionLink?: string;
    failureReason?: string;
    completedAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.app.prisma.transakTransaction.findFirst({
      where: { merchantId, transakOrderId: order.providerOrderId },
    });
    if (!existing) return null;

    const status = this.normalizeStatus(order.status);
    return this.app.prisma.transakTransaction.update({
      where: { id: existing.id },
      data: {
        status,
        providerStatus: order.providerStatus || order.status,
        amountPaid: order.fiatAmount ? new Prisma.Decimal(order.fiatAmount) : undefined,
        cryptoAmount: order.cryptoAmount ? new Prisma.Decimal(order.cryptoAmount) : undefined,
        transactionHash: order.transactionHash,
        transactionLink: order.transactionLink,
        failureReason: order.failureReason,
        completedAt: status === "COMPLETED" ? (order.completedAt ? new Date(order.completedAt) : new Date()) : undefined,
        failedAt: status === "FAILED" ? new Date() : undefined,
        metadata: order.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  normalizeStatus(providerStatus: string): string {
    const normalized = providerStatus.trim().toUpperCase();
    if (["ORDER_CREATED", "CREATED"].includes(normalized)) return "INITIATED";
    if (["PAYMENT_VERIFYING", "VERIFYING"].includes(normalized)) return "PAYMENT_VERIFYING";
    if (["PAYMENT_PENDING", "PENDING"].includes(normalized)) return "PAYMENT_PENDING";
    if (["ORDER_PROCESSING", "PROCESSING"].includes(normalized)) return "PROCESSING";
    if (["CRYPTO_PURCHASED", "CRYPTO_SENT"].includes(normalized)) return "CRYPTO_PURCHASED";
    if (["BLOCKCHAIN_PENDING", "BLOCKCHAIN_CONFIRMING"].includes(normalized)) return "BLOCKCHAIN_PENDING";
    if (["ORDER_COMPLETED", "COMPLETED"].includes(normalized)) return "COMPLETED";
    if (["ORDER_FAILED", "FAILED"].includes(normalized)) return "FAILED";
    if (["ORDER_CANCELLED", "CANCELLED", "CANCELED"].includes(normalized)) return "CANCELLED";
    if (terminalStatuses.has(normalized)) return normalized;
    return "PROVIDER_STATUS_UNKNOWN";
  }
}
