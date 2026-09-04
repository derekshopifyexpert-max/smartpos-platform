-- Configure Flutterwave as the hosted card checkout provider.
INSERT INTO "PaymentProvider" (
  "id",
  "name",
  "displayName",
  "isActive",
  "baseUrl",
  "priority",
  "createdAt",
  "updatedAt"
)
VALUES (
  'cmproviderflutterwave0000001',
  'flutterwave',
  'Flutterwave',
  true,
  'https://api.flutterwave.com/v3/payments',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "isActive" = true,
  "baseUrl" = EXCLUDED."baseUrl",
  "priority" = EXCLUDED."priority",
  "updatedAt" = CURRENT_TIMESTAMP;
