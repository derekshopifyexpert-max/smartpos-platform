import { Prisma } from "@prisma/client";
import ExchangeService from "./exchange.service.js";

function isOrderEvent(eventName: string): boolean {
  return ["order.done", "order.cancelled", "order.canceled", "order.updated"].includes(eventName.toLowerCase());
}

export default class QuidaxWebhookService {
  private readonly exchangeService: ExchangeService;

  constructor(private readonly app: any) {
    this.exchangeService = new ExchangeService(app);
  }

  async processEvent(input: { eventName: string; providerReference?: string; eventId: string }) {
    if (!input.providerReference || !isOrderEvent(input.eventName)) {
      return { processed: false, reason: "No supported order re-query mapping." };
    }

    const localOrder = await this.app.prisma.exchangeOrder.findFirst({
      where: { orderId: input.providerReference },
      include: { trades: true },
    });

    if (!localOrder) {
      await this.markEvent(input.eventId, "RECEIVED", "No matching merchant exchange order.");
      return { processed: false, reason: "Order not found." };
    }

    const provider = await this.exchangeService.getExchangeProvider();
    const latest = await provider.getOrder(input.providerReference);
    const metadata = localOrder.metadata && typeof localOrder.metadata === "object" && !Array.isArray(localOrder.metadata)
      ? localOrder.metadata as Record<string, unknown>
      : {};

    await this.app.prisma.exchangeOrder.update({
      where: { id: localOrder.id },
      data: {
        status: latest.status,
        filledAmount: latest.executedAmount,
        avgPrice: latest.averagePrice,
        price: latest.averagePrice,
        updatedAt: latest.updatedAt,
        metadata: {
          ...metadata,
          quidaxProvider: "QUIDAX",
          quidaxLastStatus: latest.status,
          quidaxLastCheckedAt: new Date().toISOString(),
          quidaxFee: latest.totalFee.toString(),
          quidaxFeeCurrency: latest.feeCurrency,
        } as Prisma.JsonValue,
      },
    });

    const conversion = await this.app.prisma.cryptoConversion.findFirst({
      where: { exchangeOrderId: localOrder.id },
    });

    if (conversion) {
      const conversionStatus = latest.status === "FILLED"
        ? "exchange_completed"
        : ["FAILED", "REJECTED", "CANCELED", "EXPIRED"].includes(latest.status)
          ? "failed"
          : "exchange_pending";
      await this.app.prisma.cryptoConversion.update({
        where: { id: conversion.id },
        data: {
          status: conversionStatus,
          toAmount: latest.executedAmount,
          rate: latest.averagePrice,
          metadata: {
            ...(conversion.metadata && typeof conversion.metadata === "object" && !Array.isArray(conversion.metadata) ? conversion.metadata : {}),
            quidaxEventId: input.eventId,
            quidaxStatus: latest.status,
            actualExecutedAmount: latest.executedAmount.toString(),
          } as Prisma.JsonValue,
        },
      });
    }

    await this.markEvent(input.eventId, "PROCESSED");
    return { processed: true, orderId: localOrder.id, status: latest.status };
  }

  private async markEvent(eventId: string, status: string, error?: string) {
    await this.app.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProviderWebhookEvent"
      SET "status" = ${status}, "processedAt" = ${new Date()}, "error" = ${error ?? null}, "updatedAt" = ${new Date()}
      WHERE "eventId" = ${eventId}
    `);
  }
}
