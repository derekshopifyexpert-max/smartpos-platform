import { FastifyInstance } from "fastify";

export default async function observabilityRoutes(app: FastifyInstance) {
  app.get('/observability/dashboard', async (request, reply) => {
    const payments = await app.prisma.paymentIntent.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const conversions = await app.prisma.cryptoConversion.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const blockchainTxs = await app.prisma.blockchainTransaction.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const paymentStats = payments.reduce((acc: any, p) => {
      acc[p.status] = p._count.id;
      return acc;
    }, {});

    const conversionStats = conversions.reduce((acc: any, c) => {
      acc[c.status] = c._count.id;
      return acc;
    }, {});

    const blockchainStats = blockchainTxs.reduce((acc: any, b) => {
      acc[b.status] = b._count.id;
      return acc;
    }, {});

    return reply.send({
      timestamp: new Date(),
      health: { status: 'operational', uptime: process.uptime() },
      payments: paymentStats,
      conversions: conversionStats,
      blockchainTransactions: blockchainStats,
    });
  });

  app.get('/observability/metrics', async (request, reply) => {
    const totalPayments = await app.prisma.paymentIntent.count();
    const totalConversions = await app.prisma.cryptoConversion.count();
    const successfulConversions = await app.prisma.cryptoConversion.count({ where: { status: 'completed' } });
    const confirmedTransactions = await app.prisma.blockchainTransaction.count({ where: { status: 'confirmed' } });

    const successRate = totalConversions > 0 ? (successfulConversions / totalConversions * 100).toFixed(2) : 0;

    return reply.send({
      totalPayments,
      totalConversions,
      successfulConversions,
      conversionSuccessRate: `${successRate}%`,
      confirmedBlockchainTransactions: confirmedTransactions,
      timestamp: new Date(),
    });
  });
}
