import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sameSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export default class QuidaxWebhookController {
  receive = async (request: FastifyRequest, reply: FastifyReply) => {
    const configuredSecret = process.env.SMARTPOS_WEBHOOK_SECRET?.trim();
    const authorization = safeString(request.headers.authorization);
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;

    if (!configuredSecret || !token || !sameSecret(token, configuredSecret)) {
      return reply.code(401).send({ success: false, error: "Webhook authentication failed." });
    }

    if (String(request.headers["x-smartpos-webhook-provider"] || "").toLowerCase() !== "quidax") {
      return reply.code(400).send({ success: false, error: "Unsupported webhook provider." });
    }

    if (String(request.headers["x-smartpos-webhook-version"] || "") !== "1") {
      return reply.code(400).send({ success: false, error: "Unsupported webhook envelope version." });
    }

    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      return reply.code(415).send({ success: false, error: "Webhook content type must be application/json." });
    }

    const webhookId = safeString(request.headers["x-smartpos-webhook-id"]);
    const body = request.body as Record<string, unknown> | undefined;
    if (body?.signatureVerified !== true) {
      return reply.code(400).send({ success: false, error: "Webhook signature verification was not confirmed by the Worker." });
    }
    const provider = safeString(body?.provider)?.toLowerCase();
    const event = body?.event && typeof body.event === "object" && !Array.isArray(body.event)
      ? body.event as Record<string, unknown>
      : undefined;
    const eventName = safeString(event?.name);
    const providerEventId = safeString(event?.providerEventId) || webhookId;
    const providerReference = safeString(event?.providerReference);
    const merchantReference = safeString(event?.merchantReference);

    if (provider !== "quidax" || !webhookId || !eventName || !providerEventId) {
      return reply.code(400).send({ success: false, error: "Incomplete normalized Quidax webhook envelope." });
    }

    const eventId = `quidax:${eventName}:${providerEventId}`;
    const payload = body ?? {};
    const payloadHash = hashPayload(payload);

    try {
      const existing = await request.server.prisma.$queryRaw<Array<{ eventId: string }>>(Prisma.sql`
        SELECT "eventId"
        FROM "ProviderWebhookEvent"
        WHERE "eventId" = ${eventId}
        LIMIT 1
      `);

      if (existing.length > 0) {
        return reply.code(200).send({ success: true, duplicate: true });
      }

      await request.server.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ProviderWebhookEvent" (
          "id", "provider", "eventId", "eventName", "providerReference",
          "merchantReference", "payloadHash", "status", "receivedAt",
          "processedAt", "rawPayload", "createdAt", "updatedAt"
        ) VALUES (
          ${eventId}, ${provider}, ${eventId}, ${eventName},
          ${providerReference ?? null}, ${merchantReference ?? null}, ${payloadHash},
          ${"RECEIVED"}, ${new Date()}, ${new Date()}, ${JSON.stringify(payload)}::jsonb,
          ${new Date()}, ${new Date()}
        )
      `);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "23505")) {
        return reply.code(200).send({ success: true, duplicate: true });
      }
      request.log.error({ eventName, providerEventId }, "Failed to persist Quidax webhook event");
      return reply.code(500).send({ success: false, error: "Webhook event could not be persisted." });
    }

    return reply.code(200).send({ success: true, accepted: true });
  };
}
