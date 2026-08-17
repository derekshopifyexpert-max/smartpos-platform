import { FastifyInstance } from "fastify";

export default async function reconciliationRoutes(app: FastifyInstance) {
  app.get('/reconciliation/report', async (request, reply) => {
    const stale = await app.prisma.paymentIntent.findMany({
      where: {
        status: 'captured',
      },
      include: {
        transaction: true,
      }
    });

    const report = [] as any[];

    for (const p of stale) {
      const conversion = await app.prisma.cryptoConversion.findFirst({ where: { paymentIntentId: p.id } });
      if (!conversion) {
        report.push({ paymentIntentId: p.id, issue: 'no_conversion', amount: p.amount, currency: p.currency });
        continue;
      }

      const bc = conversion.blockchainTransactionId ? await app.prisma.blockchainTransaction.findUnique({ where: { id: conversion.blockchainTransactionId } }) : null;
      if (!bc) {
        report.push({ paymentIntentId: p.id, conversionId: conversion.id, issue: 'no_blockchain_tx' });
      }
    }

    return reply.send({ success: true, count: report.length, data: report });
  });
}
