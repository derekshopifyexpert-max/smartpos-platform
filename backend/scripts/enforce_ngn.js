 (async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    console.log("Searching for merchants with non-NGN currency...");
    const nonNgnMerchants = await prisma.merchant.findMany({
      where: { currency: { not: "NGN" } },
      select: { id: true, name: true, currency: true },
    });

    console.log(`Found ${nonNgnMerchants.length} merchants to update.`);

    if (nonNgnMerchants.length > 0) {
      const updatedMerchants = await prisma.merchant.updateMany({
        where: { currency: { not: "NGN" } },
        data: { currency: "NGN" },
      });

      console.log("Merchants updated:", updatedMerchants);
    }

    const updatedPaymentIntents = await prisma.paymentIntent.updateMany({
      where: { currency: { not: "NGN" } },
      data: { currency: "NGN" },
    });

    console.log("Payment intents updated:", updatedPaymentIntents);

    const updatedTransactions = await prisma.transaction.updateMany({
      where: { currency: { not: "NGN" } },
      data: { currency: "NGN" },
    });

    console.log("Transactions updated:", updatedTransactions);

    const sampleMerchant = await prisma.merchant.findFirst({
      where: {},
      select: { id: true, name: true, currency: true },
    });

    console.log("Sample merchant:", sampleMerchant);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
