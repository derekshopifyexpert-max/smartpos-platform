import { PrismaClient, Prisma } from "@prisma/client";
import CryptoSettlementService from "../src/services/crypto-settlement.service.js";

async function main() {
  process.env.USE_MOCK_CRYPTO_PROVIDER = "true";

  const prisma = new PrismaClient();

  console.log("Creating test merchant and payment records...");

  const merchant = await prisma.merchant.upsert({
    where: { email: "e2e-merchant@example.test" },
    update: {},
    create: {
      name: "E2E Merchant",
      email: "e2e-merchant@example.test",
      businessType: "e2e",
      currency: "NGN",
    },
  });

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      merchantId: merchant.id,
      amount: new Prisma.Decimal(1000),
      currency: "NGN",
      status: "PENDING",
      description: "E2E test payment",
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      merchantId: merchant.id,
      amount: new Prisma.Decimal(1000),
      currency: "NGN",
      type: "SALE",
      paymentMethod: "card",
      reference: `e2e-${Date.now()}`,
      paymentIntentId: paymentIntent.id,
    },
  });

  console.log("Created paymentIntent:", paymentIntent.id, "transaction:", transaction.id);

  const app: any = { prisma, logger: console };

  const settlementService = new CryptoSettlementService(app);

  console.log("Executing crypto settlement (mock provider)...");

  const result = await settlementService.executeSettlement(paymentIntent.id, {
    transactionId: transaction.id,
    asset: "USDT",
    network: "TRON",
    destinationAddress: "TXYZTESTADDRESSMOCK123456",
  });

  console.log("Settlement result:", result);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
