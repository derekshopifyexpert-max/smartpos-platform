-- Allow card payment transactions without a merchant association.
ALTER TABLE "Transaction"
  ALTER COLUMN "merchantId" DROP NOT NULL;
