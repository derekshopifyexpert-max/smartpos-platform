import crypto from "node:crypto";
import {
  CardBrand,
  Prisma,
  ProviderWebhookEvent,
  TransactionStatus,
} from "@prisma/client";

import FlutterwaveProvider from "../providers/flutterwave.provider.js";

export function normalizeFlutterwaveCardBrand(value?: unknown): CardBrand | null {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return null;
  }

  if (raw.includes("visa")) return CardBrand.VISA;
  if (raw.includes("master") || raw.includes("maestro")) return CardBrand.MASTERCARD;
  if (raw.includes("amex")) return CardBrand.AMEX;
  if (raw.includes("discover")) return CardBrand.DISCOVER;
  if (raw.includes("diners")) return CardBrand.DINERS;
  if (raw.includes("jcb")) return CardBrand.JCB;
  if (raw.includes("union")) return CardBrand.UNIONPAY;
  if (raw.includes("verve")) return CardBrand.VERVE;
  if (raw.includes("rupay")) return CardBrand.RUPAY;

  return null;
}

export function mapFlutterwaveStatusToTransactionStatus(status?: string | null): TransactionStatus {
  const normalized = String(status ?? "").trim().toLowerCase();

  const mapping: Record<string, TransactionStatus> = {
    successful: TransactionStatus.SETTLED,
    success: TransactionStatus.SETTLED,
    paid: TransactionStatus.SETTLED,
    completed: TransactionStatus.SETTLED,
    approved: TransactionStatus.APPROVED,
    authorized: TransactionStatus.AUTHORIZED,
    captured: TransactionStatus.CAPTURED,
    pending: TransactionStatus.PENDING,
    processing: TransactionStatus.PENDING,
    failed: TransactionStatus.FAILED,
    declined: TransactionStatus.DECLINED,
    cancelled: TransactionStatus.CANCELLED,
    canceled: TransactionStatus.CANCELLED,
    expired: TransactionStatus.EXPIRED,
    refunded: TransactionStatus.REFUNDED,
    reversed: TransactionStatus.REVERSED,
    chargeback: TransactionStatus.CHARGEBACK,
    disputed: TransactionStatus.DISPUTED,
  };

  return mapping[normalized] ?? TransactionStatus.PENDING;
}

export type FlutterwaveWebhookPayload = {
  id?: string | number;
  event?: string;
  type?: string;
  data?: {
    id?: string | number;
    tx_ref?: string;
    status?: string;
    amount?: number | string;
    currency?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export default class FlutterwaveWebhookService {
  private readonly provider: FlutterwaveProvider;

  constructor(
    private readonly app: {
      prisma: Prisma.TransactionClient | any;
    },
    secretKey: string,
  ) {
    this.provider =
      new FlutterwaveProvider(secretKey);
  }

  /**
   * Persist an incoming Flutterwave webhook.
   *
   * IMPORTANT:
   * This uses ProviderWebhookEvent, NOT WebhookDelivery.
   */
  async receiveWebhook(
    payload: FlutterwaveWebhookPayload,
  ): Promise<ProviderWebhookEvent> {
    const eventId =
      payload?.id !== undefined &&
      payload?.id !== null
        ? String(payload.id)
        : undefined;

    if (!eventId) {
      throw new Error(
        "Flutterwave webhook event ID is required.",
      );
    }

    const eventName =
      typeof payload.event === "string" &&
      payload.event.trim()
        ? payload.event.trim()
        : typeof payload.type === "string" &&
            payload.type.trim()
          ? payload.type.trim()
          : "unknown";

    const transactionReference =
      typeof payload?.data?.tx_ref === "string" &&
      payload.data.tx_ref.trim()
        ? payload.data.tx_ref.trim()
        : undefined;

    const providerReference =
      payload?.data?.id !== undefined &&
      payload?.data?.id !== null
        ? String(payload.data.id)
        : undefined;

    const serializedPayload =
      JSON.stringify(payload);

    const payloadHash =
      crypto
        .createHash("sha256")
        .update(serializedPayload, "utf8")
        .digest("hex");

    /*
     * Idempotency:
     *
     * Flutterwave may retry the same webhook.
     * eventId is UNIQUE in ProviderWebhookEvent.
     */
    const existing =
      await this.app.prisma.providerWebhookEvent.findUnique({
        where: {
          eventId,
        },
      });

    if (existing) {
      return existing;
    }

    return this.app.prisma.providerWebhookEvent.create({
      data: {
        provider: "flutterwave",

        eventId,

        eventName,

        providerReference,

        merchantReference:
          transactionReference,

        payloadHash,

        status: "RECEIVED",

        rawPayload:
          payload as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Process a persisted Flutterwave webhook event.
   *
   * The first responsibility here is to verify the provider
   * transaction against Flutterwave rather than trusting the
   * webhook payload blindly.
   */
  async processWebhook(
    providerWebhookEventId: string,
  ) {
    const webhook =
      await this.app.prisma.providerWebhookEvent.findUnique({
        where: {
          id: providerWebhookEventId,
        },
      });

    if (!webhook) {
      throw new Error(
        "Flutterwave provider webhook event not found.",
      );
    }

    /*
     * Idempotent processing.
     */
    if (webhook.status === "PROCESSED") {
      return webhook;
    }

    if (webhook.status === "PROCESSING") {
      return webhook;
    }

    await this.app.prisma.providerWebhookEvent.update({
      where: {
        id: providerWebhookEventId,
      },

      data: {
        status: "PROCESSING",
        error: null,
      },
    });

    try {
      const payload =
        webhook.rawPayload as FlutterwaveWebhookPayload;

      const transactionReference =
        webhook.merchantReference ||
        payload?.data?.tx_ref;

      if (!transactionReference) {
        throw new Error(
          "Flutterwave webhook does not contain a transaction reference.",
        );
      }

      /*
       * Resolve the provider webhook to the real SmartPOS
       * Transaction using Transaction.reference.
       */
      const transaction =
        await this.app.prisma.transaction.findFirst({
          where: {
            reference:
              transactionReference,
          },

          select: {
            id: true,
            reference: true,
            metadata: true,
            paymentMethod: true,
            cardBrand: true,
            cardLastFour: true,
            gatewayTransactionId: true,
            gatewayProvider: true,
          },
        });

      if (!transaction) {
        throw new Error(
          `No SmartPOS transaction found for Flutterwave tx_ref "${transactionReference}".`,
        );
      }

      /*
       * If Flutterwave supplied a provider transaction ID,
       * re-query Flutterwave instead of trusting the webhook
       * status alone.
       */
      let verified = false;
      let providerStatus: string | undefined;

      const providerTransactionId =
        payload?.data?.id !== undefined &&
        payload?.data?.id !== null
          ? String(payload.data.id)
          : webhook.providerReference;

      let verification: Awaited<ReturnType<FlutterwaveProvider["verifyPayment"]>> | undefined;

      if (providerTransactionId) {
        verification =
          await this.provider.verifyPayment({
            transactionId:
              providerTransactionId,
          });

        verified =
          verification.success;

        providerStatus =
          verification.status ||
          payload?.data?.status ||
          undefined;
      }

      const flutterwaveStatus =
        providerStatus ||
        payload?.data?.status ||
        "pending";

      const providerPayload =
        (verification?.raw ?? payload?.data ?? {}) as Record<string, unknown>;

      const providerData =
        providerPayload && typeof providerPayload === "object"
          ? providerPayload
          : {};

      const cardData =
        (providerData.card ?? providerData.card_details ?? providerData.cardDetails ?? providerData.authorization ?? {}) as Record<string, unknown>;

      const normalizedCardBrand =
        normalizeFlutterwaveCardBrand(
          cardData.brand ??
            cardData.type ??
            cardData.network ??
            providerData.card_type ??
            providerData.cardType,
        );

      const normalizedCardLastFour =
        typeof cardData.last4 === "string"
          ? cardData.last4
          : typeof cardData.last_4 === "string"
            ? cardData.last_4
            : typeof cardData.pan === "string"
              ? cardData.pan.slice(-4)
              : typeof providerData.last4 === "string"
                ? providerData.last4
                : transaction?.cardLastFour ?? null;

      const existingMetadata =
        transaction?.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
          ? transaction.metadata
          : {};

      await this.app.prisma.transaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: mapFlutterwaveStatusToTransactionStatus(flutterwaveStatus),
          gatewayTransactionId:
            providerTransactionId || transaction.gatewayTransactionId || null,
          gatewayProvider: "flutterwave",
          cardBrand: normalizedCardBrand ?? transaction.cardBrand ?? null,
          cardLastFour:
            normalizedCardLastFour && String(normalizedCardLastFour).trim()
              ? String(normalizedCardLastFour).trim()
              : transaction.cardLastFour ?? null,
          metadata: {
            ...(existingMetadata as Prisma.InputJsonObject),
            flutterwaveStatus,
            flutterwaveProviderTransactionId: providerTransactionId ?? transaction.gatewayTransactionId ?? null,
            flutterwaveVerification: { success: verified, status: providerStatus ?? flutterwaveStatus },
          },
        },
      });

      const processed =
        await this.app.prisma.providerWebhookEvent.update({
          where: {
            id: providerWebhookEventId,
          },

          data: {
            status:
              providerTransactionId && !verified
                ? "VERIFICATION_FAILED"
                : "PROCESSED",

            processedAt:
              new Date(),

            error:
              providerTransactionId && !verified
                ? `Flutterwave transaction verification failed. Provider status: ${providerStatus ?? "unknown"}.`
                : null,
          },
        });

      return {
        webhook: processed,
        transactionId:
          transaction.id,
        transactionReference:
          transaction.reference,
        verified,
        providerStatus,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Flutterwave webhook processing failed.";

      await this.app.prisma.providerWebhookEvent.update({
        where: {
          id: providerWebhookEventId,
        },

        data: {
          status: "FAILED",

          error: message,
        },
      });

      throw error;
    }
  }
}