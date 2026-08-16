import type { FastifyInstance } from "fastify";

import {
  Prisma,
  CurrencyType,
  WalletType,
  BlockchainNetworkType,
} from "@prisma/client";

import type {
  AuthenticatedUser,
} from "../types/auth.js";

type WalletCreateData = {
  merchantId: string;

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

export default class WalletService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  private normalize(
    value?: string | null
  ): string {
    return (value ?? "")
      .trim()
      .toUpperCase();
  }

  private getNetworkType(
    value?: string
  ): BlockchainNetworkType {
    const network =
      this.normalize(value);

    if (!network) {
      throw new Error(
        "Blockchain network is required."
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        BlockchainNetworkType,
        network
      )
    ) {
      throw new Error(
        `Unsupported blockchain network: ${network}.`
      );
    }

    return network as BlockchainNetworkType;
  }

  private getWalletType(
    value?: string
  ): WalletType {
    const type =
      this.normalize(value);

    if (!type) {
      return WalletType.CRYPTO;
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        WalletType,
        type
      )
    ) {
      throw new Error(
        `Unsupported wallet type: ${type}.`
      );
    }

    if (type === WalletType.FIAT) {
      throw new Error(
        "A settlement wallet must be a crypto wallet."
      );
    }

    return type as WalletType;
  }

  private getCurrencyType(
    value?: string
  ): CurrencyType {
    const currency =
      this.normalize(value);

    if (!currency) {
      throw new Error(
        "Wallet asset is required."
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        CurrencyType,
        currency
      )
    ) {
      throw new Error(
        `Unsupported wallet asset: ${currency}.`
      );
    }

    return currency as CurrencyType;
  }

  private validateEvmAddress(
    address: string
  ): string {
    const value =
      address.trim();

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        value
      )
    ) {
      throw new Error(
        "Enter a valid public EVM wallet address beginning with 0x and containing 40 hexadecimal characters."
      );
    }

    return value;
  }

  private validateBitcoinAddress(
    address: string
  ): string {
    const value =
      address.trim();

    const bech32 =
      /^(bc1q|bc1p)[ac-hj-np-z02-9]{38,58}$/.test(
        value
      );

    const legacy =
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(
        value
      );

    if (!bech32 && !legacy) {
      throw new Error(
        "Enter a valid Bitcoin public wallet address."
      );
    }

    return value;
  }

  private validateSolanaAddress(
    address: string
  ): string {
    const value =
      address.trim();

    if (
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
        value
      )
    ) {
      throw new Error(
        "Enter a valid Solana public wallet address."
      );
    }

    return value;
  }

  private validateCardanoAddress(
    address: string
  ): string {
    const value =
      address.trim();

    if (
      !/^addr1[a-z0-9]{90,}$/.test(
        value
      )
    ) {
      throw new Error(
        "Enter a valid Cardano public wallet address beginning with addr1."
      );
    }

    return value;
  }

  private validateRippleAddress(
    address: string
  ): string {
    const value =
      address.trim();

    if (
      !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(
        value
      )
    ) {
      throw new Error(
        "Enter a valid XRP public wallet address beginning with r."
      );
    }

    return value;
  }

  private validateAddress(
    network: BlockchainNetworkType,
    address?: string
  ): string {
    const value =
      (address ?? "").trim();

    if (!value) {
      throw new Error(
        "Public wallet address is required."
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
          value
        );

      case BlockchainNetworkType.BITCOIN:
        return this.validateBitcoinAddress(
          value
        );

      case BlockchainNetworkType.SOLANA:
        return this.validateSolanaAddress(
          value
        );

      case BlockchainNetworkType.CARDANO:
        return this.validateCardanoAddress(
          value
        );

      case BlockchainNetworkType.RIPPLE:
        return this.validateRippleAddress(
          value
        );

      case BlockchainNetworkType.TRON:
        throw new Error(
          "TRON settlement addresses are not currently supported."
        );

      default:
        throw new Error(
          `Public address validation is not currently supported for ${network}.`
        );
    }
  }

  async resolveMerchantId(
    user: AuthenticatedUser
  ): Promise<string | null> {
    const directMerchantId =
      typeof user.merchantId === "string"
        ? user.merchantId.trim()
        : "";

    if (directMerchantId) {
      const merchant =
        await this.app.prisma.merchant.findUnique(
          {
            where: {
              id: directMerchantId,
            },
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          }
        );

      if (
        merchant &&
        !merchant.deletedAt &&
        merchant.status !== "SUSPENDED"
      ) {
        return merchant.id;
      }
    }

    const userIdCandidates = [
      user.sub,
      user.id,
      user.userId,
    ].filter(
      (
        value
      ): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    );

    for (
      const candidate of userIdCandidates
    ) {
      const dbUser =
        await this.app.prisma.user.findUnique(
          {
            where: {
              id: candidate.trim(),
            },
            select: {
              merchantId: true,
            },
          }
        );

      if (dbUser?.merchantId) {
        return dbUser.merchantId;
      }
    }

    if (
      typeof user.email === "string" &&
      user.email.trim()
    ) {
      const dbUser =
        await this.app.prisma.user.findUnique(
          {
            where: {
              email:
                user.email
                  .trim()
                  .toLowerCase(),
            },
            select: {
              merchantId: true,
            },
          }
        );

      if (dbUser?.merchantId) {
        return dbUser.merchantId;
      }
    }

    return null;
  }

  async createWallet(
    data: WalletCreateData
  ) {
    const merchantId =
      data.merchantId.trim();

    if (!merchantId) {
      throw new Error(
        "Authenticated merchant account is required."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const merchant =
          await tx.merchant.findUnique({
            where: {
              id: merchantId,
            },
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          });

        if (!merchant) {
          throw new Error(
            "Merchant not found."
          );
        }

        if (merchant.deletedAt) {
          throw new Error(
            "Merchant account is no longer active."
          );
        }

        if (
          merchant.status === "SUSPENDED"
        ) {
          throw new Error(
            "Merchant account is suspended."
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

        if (
          !blockchainName ||
          !networkName
        ) {
          throw new Error(
            "Blockchain and network are required."
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
          this.getCurrencyType(
            data.asset ??
              data.currency
          );

        const suppliedCurrency =
          this.normalize(
            data.currency
          );

        if (
          suppliedCurrency &&
          suppliedCurrency !== asset
        ) {
          throw new Error(
            "Wallet currency and asset must refer to the same crypto asset."
          );
        }

        const walletType =
          this.getWalletType(
            data.type
          );

        const walletAddress =
          this.validateAddress(
            network,
            data.address ??
              data.walletAddress
          );

        const blockchain =
          await tx.blockchainNetwork.findUnique(
            {
              where: {
                name: network,
              },
            }
          );

        if (!blockchain) {
          throw new Error(
            `${network} is not configured in SmartPOS.`
          );
        }

        if (!blockchain.isActive) {
          throw new Error(
            `${network} is currently inactive.`
          );
        }

        const existingAddress =
          await tx.walletAddress.findUnique(
            {
              where: {
                address: walletAddress,
              },
            }
          );

        if (existingAddress) {
          throw new Error(
            "This wallet address is already associated with a wallet."
          );
        }

        const wallet =
          await tx.wallet.create({
            data: {
              merchantId,

              name,

              type: walletType,

              currency: asset,

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

              publicKey: null,

              metadata: {
                ...(data.metadata ?? {}),

                asset,

                network,

                blockchain: network,

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

        await tx.walletAddress.create({
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

              network,

              source:
                "merchant-provided",

              addressType:
                "PUBLIC_SETTLEMENT_ADDRESS",
            },
          },
        });

        const savedWallet =
          await tx.wallet.findUnique({
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
            "Wallet could not be retrieved after saving."
          );
        }

        return savedWallet;
      }
    );
  }

  async getWalletForMerchant(
    walletId: string,
    merchantId: string
  ) {
    const id =
      walletId.trim();

    const merchant =
      merchantId.trim();

    if (!id) {
      throw new Error(
        "Wallet ID is required."
      );
    }

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    const wallet =
      await this.app.prisma.wallet.findFirst(
        {
          where: {
            id,

            merchantId:
              merchant,
          },

          include: {
            blockchain: true,
            walletAddresses: true,
          },
        }
      );

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
    const merchant =
      merchantId.trim();

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    return this.app.prisma.wallet.findMany(
      {
        where: {
          merchantId:
            merchant,
        },

        include: {
          blockchain: true,
          walletAddresses: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      }
    );
  }

  async listWallets() {
    return this.app.prisma.wallet.findMany({
      include: {
        blockchain: true,
        walletAddresses: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async ensureAdminMerchant(): Promise<string> {
    const adminEmail = "admin@smartpos.com";

    const adminUser = await this.app.prisma.user.findUnique({
      where: { email: adminEmail },
      select: { merchantId: true },
    });

    if (adminUser?.merchantId) {
      return adminUser.merchantId;
    }

    const merchant = await this.app.prisma.merchant.findFirst({
      where: { name: "Admin Merchant" },
      select: { id: true },
    });

    if (merchant?.id) {
      return merchant.id;
    }

    throw new Error(
      "Admin merchant not found. Run the reset_to_admin script to ensure an admin user and merchant exist."
    );
  }

  async creditWallet(
    walletId: string,
    amount: Prisma.Decimal,
    merchantId: string
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
          await tx.wallet.findFirst({
            where: {
              id: walletId,
              merchantId:
                merchantId.trim(),
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
          balance.plus(amount);

        return tx.wallet.update({
          where: {
            id: wallet.id,
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
    amount: Prisma.Decimal,
    merchantId: string
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
          await tx.wallet.findFirst({
            where: {
              id: walletId,
              merchantId:
                merchantId.trim(),
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
          balance.lessThan(amount)
        ) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        const newBalance =
          balance.minus(amount);

        return tx.wallet.update({
          where: {
            id: wallet.id,
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
    amount: Prisma.Decimal,
    merchantId: string
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

    const merchant =
      merchantId.trim();

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const fromWallet =
          await tx.wallet.findFirst({
            where: {
              id: fromWalletId,
              merchantId:
                merchant,
            },
          });

        if (!fromWallet) {
          throw new Error(
            "Source wallet not found."
          );
        }

        const toWallet =
          await tx.wallet.findFirst({
            where: {
              id: toWalletId,
              merchantId:
                merchant,
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
            id: fromWallet.id,
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
            id: toWallet.id,
          },

          data: {
            balance:
              newToBalance,

            availableBalance:
              newToBalance,
          },
        });

        return {
          fromWalletId:
            fromWallet.id,

          toWalletId:
            toWallet.id,

          amount,

          status:
            "SUCCESS",
        };
      }
    );
  }

  async deleteWallet(
    id: string,
    merchantId: string
  ) {
    const walletId =
      id.trim();

    const merchant =
      merchantId.trim();

    if (!walletId) {
      throw new Error(
        "Wallet ID is required."
      );
    }

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const wallet =
          await tx.wallet.findFirst({
            where: {
              id: walletId,
              merchantId:
                merchant,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found."
          );
        }

        await tx.walletAddress.deleteMany(
          {
            where: {
              walletId,
            },
          }
        );

        await tx.wallet.delete({
          where: {
            id: walletId,
          },
        });

        return walletId;
      }
    );
  }
}