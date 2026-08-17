import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding payment provider accounts...");

  // Create Paystack Account 1
  const account1 = await prisma.paymentProviderAccount.upsert({
    where: { name: "paystack-account-1" },
    update: {},
    create: {
      name: "paystack-account-1",
      displayName: "Paystack Account 1",
      provider: "PAYSTACK",
      currency: "NGN",
      status: "NOT_CONFIGURED",
      secretKeyRef: "PAYSTACK_ACCOUNT_1_SECRET_KEY",
      publicKey: null,
      isDefault: true,
    },
  });

  console.log("Created/Updated:", account1.id, account1.name);

  // Create Paystack Account 2
  const account2 = await prisma.paymentProviderAccount.upsert({
    where: { name: "paystack-account-2" },
    update: {},
    create: {
      name: "paystack-account-2",
      displayName: "Paystack Account 2",
      provider: "PAYSTACK",
      currency: "NGN",
      status: "NOT_CONFIGURED",
      secretKeyRef: "PAYSTACK_ACCOUNT_2_SECRET_KEY",
      publicKey: null,
      isDefault: false,
    },
  });

  console.log("Created/Updated:", account2.id, account2.name);

  // Create Paystack USD Account (future support)
  const account3 = await prisma.paymentProviderAccount.upsert({
    where: { name: "paystack-account-usd" },
    update: {},
    create: {
      name: "paystack-account-usd",
      displayName: "Paystack USD Account",
      provider: "PAYSTACK",
      currency: "USD",
      status: "NOT_CONFIGURED",
      secretKeyRef: "PAYSTACK_ACCOUNT_USD_SECRET_KEY",
      publicKey: null,
      isDefault: false,
    },
  });

  console.log("Created/Updated:", account3.id, account3.name);

  console.log("\nPayment provider accounts seeded successfully!");
  console.log(
    "Note: All accounts are currently NOT_CONFIGURED. Add credentials via environment variables or update status via API."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
