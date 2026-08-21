import { ethers } from "ethers";

const BLOCKCHAIN_PENDING_STATUSES = new Set([
  "pending",
  "broadcasted",
  "confirming",
  "confirmed",
]);

/**
 * Calculate the actual transaction fee in native currency.
 *
 * ethers v6 TransactionReceipt does not expose `effectiveGasPrice`.
 * We therefore obtain the transaction and calculate:
 *
 *     gasUsed × gasPrice
 *
 * For EIP-1559 transactions, the effective gas price is:
 *
 *     min(maxFeePerGas, baseFeePerGas + maxPriorityFeePerGas)
 *
 * when the block's base fee is available.
 */
async function calculateActualFee(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  receipt: ethers.TransactionReceipt,
): Promise<string | null> {
  try {
    if (!receipt.gasUsed) {
      return null;
    }

    const transaction = await provider.getTransaction(txHash);

    if (!transaction) {
      return null;
    }

    let gasPrice: bigint | null = transaction.gasPrice ?? null;

    /*
     * EIP-1559 transaction:
     *
     * effectiveGasPrice =
     *   min(maxFeePerGas, baseFeePerGas + maxPriorityFeePerGas)
     *
     * ethers v6 exposes maxFeePerGas and maxPriorityFeePerGas
     * on the transaction when applicable.
     */
    if (
      transaction.maxFeePerGas != null &&
      transaction.maxPriorityFeePerGas != null
    ) {
      const block = await provider.getBlock(receipt.blockNumber);

      if (block?.baseFeePerGas != null) {
        const effectiveGasPrice =
          block.baseFeePerGas + transaction.maxPriorityFeePerGas;

        gasPrice =
          effectiveGasPrice < transaction.maxFeePerGas
            ? effectiveGasPrice
            : transaction.maxFeePerGas;
      } else {
        /*
         * If the block does not expose a base fee, fall back to
         * the transaction gas price supplied by the provider.
         */
        gasPrice = transaction.gasPrice ?? transaction.maxFeePerGas;
      }
    }

    if (gasPrice == null) {
      return null;
    }

    const actualFee = receipt.gasUsed * gasPrice;

    return ethers.formatEther(actualFee);
  } catch {
    /*
     * Fee calculation must never cause the confirmation worker
     * itself to fail. Returning null allows confirmation processing
     * to continue normally.
     */
    return null;
  }
}

export default function createConfirmationWorker(app: any) {
  const intervalMs = process.env.CONFIRMATION_POLL_INTERVAL_MS
    ? Number(process.env.CONFIRMATION_POLL_INTERVAL_MS)
    : 30000;

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
            where: {
              id: tx.id,
            },
            data: {
              status: "retry_required",
              metadata: {
                ...(tx.metadata ?? {}),
                lastCheckedAt: new Date().toISOString(),
                reason: "missing tx hash",
              },
            },
          });

          continue;
        }

        const rpcUrl = String(
          process.env.BLOCKCHAIN_RPC_URL ||
            process.env.RPC_URL ||
            "",
        ).trim();

        if (!rpcUrl) {
          app.log.warn(
            {
              txId: tx.id,
            },
            "confirmation worker skipped because no RPC URL is configured",
          );

          continue;
        }

        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);

          const receipt = await provider.getTransactionReceipt(tx.txHash);

          /*
           * Transaction has not been mined yet.
           */
          if (!receipt) {
            const txStatus = await provider.getTransaction(tx.txHash);

            /*
             * Transaction cannot be found on the configured RPC.
             */
            if (!txStatus) {
              await app.prisma.blockchainTransaction.update({
                where: {
                  id: tx.id,
                },
                data: {
                  status: "retry_required",
                  metadata: {
                    ...(tx.metadata ?? {}),
                    lastCheckedAt: new Date().toISOString(),
                    reason: "transaction not found on RPC",
                  },
                },
              });

              continue;
            }

            /*
             * Transaction exists in the mempool but has not
             * been mined yet.
             */
            await app.prisma.blockchainTransaction.update({
              where: {
                id: tx.id,
              },
              data: {
                status: "broadcasted",
                metadata: {
                  ...(tx.metadata ?? {}),
                  lastCheckedAt: new Date().toISOString(),
                  rpcStatus: "submitted but not mined",
                },
              },
            });

            continue;
          }

          /*
           * Calculate the actual network fee.
           *
           * This replaces the invalid ethers v6 usage:
           *
           * receipt.effectiveGasPrice
           */
          const actualFee = await calculateActualFee(
            provider,
            tx.txHash,
            receipt,
          );

          /*
           * Transaction was mined but reverted.
           */
          if (receipt.status === 0) {
            await app.prisma.blockchainTransaction.update({
              where: {
                id: tx.id,
              },
              data: {
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                status: "reverted",
                metadata: {
                  ...(tx.metadata ?? {}),
                  lastCheckedAt: new Date().toISOString(),
                  actualFee,
                  receiptStatus: 0,
                },
              },
            });

            continue;
          }

          /*
           * Transaction succeeded.
           */
          const latest = await provider.getBlockNumber();

          const confirmations = receipt.blockNumber
            ? latest - receipt.blockNumber + 1
            : 0;

          const requiredConfirmations = Number(
            (tx.metadata as any)?.requiredConfirmations ??
              process.env.BLOCKCHAIN_CONFIRMATIONS_REQUIRED ??
              1,
          );

          const nextStatus =
            confirmations >= requiredConfirmations
              ? "confirmed"
              : "confirming";

          await app.prisma.blockchainTransaction.update({
            where: {
              id: tx.id,
            },
            data: {
              blockNumber: receipt.blockNumber,
              blockHash: receipt.blockHash,
              confirmations,
              status: nextStatus,
              metadata: {
                ...(tx.metadata ?? {}),
                lastCheckedAt: new Date().toISOString(),
                requiredConfirmations,
                actualFee,
                receiptStatus: receipt.status,
              },
            },
          });

          /*
           * Once the blockchain transaction has enough confirmations,
           * settle the corresponding SmartPOS transaction.
           */
          if (nextStatus === "confirmed") {
            const existingTransaction =
              await app.prisma.transaction.findFirst({
                where: {
                  blockchainTransactionId: tx.id,
                },
              });

            if (existingTransaction) {
              await app.prisma.transaction.update({
                where: {
                  id: existingTransaction.id,
                },
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
          app.log.warn(
            {
              err,
              txId: tx.id,
            },
            "rpc confirmation check failed temporarily",
          );

          await app.prisma.blockchainTransaction.update({
            where: {
              id: tx.id,
            },
            data: {
              status:
                tx.status === "confirmed"
                  ? "confirmed"
                  : "pending",
              metadata: {
                ...(tx.metadata ?? {}),
                lastCheckedAt: new Date().toISOString(),
                rpcFailure:
                  err?.message ??
                  "rpc confirmation check failed",
              },
            },
          });
        }
      }
    } catch (err) {
      app.log.error(
        {
          err,
        },
        "confirmation worker error",
      );
    }
  }, intervalMs);

  return {
    stop: async () => {
      clearInterval(timer);
    },
  };
}