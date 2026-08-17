import GenericOtcProvider from '../providers/generic-otc.provider.js';

export default function createConfirmationWorker(app: any) {
  const intervalMs = process.env.CONFIRMATION_POLL_INTERVAL_MS ? Number(process.env.CONFIRMATION_POLL_INTERVAL_MS) : 30000;

  const timer = setInterval(async () => {
    try {
      // find pending blockchain transactions with provider metadata
      const pending = await app.prisma.blockchainTransaction.findMany({ where: { status: 'pending' } });

      for (const tx of pending) {
        const providerName = tx.metadata?.providerName ?? null;
        if (!providerName) continue;

        const provider = await app.prisma.exchangeProvider.findFirst({ where: { name: providerName } });
        if (!provider) continue;

        const client = new GenericOtcProvider({ baseUrl: provider.baseUrl ?? '', apiKey: provider.apiKey ?? undefined, apiSecret: provider.apiSecret ?? undefined, metadata: provider.metadata ?? undefined });

        let confirmations = 0;

        // Prefer on-chain RPC if available and txHash exists
        const rpcUrl = process.env.RPC_URL;
        if (rpcUrl && tx.txHash) {
          try {
            const { ethers } = await import('ethers');
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const receipt = await provider.getTransactionReceipt(tx.txHash);
            if (receipt && receipt.blockNumber) {
              const latest = await provider.getBlockNumber();
              confirmations = latest - receipt.blockNumber + 1;

              await app.prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { confirmations, status: confirmations >= (tx.metadata?.requiredConfirmations ?? 1) ? 'confirmed' : 'pending', blockNumber: receipt.blockNumber, blockHash: receipt.blockHash } });
            }
          } catch (err) {
            app.log.warn({ err }, 'rpc confirmation check failed');
          }
        } else {
          const status = await client.getStatus(tx.metadata?.providerTxId ?? tx.txHash);

          // Expected status fields: confirmations, txHash
          confirmations = status?.confirmations ?? status?.data?.confirmations ?? 0;

          if (confirmations > 0) {
            await app.prisma.blockchainTransaction.update({ where: { id: tx.id }, data: { confirmations, status: confirmations >= (tx.metadata?.requiredConfirmations ?? 1) ? 'confirmed' : 'pending' } });
          }
        }
      }
    } catch (err) {
      app.log.error({ err }, 'confirmation worker error');
    }
  }, intervalMs);

  return {
    stop: async () => { clearInterval(timer); }
  };
}
