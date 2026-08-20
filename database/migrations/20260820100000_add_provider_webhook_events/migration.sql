CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "providerReference" TEXT,
    "merchantReference" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderWebhookEvent_eventId_key" ON "ProviderWebhookEvent"("eventId");
CREATE INDEX "ProviderWebhookEvent_provider_eventName_idx" ON "ProviderWebhookEvent"("provider", "eventName");
CREATE INDEX "ProviderWebhookEvent_providerReference_idx" ON "ProviderWebhookEvent"("providerReference");
CREATE INDEX "ProviderWebhookEvent_receivedAt_idx" ON "ProviderWebhookEvent"("receivedAt" DESC);