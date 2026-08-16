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

export default class WalletService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  private normalize(
    value?: string | null
  ): string {
    return (value ?? "").trim().toUpperCase();
  }

  private getNetworkType(
    value?: string
  ): BlockchainNetworkType {
    const network = this.normalize(value);

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
    const type = this.normalize(value);

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
    const currency = this.normalize(value);

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
    const value = address.trim();

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(value)
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
    const value = address.trim();

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
    const value = address.trim();

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
    const value = address.trim();

    if (
      !/^addr1[a-z0-9]{90,}$/.test(value)
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
    const value = address.trim();

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
    const value = (address ?? "").trim();

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
        return this.validateEvmAddress(value);

      case BlockchainNetworkType.BITCOIN:
        return this.validateBitcoinAddress(value);

      case BlockchainNetworkType.SOLANA:
        return this.validateSolanaAddress(value);

      case BlockchainNetworkType.CARDANO:
        return this.validateCardanoAddress(value);

      case BlockchainNetworkType.RIPPLE:
        return this.validateRippleAddress(value);

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

  private async createWalletRecord(
    data: WalletCreateData,
    db: Prisma.TransactionClient
  ) {
    // Merchant association is optional. If a merchantId was supplied
    // verify it exists; otherwise create a wallet without a merchant.
    const rawMerchantId =
      typeof data.merchantId === "string"
        ? data.merchantId.trim()
        : "";

    let merchantId = rawMerchantId || null;

    let merchant = null;

    // If no merchantId supplied, prefer using an admin-owned merchant.
    // Find admin user by email and use/create a merchant for that admin.
    if (!merchantId) {
      const adminEmail = "admin@smartpos.com";

      const adminUser = await db.user.findUnique({
        where: { email: adminEmail },
      });

      if (adminUser) {
        if (adminUser.merchantId) {
          merchant = await db.merchant.findUnique({
            where: { id: adminUser.merchantId },
          });
        }

        if (!merchant) {
          merchant = await db.merchant.create({
            data: {
              name: "Admin Merchant",
              businessType: "INTERNAL",
              email: adminEmail,
              timezone: "UTC",
              status: "ACTIVE",
            },
          });

          // update the admin user to reference this merchant
          await db.user.update({
            where: { id: adminUser.id },
            data: { merchantId: merchant.id },
          });
        }

        merchantId = merchant.id;
      } else {
        // As a last-resort fallback create a system merchant (should be rare)
        const systemEmail = "system@smartpos.internal";

        merchant = await db.merchant.findUnique({
          where: { email: systemEmail },
        });

        if (!merchant) {
          merchant = await db.merchant.create({
            data: {
              name: "System Merchant",
              businessType: "INTERNAL",
              email: systemEmail,
              timezone: "UTC",
              status: "ACTIVE",
            },
          });
        }

        merchantId = merchant.id;
      }
    } else {
      merchant = await db.merchant.findUnique({ where: { id: merchantId } });

      if (!merchant) {
        throw new Error("Merchant not found.");
      }
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
        data.blockchain ?? data.network
      );

    const networkName =
      this.normalize(
        data.network ?? data.blockchain
      );

    if (!blockchainName || !networkName) {
      throw new Error(
        "Blockchain and network are required."
      );
    }

    if (blockchainName !== networkName) {
      throw new Error(
        "Blockchain and network must refer to the same network."
      );
    }

    const network =
      this.getNetworkType(networkName);

    const asset =
      this.getCurrencyType(
        data.asset ?? data.currency
      );

    const suppliedCurrency =
      this.normalize(data.currency);

    if (
      suppliedCurrency &&
      suppliedCurrency !== asset
    ) {
      throw new Error(
        "Wallet currency and asset must refer to the same crypto asset."
      );
    }

    const walletType =
      this.getWalletType(data.type);

    const walletAddress =
      this.validateAddress(
        network,
        data.address ??
          data.walletAddress
      );

    const blockchain =
      await db.blockchainNetwork.findUnique({
        where: {
          name: network,
        },
      });

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
      await db.walletAddress.findUnique({
        where: {
          address: walletAddress,
        },
        include: {
          wallet: true,
        },
      });

    if (existingAddress) {
      // If the exact address already exists, always prevent duplicate
      // saving regardless of merchant to maintain global uniqueness.
      throw new Error(
        "This wallet address is already associated with another merchant or already exists."
      );
    }

    const createData: any = {
      name,
      type: walletType,
      currency: asset,

      balance: new Prisma.Decimal(0),

      availableBalance: new Prisma.Decimal(0),

      reservedBalance: new Prisma.Decimal(0),

      address: walletAddress,

      blockchainId: blockchain.id,

      encryptedPrivateKey: null,

      publicKey: null,

      metadata: {
        ...(data.metadata ?? {}),

        asset,

        network,

        blockchain: network,

        walletGenerated: false,

        addressSource: "merchant-provided",

        walletType: "EXTERNAL_SETTLEMENT",

        purpose: "crypto-settlement",

        custody: "merchant-controlled",

        smartposCustody: false,
      },
    };

    if (merchantId) {
      createData.merchantId = merchantId;
    }

    const wallet = await db.wallet.create({
      data: createData,
    });

    await db.walletAddress.create({
      data: {
        walletId: wallet.id,

        address: walletAddress,

        blockchainId:
          blockchain.id,

        label: "Primary",

        isActive: true,

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
        "Wallet could not be retrieved after saving."
      );
    }

    return savedWallet;
  }

  async createWallet(
    data: WalletCreateData
  ) {
    return this.app.prisma.$transaction(
      (tx) =>
        this.createWalletRecord(
          data,
          tx
        )
    );
  }

  async getWallet(
    id: string
  ) {
    const walletId = id.trim();

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
    const id = walletId.trim();
    const merchant =
      this.normalize(merchantId);

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    if (!id) {
      throw new Error(
        "Wallet ID is required."
      );
    }

    const wallet =
      await this.app.prisma.wallet.findFirst({
        where: {
          id,
          merchantId: merchant,
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
    const merchant =
      this.normalize(merchantId);

    if (!merchant) {
      throw new Error(
        "Merchant account is required."
      );
    }

    return this.app.prisma.wallet.findMany({
      where: {
        merchantId: merchant,
      },
      include: {
        blockchain: true,
        walletAddresses: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async creditWallet(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (amount.lessThanOrEqualTo(0)) {
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
          balance.plus(amount);

        return tx.wallet.update({
          where: {
            id: walletId,
          },
          data: {
            balance: newBalance,
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
    if (amount.lessThanOrEqualTo(0)) {
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

        if (balance.lessThan(amount)) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        const newBalance =
          balance.minus(amount);

        return tx.wallet.update({
          where: {
            id: walletId,
          },
          data: {
            balance: newBalance,
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
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error(
        "Transfer amount must be greater than zero."
      );
    }

    if (fromWalletId === toWalletId) {
      throw new Error(
        "Source and destination wallets must be different."
      );
    }

    return this.app.prisma.$transaction(
      async (tx) => {
        const fromWallet =
          await tx.wallet.findUnique({
            where: {
              id: fromWalletId,
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
              id: toWalletId,
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

        if (fromBalance.lessThan(amount)) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        await tx.wallet.update({
          where: {
            id: fromWalletId,
          },
          data: {
            balance:
              fromBalance.minus(amount),

            availableBalance:
              fromBalance.minus(amount),
          },
        });

        const toBalance =
          new Prisma.Decimal(
            toWallet.balance
          );

        await tx.wallet.update({
          where: {
            id: toWalletId,
          },
          data: {
            balance:
              toBalance.plus(amount),

            availableBalance:
              toBalance.plus(amount),
          },
        });

        return {
          fromWalletId,
          toWalletId,
          amount,
          status: "SUCCESS",
        };
      }
    );
  }

  async reserveFunds(
    walletId: string,
    amount: Prisma.Decimal
  ) {
    if (amount.lessThanOrEqualTo(0)) {
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

        const available =
          new Prisma.Decimal(
            wallet.availableBalance
          );

        const reserved =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        if (available.lessThan(amount)) {
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
              available.minus(amount),

            reservedBalance:
              reserved.plus(amount),
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
    if (amount.lessThanOrEqualTo(0)) {
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

        const available =
          new Prisma.Decimal(
            wallet.availableBalance
          );

        const reserved =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        if (reserved.lessThan(amount)) {
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
              available.plus(amount),

            reservedBalance:
              reserved.minus(amount),
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
    if (amount.lessThanOrEqualTo(0)) {
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

        const reserved =
          new Prisma.Decimal(
            wallet.reservedBalance
          );

        if (reserved.lessThan(amount)) {
          throw new Error(
            "Insufficient reserved balance."
          );
        }

        if (balance.lessThan(amount)) {
          throw new Error(
            "Insufficient wallet balance."
          );
        }

        return tx.wallet.update({
          where: {
            id: walletId,
          },
          data: {
            balance:
              balance.minus(amount),

            reservedBalance:
              reserved.minus(amount),
          },
          include: {
            blockchain: true,
            walletAddresses: true,
          },
        });
      }
    );
  }

  async deleteWallet(id: string) {
    const walletId = id?.trim();

    if (!walletId) {
      throw new Error("Wallet ID is required.");
    }

    return this.app.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });

      if (!wallet) {
        throw new Error("Wallet not found.");
      }

      // Remove addresses first to avoid FK constraints
      await tx.walletAddress.deleteMany({ where: { walletId } });

      // Attempt to delete the wallet itself
      await tx.wallet.delete({ where: { id: walletId } });

      return walletId;
    });
  }
}