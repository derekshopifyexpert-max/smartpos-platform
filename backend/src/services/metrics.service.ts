import { PrismaClient, TransactionStatus } from "@prisma/client";

export default class MetricsService {
  constructor(
    private readonly prisma: PrismaClient
  ) {}

  async getDashboardMetrics() {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalMerchants,
      activeTerminals,
      transactionsToday,
      revenueResult,
      transactionStatusBreakdown,
      todayTransactions,
    ] = await Promise.all([
      this.prisma.merchant.count(),

      this.prisma.terminal.count({
        where: {
          isActive: true,
        },
      }),

      this.prisma.transaction.count({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),

      this.prisma.transaction.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
          status: {
            in: [
              TransactionStatus.CAPTURED,
              TransactionStatus.SETTLED,
            ],
          },
        },
      }),

      this.prisma.transaction.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),

      this.prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const revenue = Number(
      revenueResult._sum.amount ?? 0
    );

    const hourlyActivity = Array.from(
      { length: 24 },
      (_, hour) => ({
        hour,
        transactions: 0,
      })
    );

    for (const transaction of todayTransactions) {
      const hour = new Date(
        transaction.createdAt
      ).getHours();

      hourlyActivity[hour].transactions += 1;
    }

    const statusBreakdown =
      transactionStatusBreakdown.map((item) => ({
        status: item.status,
        count: item._count._all,
      }));

    const terminalCoverage =
      totalMerchants > 0
        ? Math.round(
            (activeTerminals / totalMerchants) * 100
          )
        : 0;

    return {
      revenue,
      transactionsToday,
      totalMerchants,
      activeTerminals,
      terminalCoverage,

      platformActivity: {
        date: startOfToday.toISOString(),
        totalTransactions: transactionsToday,
        hourly: hourlyActivity,
      },

      merchantInfrastructure: {
        registeredMerchants: totalMerchants,
        activeTerminals,
        terminalCoverage,
      },

      revenueSummary: {
        date: startOfToday.toISOString(),
        revenue,
        currency: "USD",
      },

      transactionStatusBreakdown:
        statusBreakdown,
    };
  }
}