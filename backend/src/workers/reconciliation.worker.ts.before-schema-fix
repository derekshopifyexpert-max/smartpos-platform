import { PaymentStatus } from "@prisma/client";

export default function createReconciliationWorker(app: any) {
  const intervalMs = process.env.RECONCILIATION_POLL_INTERVAL_MS
    ? Number(process.env.RECONCILIATION_POLL_INTERVAL_MS)
    : 60000;

  const timer = setInterval(async () => {
    try {
      // Find payment intents that are CAPTURED but have no
      // crypto conversion or blockchain transfer.
      const stale = await app.prisma.paymentIntent.findMany({
        where: {
          status: PaymentStatus.CAPTURED,
          createdAt: {
            lt: new Date(Date.now() - 1000 * 60 * 5),
          },
        },
        include: {
          paymentAttempts: true,
          transaction: true,
        },
      });

      for (const paymentIntent of stale) {
        const conversion =
          await app.prisma.cryptoConversion.findFirst({
            where: {
              paymentIntentId: paymentIntent.id,
            },
          });

        if (!conversion) {
          app.log.warn(
            {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
            },
            "Captured payment without conversion - reconciliation required",
          );

          continue;
        }

        const blockchainTransaction =
          conversion.blockchainTransactionId
            ? await app.prisma.blockchainTransaction.findUnique({
                where: {
                  id: conversion.blockchainTransactionId,
                },
              })
            : null;

        if (!blockchainTransaction) {
          app.log.warn(
            {
              paymentIntentId: paymentIntent.id,
              conversionId: conversion.id,
            },
            "Conversion exists but no blockchain transaction recorded",
          );
        }
      }
    } catch (err) {
      app.log.error(
        { err },
        "reconciliation worker error",
      );
    }
  }, intervalMs);

  return {
    stop: async () => {
      clearInterval(timer);
    },
  };
}