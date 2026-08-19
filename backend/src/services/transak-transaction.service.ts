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

  async applyWebhook(event: {
    eventId: string;
    eventType: string;
    providerOrderId?: string;
    payload: Record<string, unknown>;
  }) {
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(event.payload)).digest("hex");
    const existingEvent = await this.app.prisma.transakWebhookEvent.findUnique({
      where: { eventId: event.eventId },
    });
    if (existingEvent) return { duplicate: true, transactionId: existingEvent.transactionId };

    const providerOrderId = event.providerOrderId || this.readString(event.payload, ["orderId", "providerOrderId", "id"]);
    const transaction = providerOrderId
      ? await this.app.prisma.transakTransaction.findUnique({ where: { transakOrderId: providerOrderId } })
      : null;

    const webhookEvent = await this.app.prisma.transakWebhookEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        transakOrderId: providerOrderId,
        transactionId: transaction?.id,
        payloadHash,
        processingStatus: transaction ? "PROCESSING" : "UNMATCHED",
        safePayload: this.safePayload(event.payload),
      },
    });

    if (!transaction) {
      await this.app.prisma.transakWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processedAt: new Date() },
      });
      return { duplicate: false, transactionId: null };
    }

    const status = this.normalizeStatus(
      this.readString(event.payload, ["status", "orderStatus"]) || event.eventType
    );
    await this.app.prisma.transakTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        providerStatus: this.readString(event.payload, ["status", "orderStatus"]) || event.eventType,
        amountPaid: this.decimalOrUndefined(this.readString(event.payload, ["amountPaid", "fiatAmount"])),
        cryptoAmount: this.decimalOrUndefined(this.readString(event.payload, ["cryptoAmount", "amount"])),
        transactionHash: this.readString(event.payload, ["transactionHash", "txHash"]),
        transactionLink: this.readString(event.payload, ["transactionLink", "txLink"]),
        failureReason: this.readString(event.payload, ["failureReason", "error"]),
        completedAt: status === "COMPLETED" ? new Date() : undefined,
        failedAt: status === "FAILED" ? new Date() : undefined,
      },
    });
    await this.app.prisma.transakWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
    return { duplicate: false, transactionId: transaction.id };
  }

  private readString(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) if (typeof payload[key] === "string" && payload[key].trim()) return payload[key].trim();
    return undefined;
  }

  private decimalOrUndefined(value?: string) {
    return value ? new Prisma.Decimal(value) : undefined;
  }

  private safePayload(payload: Record<string, unknown>) {
    const safe = { ...payload };
    for (const key of ["apiKey", "apiSecret", "accessToken", "authorization", "cardNumber", "cvv", "pan"]) delete safe[key];
    return safe as Prisma.InputJsonValue;
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
