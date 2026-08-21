import {
  Prisma,
  BlockchainNetworkType,
} from "@prisma/client";
import { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";

const USDT_CONTRACTS: Record<
  string,
  {
    chainId: number;
    contractAddress: string;
    decimals: number;
    nativeCurrency: string;
    requiredConfirmations: number;
  }
> = {
  ETHEREUM: {
    chainId: 1,
    contractAddress:
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    nativeCurrency: "ETH",
    requiredConfirmations: 6,
  },

  BSC: {
    chainId: 56,
    contractAddress:
      "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    nativeCurrency: "BNB",
    requiredConfirmations: 12,
  },
};

export default class BlockchainService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  /*
   |--------------------------------------------------------------------------
   | Helpers
   |--------------------------------------------------------------------------
   */

  private getNetworkConfig(networkName?: string) {
    const normalized = (
      networkName ??
      process.env.BLOCKCHAIN_NETWORK ??
      "ETHEREUM"
    )
      .trim()
      .toUpperCase();

    const cfg =
      USDT_CONTRACTS[normalized] ?? null;

    if (!cfg) {
      throw new Error(
        `Unsupported EVM settlement network: ${normalized}. Supported networks: ${Object.keys(
          USDT_CONTRACTS
        ).join(", ")}.`
      );
    }

    const configuredChainId = Number(
      process.env.BLOCKCHAIN_CHAIN_ID ||
        cfg.chainId
    );

    const rpcUrl = String(
      process.env.BLOCKCHAIN_RPC_URL ||
        process.env.RPC_URL ||
        ""
    ).trim();

    const contractAddress = String(
      process.env.BLOCKCHAIN_USDT_CONTRACT_ADDRESS ||
        cfg.contractAddress
    ).trim();

    const decimals = Number(
      process.env.BLOCKCHAIN_USDT_DECIMALS ||
        cfg.decimals
    );

    if (!rpcUrl) {
      throw new Error(
        "Blockchain settlement requires a configured RPC URL. Set BLOCKCHAIN_RPC_URL or RPC_URL."
      );
    }

    if (!contractAddress) {
      throw new Error(
        "Blockchain settlement requires a configured USDT contract address. Set BLOCKCHAIN_USDT_CONTRACT_ADDRESS."
      );
    }

    if (!ethers.isAddress(contractAddress)) {
      throw new Error(
        `Configured USDT contract address is invalid for ${normalized}: ${contractAddress}`
      );
    }

    return {
      name: normalized,
      chainId: configuredChainId,
      rpcUrl,
      contractAddress,
      decimals,
      nativeCurrency: cfg.nativeCurrency,
      requiredConfirmations: Number(
        process.env.BLOCKCHAIN_CONFIRMATIONS_REQUIRED ||
          cfg.requiredConfirmations
      ),
    };
  }

  private validateRealTxHash(
    txHash?: string
  ): string {
    const normalized = (txHash ?? "").trim();

    if (!normalized) {
      throw new Error(
        "Real blockchain broadcast required: no transaction hash was returned from the network. Configure BLOCKCHAIN_RPC_URL and BROADCAST_PRIVATE_KEY, then record the on-chain receipt hash."
      );
    }

    if (
      !/^0x[a-fA-F0-9]{64}$/.test(
        normalized
      )
    ) {
      throw new Error(
        `Invalid transaction hash provided for on-chain settlement: ${normalized}. Only real EVM receipt hashes are accepted.`
      );
    }

    return normalized;
  }

  private async getRpcContext(
    networkName?: string
  ) {
    const config =
      this.getNetworkConfig(networkName);

    const provider =
      new ethers.JsonRpcProvider(
        config.rpcUrl
      );

    const network =
      await provider.getNetwork();

    const expectedChainId = BigInt(
      config.chainId
    );

    if (
      BigInt(network.chainId) !==
      expectedChainId
    ) {
      throw new Error(
        `RPC network mismatch: expected chain ID ${config.chainId} for ${config.name}, got ${network.chainId}.`
      );
    }

    const privateKey = String(
      process.env.BROADCAST_PRIVATE_KEY ||
        ""
    ).trim();

    if (!privateKey) {
      throw new Error(
        "Real blockchain broadcast requires a configured server-side BROADCAST_PRIVATE_KEY."
      );
    }

    const signer = new ethers.Wallet(
      privateKey,
      provider
    );

    return {
      config,
      provider,
      signer,
    };
  }

  private async findNetworkRecord(
    networkName: string
  ) {
    const normalized =
      networkName.trim().toUpperCase();

    /*
     * Prisma expects BlockchainNetworkType,
     * not an arbitrary string.
     */
    const networkType =
      normalized as BlockchainNetworkType;

    return this.app.prisma.blockchainNetwork.findFirst(
      {
        where: {
          name: networkType,
        },
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Blockchain Transaction
   |--------------------------------------------------------------------------
   */

  async createTransaction(data: {
    blockchain: any;
    walletId?: string;
    fromAddress: string;
    toAddress: string;
    amount: Prisma.Decimal;
    currency: any;
    fee?: Prisma.Decimal;
    gasPrice?: Prisma.Decimal;
    nonce?: number;
    metadata?: Prisma.JsonValue;
    payload?: Prisma.JsonValue;
    txHash?: string;
  }) {
    const providedTxHash =
      (data as any).txHash ?? null;

    if (!providedTxHash) {
      throw new Error(
        "Real blockchain settlement requires a real transaction hash from a confirmed on-chain broadcast. Fake hashes are not permitted."
      );
    }

    const realTxHash =
      this.validateRealTxHash(
        providedTxHash
      );

    return this.app.prisma.blockchainTransaction.create(
      {
        data: {
          txHash: realTxHash,
          blockchainId: data.blockchain,
          walletId: data.walletId,
          fromAddress: data.fromAddress,
          toAddress: data.toAddress,
          amount: data.amount,
          currency: data.currency,
          fee:
            data.fee ??
            new Prisma.Decimal(0),
          gasPrice: data.gasPrice,
          nonce: data.nonce,
          metadata:
            data.metadata ??
            Prisma.JsonNull,
          data:
            data.payload ??
            Prisma.JsonNull,
          status: "pending",
        },
      }
    );
  }

  async sendUsdtTransfer(data: {
    merchantId: string;
    walletId?: string;
    network: string;
    asset: string;
    amount: Prisma.Decimal;
    destinationAddress: string;
    reference?: string;
    metadata?: Prisma.JsonValue;
  }) {
    const network = String(
      data.network ?? "ETHEREUM"
    )
      .trim()
      .toUpperCase();

    const asset = String(
      data.asset ?? "USDT"
    )
      .trim()
      .toUpperCase();

    if (asset !== "USDT") {
      throw new Error(
        `Unsupported asset for on-chain settlement: ${asset}. Only USDT is currently supported.`
      );
    }

    const {
      config,
      provider,
      signer,
    } = await this.getRpcContext(
      network
    );

    const destination =
      data.destinationAddress.trim();

    if (!ethers.isAddress(destination)) {
      throw new Error(
        `Destination wallet is not a valid EVM address: ${destination}`
      );
    }

    const contractAddress =
      config.contractAddress;

    const decimals = await (async () => {
      const tokenContract =
        new ethers.Contract(
          contractAddress,
          [
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address,uint256) returns (bool)",
          ],
          provider
        );

      const [
        tokenDecimals,
        tokenSymbol,
      ] = await Promise.all([
        tokenContract
          .decimals()
          .catch(
            () => config.decimals
          ),
        tokenContract
          .symbol()
          .catch(() => "USDT"),
      ]);

      if (
        String(tokenSymbol).toUpperCase() !==
        "USDT"
      ) {
        throw new Error(
          `Configured USDT contract does not match the expected token for ${network}. Found symbol: ${String(
            tokenSymbol
          )}.`
        );
      }

      return {
        decimals: Number(
          tokenDecimals
        ),
        symbol: String(tokenSymbol),
      };
    })();

    const amountUnits =
      ethers.parseUnits(
        String(data.amount),
        decimals.decimals
      );

    const senderAddress =
      await signer.getAddress();

    const tokenContract =
      new ethers.Contract(
        contractAddress,
        [
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)",
          "function balanceOf(address) view returns (uint256)",
          "function transfer(address,uint256) returns (bool)",
        ],
        signer
      );

    const senderBalance =
      await tokenContract.balanceOf(
        senderAddress
      );

    if (
      senderBalance < amountUnits
    ) {
      throw new Error(
        `Insufficient USDT liquidity for this settlement. Available: ${ethers.formatUnits(
          senderBalance,
          decimals.decimals
        )} USDT.`
      );
    }

    const nativeBalance =
      await provider.getBalance(
        senderAddress
      );

    if (nativeBalance <= 0n) {
      throw new Error(
        `Insufficient ${config.nativeCurrency} balance to pay gas for the settlement.`
      );
    }

    const gasEstimate =
      await tokenContract.transfer
        .estimateGas(
          destination,
          amountUnits
        )
        .catch((error: unknown) => {
          throw new Error(
            `Failed to estimate USDT gas for transfer: ${
              error instanceof Error
                ? error.message
                : String(error)
            }`
          );
        });

    const feeData =
      await provider.getFeeData();

    const txOverrides: any = {
      gasLimit: gasEstimate,
    };

    if (
      feeData.maxFeePerGas !== null &&
      feeData.maxPriorityFeePerGas !== null
    ) {
      txOverrides.maxFeePerGas =
        feeData.maxFeePerGas;

      txOverrides.maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas;
    } else if (
      feeData.gasPrice !== null
    ) {
      txOverrides.gasPrice =
        feeData.gasPrice;
    }

    const tx =
      await tokenContract.transfer(
        destination,
        amountUnits,
        txOverrides
      );

    const receipt =
      await tx.wait(1);

    if (!receipt) {
      throw new Error(
        "Transaction broadcast succeeded but no blockchain receipt was returned."
      );
    }

    if (receipt.status === 0) {
      throw new Error(
        `On-chain USDT transfer reverted. Transaction hash: ${tx.hash}`
      );
    }

    /*
     * ethers v6 TransactionReceipt does not expose
     * effectiveGasPrice. Get the actual gas price from
     * the mined transaction instead.
     */
    const minedTransaction =
      await provider.getTransaction(
        tx.hash
      );

    const effectiveGasPrice =
      minedTransaction?.gasPrice ??
      feeData.gasPrice ??
      feeData.maxFeePerGas ??
      null;

    const actualFee =
      receipt.gasUsed &&
      effectiveGasPrice
        ? receipt.gasUsed *
          effectiveGasPrice
        : null;

    const blockchainNetwork =
      await this.findNetworkRecord(
        network
      );

    if (!blockchainNetwork) {
      throw new Error(
        `Blockchain network ${network} is not configured in SmartPOS.`
      );
    }

    const createdTx =
      await this.createTransaction({
        blockchain:
          blockchainNetwork.id,
        walletId: data.walletId,
        fromAddress:
          senderAddress,
        toAddress:
          destination,
        amount:
          new Prisma.Decimal(
            String(
              ethers.formatUnits(
                amountUnits,
                decimals.decimals
              )
            )
          ),
        currency: asset as any,
        fee: actualFee
          ? new Prisma.Decimal(
              String(
                ethers.formatEther(
                  actualFee
                )
              )
            )
          : new Prisma.Decimal(0),
        gasPrice:
          effectiveGasPrice
            ? new Prisma.Decimal(
                String(
                  effectiveGasPrice.toString()
                )
              )
            : undefined,
        metadata: {
          ...((data.metadata ??
            {}) as Record<
            string,
            unknown
          >),
          senderAddress,
          contractAddress,
          tokenSymbol:
            decimals.symbol,
          tokenDecimals:
            decimals.decimals,
          network,
          reference:
            data.reference ?? null,
          requiredConfirmations:
            config.requiredConfirmations,
        } as Prisma.JsonValue,
        txHash: tx.hash,
        payload: {
          transactionHash:
            tx.hash,
          network,
          contractAddress,
          reference:
            data.reference ?? null,
        } as Prisma.JsonValue,
      });

    return {
      txHash: tx.hash,
      blockchainTransactionId:
        createdTx.id,
      confirmations:
        createdTx.confirmations,
      requiredConfirmations:
        config.requiredConfirmations,
      result: {
        success: true,
        status: "BROADCASTED",
        message:
          "USDT transfer broadcast to blockchain",
        transactionHash:
          tx.hash,
        blockExplorerUrl:
          `${blockchainNetwork.explorerUrl ?? ""}/tx/${tx.hash}`.replace(
            /\/$/,
            ""
          ),
        raw: receipt,
      },
    };
  }

  async verifyUsdtTransfer(data: {
    network: string;
    txHash: string;
    tokenContractAddress: string;
    fromAddress: string;
    toAddress: string;
    expectedAmount:
      | Prisma.Decimal
      | string
      | number;
    tokenDecimals?: number;
  }) {
    const {
      provider,
      config,
    } = await this.getRpcContext(
      data.network
    );

    const txHash =
      this.validateRealTxHash(
        data.txHash
      );

    const tx =
      await provider.getTransaction(
        txHash
      );

    if (!tx) {
      return {
        found: false,
        mined: false,
        status: "pending",
        receipt: null,
      };
    }

    const receipt =
      await provider.getTransactionReceipt(
        txHash
      );

    if (!receipt) {
      return {
        found: true,
        mined: false,
        status: "pending",
        receipt: null,
      };
    }

    const normalizedContract =
      data.tokenContractAddress.toLowerCase();

    const normalizedFrom =
      data.fromAddress.toLowerCase();

    const normalizedTo =
      data.toAddress.toLowerCase();

    const expectedAmountUnits =
      ethers.parseUnits(
        String(data.expectedAmount),
        data.tokenDecimals ??
          config.decimals
      );

    const transferEventSignature =
      ethers.id(
        "Transfer(address,address,uint256)"
      );

    const transferLogs =
      receipt.logs.filter(
        (log) => {
          return (
            log.address.toLowerCase() ===
              normalizedContract &&
            log.topics[0] ===
              transferEventSignature
          );
        }
      );

    const matchedTransfer =
      transferLogs.find(
        (log) => {
          if (log.topics.length < 3) {
            return false;
          }

          const from =
            ethers.getAddress(
              `0x${log.topics[1].slice(
                26
              )}`
            );

          const to =
            ethers.getAddress(
              `0x${log.topics[2].slice(
                26
              )}`
            );

          const [value] =
            ethers.AbiCoder
              .defaultAbiCoder()
              .decode(
                ["uint256"],
                log.data
              );

          const fromMatch =
            from.toLowerCase() ===
            normalizedFrom;

          const toMatch =
            to.toLowerCase() ===
            normalizedTo;

          const valueMatch =
            value ===
            expectedAmountUnits;

          return (
            fromMatch &&
            toMatch &&
            valueMatch
          );
        }
      );

    const latestBlock =
      await provider.getBlockNumber();

    const confirmations =
      receipt.blockNumber
        ? latestBlock -
          receipt.blockNumber +
          1
        : 0;

    /*
     * ethers v6 does not expose
     * effectiveGasPrice on TransactionReceipt.
     *
     * Read the mined transaction's gasPrice.
     */
    const minedTransaction =
      await provider.getTransaction(
        txHash
      );

    const effectiveGasPrice =
      minedTransaction?.gasPrice ??
      null;

    const actualFee =
      receipt.gasUsed &&
      effectiveGasPrice
        ? receipt.gasUsed *
          effectiveGasPrice
        : null;

    return {
      found: true,
      mined: true,
      status:
        receipt.status === 0
          ? "reverted"
          : confirmations >=
              config.requiredConfirmations
            ? "confirmed"
            : "confirming",
      receipt,
      confirmations,
      actualFee:
        actualFee !== null
          ? ethers.formatEther(
              actualFee
            )
          : null,
      transferEventFound:
        Boolean(matchedTransfer),
      transferEventMatch:
        Boolean(matchedTransfer),
      blockNumber:
        receipt.blockNumber,
      blockHash:
        receipt.blockHash,
    };
  }

  async syncTransactionStatus(
    txId: string
  ) {
    const record =
      await this.app.prisma.blockchainTransaction.findUnique(
        {
          where: {
            id: txId,
          },
          include: {
            blockchain: true,
          },
        }
      );

    if (!record) {
      throw new Error(
        `Blockchain transaction record not found: ${txId}`
      );
    }

    const networkName =
      String(
        record.blockchain?.name ??
          process.env.BLOCKCHAIN_NETWORK ??
          "ETHEREUM"
      ).toUpperCase();

    const metadata =
      record.metadata &&
      typeof record.metadata ===
        "object" &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<
            string,
            unknown
          >)
        : {};

    const tokenContractAddress =
      String(
        (metadata.contractAddress as
          | string
          | undefined) ??
          process.env
            .BLOCKCHAIN_USDT_CONTRACT_ADDRESS ??
          ""
      ).trim();

    if (!record.txHash) {
      throw new Error(
        `Transaction ${txId} has no real tx hash for blockchain verification.`
      );
    }

    const verification =
      await this.verifyUsdtTransfer({
        network: networkName,
        txHash: record.txHash,
        tokenContractAddress:
          tokenContractAddress ||
          "0x0000000000000000000000000000000000000000",
        fromAddress: String(
          metadata.senderAddress ??
            record.fromAddress ??
            ""
        ),
        toAddress:
          record.toAddress,
        expectedAmount:
          record.amount,
        tokenDecimals: Number(
          metadata.tokenDecimals ??
            6
        ),
      });

    if (!verification.found) {
      await this.app.prisma.blockchainTransaction.update(
        {
          where: {
            id: txId,
          },
          data: {
            confirmations: 0,
            status: "pending",
            metadata: {
              ...metadata,
              lastCheckedAt:
                new Date().toISOString(),
              rpcLookup: "not found",
            },
          },
        }
      );

      return verification;
    }

    if (
      verification.mined &&
      verification.receipt &&
      verification.receipt.status === 0
    ) {
      await this.app.prisma.blockchainTransaction.update(
        {
          where: {
            id: txId,
          },
          data: {
            blockNumber:
              verification.blockNumber,
            blockHash:
              verification.blockHash,
            confirmations:
              verification.confirmations,
            status: "reverted",
            metadata: {
              ...metadata,
              lastCheckedAt:
                new Date().toISOString(),
              actualFee:
                verification.actualFee,
              receiptStatus: 0,
            },
          },
        }
      );

      return verification;
    }

    if (
      verification.mined &&
      verification.receipt
    ) {
      /*
       * JsonValue can be primitive, so don't access
       * requiredConfirmations directly on record.metadata.
       * The already-normalized metadata object is used.
       */
      const configuredRequiredConfirmations =
        Number(
          metadata.requiredConfirmations ??
            1
        );

      const nextStatus =
        verification.confirmations >=
        configuredRequiredConfirmations
          ? "confirmed"
          : "confirming";

      await this.app.prisma.blockchainTransaction.update(
        {
          where: {
            id: txId,
          },
          data: {
            blockNumber:
              verification.blockNumber,
            blockHash:
              verification.blockHash,
            confirmations:
              verification.confirmations,
            status: nextStatus,
            metadata: {
              ...metadata,
              lastCheckedAt:
                new Date().toISOString(),
              actualFee:
                verification.actualFee,
              receiptStatus:
                verification.receipt
                  .status,
              transferEventFound:
                verification.transferEventFound,
            },
          },
        }
      );
    }

    return verification;
  }

  async markConfirmed(
    txId: string,
    blockNumber: number,
    blockHash: string,
    confirmations: number
  ) {
    return this.app.prisma.blockchainTransaction.update(
      {
        where: {
          id: txId,
        },
        data: {
          blockNumber,
          blockHash,
          confirmations,
          status: "confirmed",
        },
      }
    );
  }

  async markFailed(
    txId: string
  ) {
    return this.app.prisma.blockchainTransaction.update(
      {
        where: {
          id: txId,
        },
        data: {
          status: "failed",
        },
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Confirmations
   |--------------------------------------------------------------------------
   */

  async addConfirmation(data: {
    txId: string;
    confirmations: number;
    blockHash?: string;
    blockTime?: Date;
    metadata?: Prisma.JsonValue;
  }) {
    await this.app.prisma.blockchainTransaction.update(
      {
        where: {
          id: data.txId,
        },
        data: {
          confirmations:
            data.confirmations,
        },
      }
    );

    return this.app.prisma.blockchainConfirmation.create(
      {
        data: {
          txId: data.txId,
          confirmations:
            data.confirmations,
          blockHash:
            data.blockHash,
          blockTime:
            data.blockTime,
          metadata:
            data.metadata ??
            Prisma.JsonNull,
        },
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Wallet Transfer
   |--------------------------------------------------------------------------
   */

  async createWalletTransfer(data: {
    merchantId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: Prisma.Decimal;
    currency: any;
    fee?: Prisma.Decimal;
    type: string;
    cryptoConversionId?: string;
    blockchainTxId?: string;
    metadata?: Prisma.JsonValue;
  }) {
    const reference =
      `WT-${Date.now()}-${randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

    return this.app.prisma.walletTransfer.create(
      {
        data: {
          merchantId:
            data.merchantId,
          fromWalletId:
            data.fromWalletId,
          toWalletId:
            data.toWalletId,
          amount: data.amount,
          currency: data.currency,
          fee:
            data.fee ??
            new Prisma.Decimal(0),
          type: data.type,
          status: "pending",
          reference,
          blockchainTxId:
            data.blockchainTxId,
          cryptoConversionId:
            data.cryptoConversionId,
          metadata:
            data.metadata ??
            Prisma.JsonNull,
        },
      }
    );
  }

  async completeWalletTransfer(
    walletTransferId: string
  ) {
    return this.app.prisma.walletTransfer.update(
      {
        where: {
          id: walletTransferId,
        },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      }
    );
  }

  async failWalletTransfer(
    walletTransferId: string
  ) {
    return this.app.prisma.walletTransfer.update(
      {
        where: {
          id: walletTransferId,
        },
        data: {
          status: "failed",
        },
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Blockchain Fees
   |--------------------------------------------------------------------------
   */

  async latestFee(
    blockchain: any,
    feeType: string
  ) {
    return this.app.prisma.blockchainFee.findFirst(
      {
        where: {
          blockchain,
          feeType,
        },
        orderBy: {
          timestamp: "desc",
        },
      }
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Lookup
   |--------------------------------------------------------------------------
   */

  async findTransaction(
    txId: string
  ) {
    return this.app.prisma.blockchainTransaction.findUnique(
      {
        where: {
          id: txId,
        },
        include: {
          wallet: true,
          confirmationsHistory: true,
          walletTransfer: true,
        },
      }
    );
  }

  async findTransfer(
    transferId: string
  ) {
    return this.app.prisma.walletTransfer.findUnique(
      {
        where: {
          id: transferId,
        },
        include: {
          merchant: true,
          fromWallet: true,
          toWallet: true,
          blockchainTransaction: true,
          cryptoConversion: true,
        },
      }
    );
  }
}