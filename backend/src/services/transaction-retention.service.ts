import { FastifyInstance } from "fastify";

let retentionEnabled = true;

export function isTransactionRetentionEnabled() {
  return retentionEnabled;
}

export function setTransactionRetentionEnabled(enabled: boolean) {
  retentionEnabled = enabled;
}

export async function archiveExpiredTransactions(
  app: FastifyInstance,
  retentionDays = 7
) {
  if (!retentionEnabled) {
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await app.prisma.transaction.updateMany({
    where: {
      deletedAt: null,
      createdAt: { lt: cutoff },
    },
    data: { deletedAt: new Date() },
  });

  app.log.info(
    { archivedTransactions: result.count, retentionDays },
    "Transaction retention cleanup completed"
  );
}
