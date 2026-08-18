import { ethers } from 'ethers';

const BLOCKCHAIN_PENDING_STATUSES = new Set(["pending", "broadcasted", "confirming", "confirmed"]);

export default function createConfirmationWorker(app: any) {
  const intervalMs = process.env.CONFIRMATION_POLL_INTERVAL_MS ? Number(process.env.CONFIRMATION_POLL_INTERVAL_MS) : 30000;

  const timer = setInterval(async () => {
    try {
      const pending = await app.prisma.blockchainTransaction.findMany({
        where: {
          status: {
            in: Array.from(BLOCKCHAIN_PENDING_STATUSES),
          },
        },
        include: {
          blockchain: true,
        },
      });

      for (const tx of pending) {
        if (!tx.txHash) {
          await app.prisma.blockchainTransaction.update({
            where: { id: tx.id },
            data: { status: "retry_required", metadata: { ...(tx.metadata ?? {}), lastCheckedAt: new Date().toISOString(), reason: "missing tx hash" } },
          });
          continue;
        }

        const rpcUrl = String(process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "").trim();
        if (!rpcUrl) {
          app.log.warn({ txId: tx.id }, "confirmation worker skipped because no RPC URL is configured");
          continue;
        }

        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const receipt = await provider.getTransactionReceipt(tx.txHash);

          if (!receipt) {
            const txStatus = await provider.getTransaction(tx.txHash);
            if (!txStatus) {
              await app.prisma.blockchainTransaction.update({
                where: { id: tx.id },
                data: {
                  status: "retry_required",
                  metadata: { ...(tx.metadata ?? {}), lastCheckedAt: new Date().toISOString(), reason: "transaction not found on RPC" },
                },
              });
              continue;
            }

            await app.prisma.blockchainTransaction.update({
              where: { id: tx.id },
              data: {
                status: "broadcasted",
                metadata: { ...(tx.metadata ?? {}), lastCheckedAt: new Date().toISOString(), rpcStatus: "submitted but not mined" },
              },
            });
            continue;
          }

          if (receipt.status === 0) {
            await app.prisma.blockchainTransaction.update({
              where: { id: tx.id },
              data: {
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                status: "reverted",
                metadata: { ...(tx.metadata ?? {}), lastCheckedAt: new Date().toISOString(), actualFee: receipt.gasUsed && receipt.effectiveGasPrice ? ethers.formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : null, receiptStatus: 0 },
              },
            });
            continue;
          }

          const latest = await provider.getBlockNumber();
          const confirmations = receipt.blockNumber ? latest - receipt.blockNumber + 1 : 0;
          const requiredConfirmations = Number((tx.metadata as any)?.requiredConfirmations ?? process.env.BLOCKCHAIN_CONFIRMATIONS_REQUIRED ?? 1);
          const nextStatus = confirmations >= requiredConfirmations ? "confirmed" : "confirming";

          await app.prisma.blockchainTransaction.update({
            where: { id: tx.id },
            data: {
              blockNumber: receipt.blockNumber,
              blockHash: receipt.blockHash,
              confirmations,
              status: nextStatus,
              metadata: {
                ...(tx.metadata ?? {}),
                lastCheckedAt: new Date().toISOString(),
                requiredConfirmations,
                actualFee: receipt.gasUsed && receipt.effectiveGasPrice ? ethers.formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : null,
                receiptStatus: receipt.status,
              },
            },
          });

          if (nextStatus === "confirmed") {
            const existingTransaction = await app.prisma.transaction.findFirst({
              where: { blockchainTransactionId: tx.id },
            });

            if (existingTransaction) {
              await app.prisma.transaction.update({
                where: { id: existingTransaction.id },
                data: {
                  status: "SETTLED",
                  metadata: {
                    ...(existingTransaction.metadata ?? {}),
                    blockchainSettlementStatus: "confirmed",
                    txHash: tx.txHash,
                  },
                },
              });
            }
          }
        } catch (err: any) {
          app.log.warn({ err, txId: tx.id }, 'rpc confirmation check failed temporarily');
          await app.prisma.blockchainTransaction.update({
            where: { id: tx.id },
            data: {
              status: tx.status === 'confirmed' ? 'confirmed' : 'pending',
              metadata: {
                ...(tx.metadata ?? {}),
                lastCheckedAt: new Date().toISOString(),
                rpcFailure: err?.message ?? 'rpc confirmation check failed',
              },
            },
          });
        }
      }
    } catch (err) {
      app.log.error({ err }, 'confirmation worker error');
    }
  }, intervalMs);

  return {
    stop: async () => { clearInterval(timer); },
  };
}
