import { FastifyInstance } from "fastify";

export default async function observabilityRoutes(app: FastifyInstance) {
  app.get('/observability/dashboard', async (request, reply) => {
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const successfulStatuses = ['AUTHORIZED', 'CAPTURED', 'SETTLED', 'APPROVED'];
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const successfulTransactions = await app.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        status: { in: successfulStatuses as any },
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { amount: true, currency: true },
    });

    const settledTransactions = await app.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        status: { in: successfulStatuses as any },
        settlementStatus: 'COMPLETED',
        createdAt: { gte: last24Hours },
      },
      select: { amount: true, currency: true },
    });

    const currencyMetrics = new Map<string, { revenue: number; transactions: number }>();

    for (const transaction of successfulTransactions) {
      const current = currencyMetrics.get(transaction.currency) ?? { revenue: 0, transactions: 0 };
      current.transactions += 1;
      currencyMetrics.set(transaction.currency, current);
    }

    for (const transaction of settledTransactions) {
      const current = currencyMetrics.get(transaction.currency) ?? { revenue: 0, transactions: 0 };
      current.revenue += Number(transaction.amount);
      currencyMetrics.set(transaction.currency, current);
    }

    const currencySummaries = Array.from(currencyMetrics.entries()).map(
      ([currency, metrics]) => ({ currency, ...metrics })
    );

    const transactionsToday = successfulTransactions.length;
    const revenue = currencySummaries.reduce((total, item) => total + item.revenue, 0);

    // Get payment status breakdown
    const payments = await app.prisma.paymentIntent.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const paymentStats = payments.reduce((acc: any, p) => {
      acc[p.status] = p._count.id;
      return acc;
    }, {});

    return reply.send({
      timestamp: new Date(),
      health: { status: 'operational', uptime: process.uptime() },
      revenue,
      transactionsToday,
      currencySummaries,
      payments: paymentStats,
      conversions: {},
      blockchainTransactions: {},
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
