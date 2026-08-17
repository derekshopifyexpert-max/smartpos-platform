export default function createReconciliationWorker(app: any) {
  const intervalMs = process.env.RECONCILIATION_POLL_INTERVAL_MS ? Number(process.env.RECONCILIATION_POLL_INTERVAL_MS) : 60000;

  const timer = setInterval(async () => {
    try {
      // find payment intents that are captured but have no crypto conversion or blockchain transfer
      const stale = await app.prisma.paymentIntent.findMany({
        where: {
          status: 'captured',
          createdAt: { lt: new Date(Date.now() - 1000 * 60 * 5) } // older than 5 minutes
        },
        include: {
          paymentAttempts: true,
          transaction: true,
        }
      });

      for (const p of stale) {
        const conversion = await app.prisma.cryptoConversion.findFirst({ where: { paymentIntentId: p.id } });
        if (!conversion) {
          app.log.warn({ paymentIntentId: p.id, amount: p.amount, currency: p.currency }, 'Captured payment without conversion - reconciliation required');
        } else {
          const bc = conversion.blockchainTransactionId ? await app.prisma.blockchainTransaction.findUnique({ where: { id: conversion.blockchainTransactionId } }) : null;
          if (!bc) {
            app.log.warn({ paymentIntentId: p.id, conversionId: conversion.id }, 'Conversion exists but no blockchain transaction recorded');
          }
        }
      }
    } catch (err) {
      app.log.error({ err }, 'reconciliation worker error');
    }
  }, intervalMs);

  return {
    stop: async () => { clearInterval(timer); }
  };
}
