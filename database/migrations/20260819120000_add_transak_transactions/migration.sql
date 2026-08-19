-- Transak transaction records are provider-side orchestration records.
-- They do not hold customer crypto or card credentials.
CREATE TABLE "TransakTransaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "paymentIntentId" TEXT,
    "transakOrderId" TEXT,
    "transakQuoteId" TEXT,
    "partnerOrderId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'BUY',
    "fiatCurrency" TEXT NOT NULL,
    "fiatAmount" DECIMAL(36,18) NOT NULL,
    "amountPaid" DECIMAL(36,18),
    "cryptoCurrency" TEXT NOT NULL,
    "cryptoAmount" DECIMAL(36,18),
    "network" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'TRANSAK',
    "status" TEXT NOT NULL,
    "providerStatus" TEXT,
    "transactionHash" TEXT,
    "transactionLink" TEXT,
    "feeAmount" DECIMAL(36,18),
    "feeCurrency" TEXT,
    "quoteRate" DECIMAL(36,18),
    "failureReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransakTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TransakTransaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TransakWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transakOrderId" TEXT,
    "transactionId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "safePayload" JSONB NOT NULL,
    "error" TEXT,
    CONSTRAINT "TransakWebhookEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TransakWebhookEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "TransakTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TransakTransaction_transakOrderId_key" ON "TransakTransaction"("transakOrderId");
CREATE UNIQUE INDEX "TransakTransaction_partnerOrderId_key" ON "TransakTransaction"("partnerOrderId");
CREATE UNIQUE INDEX "TransakWebhookEvent_eventId_key" ON "TransakWebhookEvent"("eventId");
CREATE INDEX "TransakTransaction_merchantId_createdAt_idx" ON "TransakTransaction"("merchantId", "createdAt" DESC);
CREATE INDEX "TransakTransaction_status_idx" ON "TransakTransaction"("status");
CREATE INDEX "TransakTransaction_transakOrderId_idx" ON "TransakTransaction"("transakOrderId");
CREATE INDEX "TransakTransaction_paymentIntentId_idx" ON "TransakTransaction"("paymentIntentId");
CREATE INDEX "TransakWebhookEvent_transakOrderId_idx" ON "TransakWebhookEvent"("transakOrderId");
CREATE INDEX "TransakWebhookEvent_processingStatus_idx" ON "TransakWebhookEvent"("processingStatus");
CREATE INDEX "TransakWebhookEvent_receivedAt_idx" ON "TransakWebhookEvent"("receivedAt" DESC);
