import { FastifyInstance } from "fastify";
import {
  Prisma,
  CurrencyType,
  WalletType,
  BlockchainNetworkType,
} from "@prisma/client";

type WalletCreateData = {
  merchantId?: string;
  name?: string;
  currency?: string;
  blockchain?: string;
  network?: string;
  asset?: string;
  type?: string;
  address?: string;
  walletAddress?: string;
  metadata?: Record<string, unknown>;
};

type SupportedNetworkConfig = {
  nativeCurrency: CurrencyType;
  blockTime: number;
};

export default class WalletService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  private normalize(value?: string | null): string {
    return (value ?? "").trim().toUpperCase();
  }

  private getNetworkType(
    networkName: string
  ): BlockchainNetworkType {
    const normalized = this.normalize(networkName);

    if (
      !Object.prototype.hasOwnProperty.call(
        BlockchainNetworkType,
        normalized
      )
    ) {
      throw new Error(
        `Unsupported blockchain network: ${normalized || "unknown"}.`
      );
    }

    return normalized as BlockchainNetworkType;
  }

  private getWalletType(
    type?: string
  ): WalletType {
    const normalized = this.normalize(type);

    if (!normalized) {
      return WalletType.CRYPTO;
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        WalletType,
        normalized
      )
    ) {
      throw new Error(
        `Unsupported wallet type: ${normalized}.`
      );
    }

    return normalized as WalletType;
  }

  private getCurrencyType(
    currency: string
  ): CurrencyType {
    const normalized = this.normalize(currency);

    if (
      !Object.prototype.hasOwnProperty.call(
        CurrencyType,
        normalized
      )
    ) {
      throw new Error(
        `Unsupported wallet currency: ${normalized || "unknown"}.`
      );
    }

    return normalized as CurrencyType;
  }

  private getNetworkConfig(
    network: BlockchainNetworkType
  ): SupportedNetworkConfig | null {
    switch (network) {
      case BlockchainNetworkType.BITCOIN:
        return {
          nativeCurrency: CurrencyType.BTC,
          blockTime: 600,
        };

      case BlockchainNetworkType.ETHEREUM:
        return {
          nativeCurrency: CurrencyType.ETH,
          blockTime: 12,
        };

      case BlockchainNetworkType.SOLANA:
        return {
          nativeCurrency: CurrencyType.SOL,
          blockTime: 1,
        };

      case BlockchainNetworkType.CARDANO:
        return {
          nativeCurrency: CurrencyType.ADA,
          blockTime: 20,
        };

      case BlockchainNetworkType.RIPPLE:
        return {
          nativeCurrency: CurrencyType.XRP,
          blockTime: 4,
        };

      /*
       * BSC native currency is BNB.
       * Polygon native currency is MATIC.
       * Avalanche C-Chain native currency is AVAX.
       *
       * The current CurrencyType enum does not contain
       * BNB, MATIC or AVAX.
       *
       * Therefore SmartPOS must NOT fabricate a native
       * currency value simply to create these networks.
       *
       * These networks are accepted only when their
       * BlockchainNetwork records have already been
       * configured in the database.
       */
      case BlockchainNetworkType.BSC:
      case BlockchainNetworkType.POLYGON:
      case BlockchainNetworkType.AVALANCHE:
      case BlockchainNetworkType.ARBITRUM:
      case BlockchainNetworkType.OPTIMISM:
      case BlockchainNetworkType.BASE:
      case BlockchainNetworkType.TRON:
      case BlockchainNetworkType.LITECOIN:
      case BlockchainNetworkType.DASH:
      case BlockchainNetworkType.MONERO:
      case BlockchainNetworkType.ZCASH:
      case BlockchainNetworkType.TEZOS:
      case BlockchainNetworkType.ALGORAND:
      case BlockchainNetworkType.NEAR:
      case BlockchainNetworkType.COSMOS:
        return null;

      default:
        return null;
    }
  }

  private validateEvmAddress(
    address: string,
    network: BlockchainNetworkType
  ): string {
    const normalized = address.trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
      throw new Error(
        `Invalid ${network} wallet address. Enter a valid public EVM address beginning with 0x and containing exactly 40 hexadecimal characters after the prefix.`
      );
    }

    return normalized;
  }

  private validateBitcoinAddress(
    address: string
  ): string {
    const normalized = address.trim();

    const validBech32 =
      /^(bc1q|bc1p)[ac-hj-np-z02-9]{38,58}$/.test(
        normalized
      );

    const validLegacy =
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(
        normalized
      );

    if (!validBech32 && !validLegacy) {
      throw new Error(
        "Invalid Bitcoin wallet address. Enter a valid Bitcoin mainnet address."
      );
    }

    return normalized;
  }

  private validateSolanaAddress(
    address: string
  ): string {
    const normalized = address.trim();

    /*
     * Solana public keys are base58 encoded.
     * Base58 excludes 0, O, I and l.
     */
    if (
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
        normalized
      )
    ) {
      throw new Error(
        "Invalid Solana wallet address. Enter a valid Base58 Solana public address."
      );
    }

    return normalized;
  }

  private validateCardanoAddress(
    address: string
  ): string {
    const normalized = address.trim();

    if (
      !/^addr1[a-z0-9]{90,}$/.test(
        normalized
      )
    ) {
      throw new Error(
        "Invalid Cardano wallet address. Enter a valid Shelley mainnet address beginning with addr1."
      );
    }

    return normalized;
  }

  private validateRippleAddress(
    address: string
  ): string {
    const normalized = address.trim();

    if (
      !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(
        normalized
      )
    ) {
      throw new Error(
        "Invalid XRP wallet address. Enter a valid public XRP address beginning with r."
      );
    }

    return normalized;
  }

  private validateAddress(
    networkName: string,
    address?: string
  ): string {
    const network =
      this.getNetworkType(networkName);

    const normalizedAddress =
      (address ?? "").trim();

    if (!normalizedAddress) {
      throw new Error(
        "Wallet address is required. SmartPOS does not generate wallet addresses; enter the public address you already own."
      );
    }

    switch (network) {
      case BlockchainNetworkType.ETHEREUM:
      case BlockchainNetworkType.BSC:
      case BlockchainNetworkType.POLYGON:
      case BlockchainNetworkType.AVALANCHE:
      case BlockchainNetworkType.ARBITRUM:
      case BlockchainNetworkType.OPTIMISM:
      case BlockchainNetworkType.BASE:
        return this.validateEvmAddress(
          normalizedAddress,
          network
        );

      case BlockchainNetworkType.BITCOIN:
        return this.validateBitcoinAddress(
          normalizedAddress
        );

      case BlockchainNetworkType.SOLANA:
        return this.validateSolanaAddress(
          normalizedAddress
        );

      case BlockchainNetworkType.CARDANO:
        return this.validateCardanoAddress(
          normalizedAddress
        );

      case BlockchainNetworkType.RIPPLE:
        return this.validateRippleAddress(
          normalizedAddress
        );

      case BlockchainNetworkType.TRON:
        throw new Error(
          "TRON wallet addresses are not currently supported by SmartPOS. Do not save a TRON address until TRON validation and settlement support are implemented."
        );

      default:
        throw new Error(
          `Wallet address validation is not currently implemented for ${network}.`
        );
    }
  }

  private async ensureBlockchainNetwork(
    networkName: string,
    db: Prisma.TransactionClient
  ) {
    const network =
      this.getNetworkType(networkName);

    const existing =
      await db.blockchainNetwork.findUnique({
        where: {
          name: network,
        },
      });

    if (existing) {
      if (!existing.isActive) {
        throw new Error(
          `${network} is currently inactive and cannot be used for wallet settlement.`
        );
      }

      return existing;
    }

    const config =
      this.getNetworkConfig(network);

    /*
     * Do not invent native currencies for networks whose
     * native currency is not represented by the current
     * CurrencyType enum.
     *
     * The correct behaviour is to require the network
     * configuration to exist in the database.
     */
    if (!config) {
      throw new Error(
        `${network} is not configured in SmartPOS. The network must be configured with its correct native currency before a wallet can be saved.`
      );
    }

    return db.blockchainNetwork.create({
      data: {
        name: network,
        nativeCurrency:
          config.nativeCurrency,
        blockTime:
          config.blockTime,
        isActive: true,
        metadata: {
          source:
            "smartpos-wallet-storage",
          autoCreated: true,
          walletGeneration:
            false,
        },
      },
    });
  }

  private async createWalletRecord(
    data: WalletCreateData,
    db: Prisma.TransactionClient
  ) {
    const merchantId =
      this.normalize(data.merchantId);

    if (!merchantId) {
      throw new Error(
        "Merchant account is required."
      );
    }

    const merchant =
      await db.merchant.findUnique({
        where: {
          id: merchantId,
        },
      });

    if (!merchant) {
      throw new Error(
        "Merchant not found."
      );
    }

    const name =
      (data.name ?? "").trim();

    if (!name) {
      throw new Error(
        "Wallet name is required."
      );
    }

    if (name.length < 2) {
      throw new Error(
        "Wallet name must be at least 2 characters."
      );
    }

    if (name.length > 100) {
      throw new Error(
        "Wallet name must not exceed 100 characters."
      );
    }

    const blockchainName =
      this.normalize(
        data.blockchain ??
          data.network
      );

    const networkName =
      this.normalize(
        data.network ??
          data.blockchain
      );

    if (!blockchainName) {
      throw new Error(
        "Blockchain is required."
      );
    }

    if (!networkName) {
      throw new Error(
        "Network is required."
      );
    }

    if (
      blockchainName !==
      networkName
    ) {
      throw new Error(
        "Blockchain and network must refer to the same network."
      );
    }

    const network =
      this.getNetworkType(
        networkName
      );

    const asset =
      this.normalize(data.asset);

    if (!asset) {
      throw new Error(
        "Wallet asset is required."
      );
    }

    const assetCurrency =
      this.getCurrencyType(asset);

    const requestedCurrency =
      this.normalize(
        data.currency
      );

    /*
     * For crypto settlement wallets the asset is the
     * actual crypto currency represented by the wallet.
     *
     * If currency is provided, it must be a valid
     * CurrencyType. We do not silently replace invalid
     * values with USD.
     */
    if (requestedCurrency) {
      this.getCurrencyType(
        requestedCurrency
      );
    }

    const walletType =
      this.getWalletType(
        data.type
      );

    if (
      walletType === WalletType.FIAT
    ) {
      throw new Error(
        "A crypto settlement wallet cannot use the FIAT wallet type."
      );
    }

    const suppliedAddress =
      data.address ??
      data.walletAddress;

    const walletAddress =
      this.validateAddress(
        networkName,
        suppliedAddress
      );

    const blockchain =
      await this.ensureBlockchainNetwork(
        networkName,
        db
      );

    /*
     * Prevent an externally-owned public address from
     * being attached to multiple SmartPOS wallets.
     *
     * WalletAddress.address is also UNIQUE at the
     * database level.
     */
    const existingAddress =
      await db.walletAddress.findUnique({
        where: {
          address:
            walletAddress,
        },
        include: {
          wallet: true,
        },
      });

    if (existingAddress) {
      if (
        existingAddress.wallet
          .merchantId ===
        merchantId
      ) {
        throw new Error(
          "This wallet address is already saved for this merchant."
        );
      }

      throw new Error(
        "This wallet address is already associated with another merchant."
      );
    }

    /*
     * The wallet currency must represent the selected
     * crypto asset. This prevents a wallet selected as
     * USDT from silently becoming a USD wallet.
     */
    const walletCurrency =
      assetCurrency;

    /*
     * IMPORTANT:
     *
     * SmartPOS does NOT generate:
     * - wallet addresses
     * - private keys
     * - seed phrases
     * - mnemonics
     * - public keys
     *
     * The address below is supplied by the merchant.
     */
    const wallet =
      await db.wallet.create({
        data: {
          merchantId,

          name,

          type:
            walletType,

          currency:
            walletCurrency,

          balance:
            new Prisma.Decimal(0),

          availableBalance:
            new Prisma.Decimal(0),

          reservedBalance:
            new Prisma.Decimal(0),

          address:
            walletAddress,

          blockchainId:
            blockchain.id,

          encryptedPrivateKey:
            null,

          publicKey:
            null,

          metadata: {
            ...(data.metadata ?? {}),

            asset,

            network:
              networkName,

            blockchain:
              networkName,

            walletGenerated:
              false,

            addressSource:
              "merchant-provided",

            walletType:
              "EXTERNAL_SETTLEMENT",

            purpose:
              "crypto-settlement",

            custody:
              "merchant-controlled",

            smartposCustody:
              false,
          },
        },
      });

    /*
     * Address creation occurs inside the same Prisma
     * transaction as wallet creation.
     *
     * If this operation fails, the wallet record is
     * rolled back automatically.
     */
    await db.walletAddress.create({
      data: {
        walletId:
          wallet.id,

        address:
          walletAddress,

        blockchainId:
          blockchain.id,

        label:
          "Primary",

        isActive:
          true,

        metadata: {
          asset,

          network:
            networkName,

          source:
            "merchant-provided",

          addressType:
            "PUBLIC_SETTLEMENT_ADDRESS",
        },
      },
    });

    const savedWallet =
      await db.wallet.findUnique({
        where: {
          id: wallet.id,
        },

        include: {
          blockchain: true,
          walletAddresses: true,
        },
      });

    if (!savedWallet) {
      throw new Error(
        "Wallet was created but could not be retrieved."
      );
    }

    /*
     * Defensive check: never return a newly-created
     * wallet without its persisted primary address.
     */
    const persistedAddress =
      savedWallet.walletAddresses.find(
        (item) =>
          item.isActive &&
          item.address ===
            walletAddress
      );

    if (!persistedAddress) {
      throw new Error(
        "Wallet creation did not produce a persisted primary wallet address."
      );
    }

    return savedWallet;
  }

  async createWallet(
    data: WalletCreateData
  ) {
    return this.app.prisma.$transaction(
      async (tx) => {
        return this.createWalletRecord(
          data,
          tx
        );
      }
    );
  }

  async getWallet(
    id: string
  ) {
    const walletId =
      id.trim();

    if (!walletId) {
      throw new Error(
        "Wallet ID is required."
      );
    }

    return this.app.prisma.wallet.findUnique({
      where: {
        id: walletId,
      },

      include: {
        blockchain: true,
        walletAddresses: true,
      },
    });
  }

  async getWalletForMerchant(
    walletId: string,
    merchantId?: string
  ) {
    const normalizedWalletId =
      walletId.trim();

    const normalizedMerchantId =
      this.normalize(
        merchantId
      );

    if (!normalizedMerchantId) {
      throw new Error(
        "Merchant account is required."
      );
    }

    if (!normalizedWalletId) {
      throw new Error(
        "Wallet ID is required."
      );
    }

    const wallet =
      await this.app.prisma.wallet.findFirst({
        where: {
          id:
            normalizedWalletId,

          merchantId:
            normalizedMerchantId,
        },

        include: {
          blockchain: true,
          walletAddresses: true,
        },
      });

    if (!wallet) {
      throw new Error(
        "Wallet not found."
      );
    }

    return wallet;
  }

  async merchantWallets(
    merchantId: string
  ) {
    const normalizedMerchantId =
      this.normalize(
        merchantId
      );

    if (!normalizedMerchantId) {
      throw new Error(
        "Merchant account is required."
      );
    }

    return this.app.prisma.wallet.findMany({
      where: {
        merchantId:
          normalizedMerchantId,
      },

      include: {
        blockchain: true,
        walletAddresses: true,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });
  }

  async creditWallet(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Credit amount must be greater than zero."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: walletId,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        const balance =
          new Prisma.Decimal(
            wallet.balance
          );

        const newBalance =
          balance.plus(
            amount
          );

        return tx.wallet.update({
          where: {
            id: walletId,
          },

          data: {
            balance:
              newBalance,

            availableBalance:
              newBalance,
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }

  async debitWallet(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Debit amount must be greater than zero."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: walletId,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        const balance =
          new Prisma.Decimal(
            wallet.balance
          );

        if (
          balance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        const newBalance =
          balance.minus(
            amount
          );

        return tx.wallet.update({
          where: {
            id: walletId,
          },

          data: {
            balance:
              newBalance,

            availableBalance:
              newBalance,
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }

  async transferFunds(
    fromWalletId: string,
    toWalletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Transfer amount must be greater than zero."
      );
    }

    if (
      fromWalletId ===
      toWalletId
    ) {
      throw new Error(
        "Source and destination wallets must be different."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const fromWallet =
          await tx.wallet.findUnique({
            where: {
              id:
                fromWalletId,
            },
          });

        if (!fromWallet) {
          throw new Error(
            "Source wallet not found."
          );
        }

        const toWallet =
          await tx.wallet.findUnique({
            where: {
              id:
                toWalletId,
            },
          });

        if (!toWallet) {
          throw new Error(
            "Destination wallet not found."
          );
        }

        if (
          fromWallet.currency !==
          toWallet.currency
        ) {
          throw new Error(
            "Source and destination wallets must use the same currency."
          );
        }

        if (
          fromWallet.blockchainId !==
          toWallet.blockchainId
        ) {
          throw new Error(
            "Source and destination wallets must use the same blockchain network."
          );
        }

        const fromBalance =
          new Prisma.Decimal(
            fromWallet.balance
          );

        if (
          fromBalance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        const newFromBalance =
          fromBalance.minus(
            amount
          );

        const toBalance =
          new Prisma.Decimal(
            toWallet.balance
          );

        const newToBalance =
          toBalance.plus(
            amount
          );

        await tx.wallet.update({
          where: {
            id:
              fromWalletId,
          },

          data: {
            balance:
              newFromBalance,

            availableBalance:
              newFromBalance,
          },
        });

        await tx.wallet.update({
          where: {
            id:
              toWalletId,
          },

          data: {
            balance:
              newToBalance,

            availableBalance:
              newToBalance,
          },
        });

        return {
          fromWalletId,

          toWalletId,

          amount,

          status:
            "SUCCESS",
        };
      }
    );
  }

  async reserveFunds(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Reserve amount must be greater than zero."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: walletId,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        const availableBalance =
          new Prisma.Decimal(
            wallet.availableBalance
          );

        const reservedBalance =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        if (
          availableBalance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient available balance."
          );
        }

        return tx.wallet.update({
          where: {
            id: walletId,
          },

          data: {
            availableBalance:
              availableBalance.minus(
                amount
              ),

            reservedBalance:
              reservedBalance.plus(
                amount
              ),
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }

  async releaseFunds(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Release amount must be greater than zero."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: walletId,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        const availableBalance =
          new Prisma.Decimal(
            wallet.availableBalance
          );

        const reservedBalance =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        if (
          reservedBalance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient reserved balance."
          );
        }

        return tx.wallet.update({
          where: {
            id: walletId,
          },

          data: {
            availableBalance:
              availableBalance.plus(
                amount
              ),

            reservedBalance:
              reservedBalance.minus(
                amount
              ),
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }

  async captureFunds(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (
      amount.lessThanOrEqualTo(0)
    ) {
      throw new Error(
        "Capture amount must be greater than zero."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: walletId,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        const balance =
          new Prisma.Decimal(
            wallet.balance
          );

        const reservedBalance =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        const availableBalance =
          new Prisma.Decimal(
            wallet.availableBalance
          );

        if (
          reservedBalance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient reserved balance."
          );
        }

        if (
          balance.lessThan(
            amount
          )
        ) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        const newBalance =
          balance.minus(
            amount
          );

        const newReservedBalance =
          reservedBalance.minus(
            amount
          );

        return tx.wallet.update({
          where: {
            id: walletId,
          },

          data: {
            balance:
              newBalance,

            reservedBalance:
              newReservedBalance,

            availableBalance:
              availableBalance,
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }
}
