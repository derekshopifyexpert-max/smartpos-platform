-- AlterTable: Make merchantId nullable
ALTER TABLE "PaymentIntent" 
  ALTER COLUMN "merchantId" DROP NOT NULL;

-- AddColumn: Add paymentProviderAccountId to PaymentIntent
ALTER TABLE "PaymentIntent" 
  ADD COLUMN "paymentProviderAccountId" TEXT;

-- CreateIndex: Index on paymentProviderAccountId in PaymentIntent
CREATE INDEX "PaymentIntent_paymentProviderAccountId_idx" ON "PaymentIntent"("paymentProviderAccountId");

-- AddColumn: Add paymentProviderAccountId to PaymentAttempt
ALTER TABLE "PaymentAttempt" 
  ADD COLUMN "paymentProviderAccountId" TEXT;

-- CreateIndex: Index on paymentProviderAccountId in PaymentAttempt
CREATE INDEX "PaymentAttempt_paymentProviderAccountId_idx" ON "PaymentAttempt"("paymentProviderAccountId");
