import { FastifyInstance } from "fastify";

import WebhookService from "../services/webhook.service.js";
import WebhookController from "../controllers/webhook.controller.js";

export default async function webhookRoutes(
  app: FastifyInstance
) {

  const service =
    new WebhookService(app);

  const controller =
    new WebhookController(service);

  app.post(

    "/webhooks",

    controller.receive

  );

  app.post(

    "/webhooks/:id/process",

    controller.process

  );

  // Paystack webhook endpoint — validates signature and performs idempotent processing
  app.post(
    "/webhooks/paystack",
    async (request, reply) => {
      const payload = request.body as any;

      const signature = (request.headers["x-paystack-signature"] as string) || (request.headers["X-Paystack-Signature"] as string) || "";

      if (!signature) {
        app.log.warn("Missing Paystack webhook signature header");
        return reply.code(400).send({ success: false, message: "Missing signature" });
      }

      // Only handle charge.success for now
      const event = String(payload?.event ?? "").toLowerCase();

      if (event !== "charge.success") {
        return reply.code(200).send({ success: true, message: "ignored" });
      }

      const data = payload?.data ?? {};
      const reference = data?.reference;

      if (!reference) {
        return reply.code(400).send({ success: false, message: "Missing reference" });
      }

      try {
        // Find the transaction by reference to identify which Paystack account it belongs to
        const transaction = await app.prisma.transaction.findUnique({
          where: { reference },
          include: {
            paymentIntent: {
              include: {
                paymentProviderAccount: true
              }
            }
          }
        });

        if (!transaction) {
          app.log.warn({ reference }, "Paystack webhook for unknown transaction reference");
          return reply.code(404).send({ success: false, message: "Transaction not found" });
        }

        // Determine which Paystack account processed this payment
        const paymentProviderAccountId = transaction.paymentIntent?.paymentProviderAccountId;
        
        if (!paymentProviderAccountId) {
          app.log.warn({ reference }, "Transaction missing payment provider account reference");
          return reply.code(400).send({ success: false, message: "Payment account information missing" });
        }

        // Resolve the webhook secret for this specific account
        let webhookSecret: string | undefined;
        
        try {
          const PaymentProviderAccountService = await import("../services/payment-provider-account.service.js");
          const accountService = new PaymentProviderAccountService.default(app);
          const credentials = await accountService.resolveCredentials(paymentProviderAccountId);
          
          // For Paystack, the webhook secret is typically stored in metadata or as a separate field
          // If not found in credentials, fall back to env var as last resort
          webhookSecret = credentials.webhookSecret || process.env.PAYSTACK_WEBHOOK_SECRET;
        } catch (err) {
          app.log.warn(
            { err, paymentProviderAccountId },
            "Failed to resolve webhook secret for payment provider account; falling back to environment variable"
          );
          webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
        }

        if (!webhookSecret) {
          app.log.error("PAYSTACK_WEBHOOK_SECRET not configured for account or globally");
          return reply.code(500).send({ success: false, message: "Webhook secret not configured" });
        }

        // Validate signature using the correct account's webhook secret
        try {
          const crypto = await import("crypto");
          const expected = crypto.createHmac("sha512", webhookSecret).update(JSON.stringify(payload)).digest("hex");

          if (expected !== signature) {
            app.log.warn(
              { reference, paymentProviderAccountId },
              "Invalid Paystack webhook signature for account"
            );
            return reply.code(400).send({ success: false, message: "Invalid signature" });
          }
        } catch (err) {
          app.log.error({ err }, "Failed to validate webhook signature");
          return reply.code(500).send({ success: false, message: "Signature validation failed" });
        }

        // Idempotency: perform an atomic conditional update. If another worker
        // already processed this reference the update count will be 0.
        const mergedMetadata =
          transaction.metadata && typeof transaction.metadata === "object"
            ? { ...(transaction.metadata as Record<string, unknown>), paystack: data }
            : { paystack: data };

        const txUpdate = await app.prisma.transaction.updateMany({
          where: { id: transaction.id, status: { notIn: ["CAPTURED", "SETTLED"] } },
          data: {
            status: "CAPTURED",
            gatewayTransactionId: data?.id ?? data?.reference ?? reference,
            metadata: mergedMetadata
          }
        });

        if (txUpdate.count === 0) {
          // Another process already captured/settled this transaction — treat as success.
          return reply.code(200).send({ success: true, message: "Already processed" });
        }

        // Mark any pending payment attempts for this transaction as captured (idempotent via updateMany)
        // Also store the payment provider account ID
        await app.prisma.paymentAttempt.updateMany({
          where: { transactionId: transaction.id, status: "PENDING" },
          data: {
            status: "CAPTURED",
            paymentProviderAccountId: paymentProviderAccountId,
            gatewayResponse: payload
          }
        });

        // Trigger fiat->crypto settlement asynchronously
        try {
          const orchestrator = new (await import("../services/payment-orchestrator.service.js")).default(app);

          // We intentionally run this without awaiting to return quickly to Paystack
          orchestrator.processFiatToCryptoSettlement(transaction.paymentIntentId!, { transactionId: transaction.id }).catch(err => {
            app.log.error({ err }, "Crypto settlement triggered from webhook failed");
          });
        } catch (err) {
          app.log.error({ err }, "Failed to enqueue/process settlement from webhook");
        }

        return reply.code(200).send({ success: true });
      } catch (err) {
        app.log.error({ err }, "Error processing Paystack webhook");
        return reply.code(500).send({ success: false, message: "Processing failed" });
      }
    }
  );

}
