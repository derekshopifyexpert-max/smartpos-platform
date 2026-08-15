import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { Wallet as EthersWallet } from "ethers";

export default class WalletService {
  constructor(private readonly app: FastifyInstance) {}

  private deriveEncryptionKey() {
    const secret = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "smartpos-wallet-key";
    return crypto.createHash("sha256").update(secret).digest();
  }

  private encryptPrivateKey(privateKey: string) {
    const key = this.deriveEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(privateKey, "utf8"),
      cipher.final(),
    ]);

    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  }

  private async ensureBlockchainNetwork(networkName: string) {
    const normalized = networkName.toUpperCase();

    const existing = await this.app.prisma.blockchainNetwork.findUnique({
      where: { name: normalized as any },
    });

    if (existing) {
      return existing;
    }

    return this.app.prisma.blockchainNetwork.create({
      data: {
        name: normalized as any,
        nativeCurrency: "USD",
        blockTime: 12,
        isActive: true,
        metadata: {
          autoCreated: true,
          source: "smartpos-wallet-creation",
        },
      },
    });
  }

  async createWallet(
  data: {
    merchantId: string;
    name?: string;
    currency?: any;
    balance?: Prisma.Decimal;
    availableBalance?: Prisma.Decimal;
    reservedBalance?: Prisma.Decimal;
    blockchain?: string;
    network?: string;
    asset?: string;
    type?: string;
    address?: string;
    walletAddress?: string;
    metadata?: Record<string, unknown>;
  },
  db = this.app.prisma
) {
  const merchant = await db.merchant.findUnique({
    where: { id: data.merchantId },
  });

  if (!merchant) {
    throw new Error("Merchant not found.");
  }

  const networkName = (
    data.blockchain ??
    data.network ??
    "ETHEREUM"
  ).toUpperCase();

  const assetSymbol = (
    data.asset ??
    "USDT"
  ).toUpperCase();

  const walletAddress = (
    data.address ??
    data.walletAddress ??
    ""
  ).trim();

  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  // Only accept EVM addresses for Ethereum/BSC.
  if (
    networkName === "ETHEREUM" ||
    networkName === "BSC"
  ) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error(
        "Invalid wallet address. Enter a valid EVM address beginning with 0x."
      );
    }
  }

  const blockchain = await this.ensureBlockchainNetwork(networkName);

  // Prevent the same external address from being saved twice.
  const existingAddress = await db.walletAddress.findUnique({
    where: {
      address: walletAddress,
    },
    include: {
      wallet: true,
    },
  });

  if (existingAddress) {
    if (existingAddress.wallet.merchantId === data.merchantId) {
      throw new Error("This wallet address is already saved.");
    }

    throw new Error("This wallet address is already associated with another merchant.");
  }

  const wallet = await db.wallet.create({
    data: {
      merchantId: data.merchantId,
      name: data.name?.trim() || `${assetSymbol} Settlement Wallet`,
      type: (data.type ?? "CRYPTO") as any,
      currency: (data.currency ?? "USD") as any,

      balance: data.balance ?? new Prisma.Decimal(0),
      availableBalance:
        data.availableBalance ?? new Prisma.Decimal(0),
      reservedBalance:
        data.reservedBalance ?? new Prisma.Decimal(0),

      address: walletAddress,
      blockchainId: blockchain.id,

      // IMPORTANT:
      // This is an externally owned settlement wallet.
      // SmartPOS does not own its private key.
      encryptedPrivateKey: null,
      publicKey: null,

      metadata: {
        ...(data.metadata ?? {}),
        asset: assetSymbol,
        network: networkName,
        walletGenerated: false,
        walletType: "EXTERNAL_SETTLEMENT",
        purpose: "crypto-settlement",
      },
    },
  });

  await db.walletAddress.create({
    data: {
      walletId: wallet.id,
      address: walletAddress,
      blockchainId: blockchain.id,
      label: "Primary",
      isActive: true,
      metadata: {
        asset: assetSymbol,
        network: networkName,
        source: "merchant-settlement-wallet",
      },
    },
  });

  return db.wallet.findUnique({
    where: {
      id: wallet.id,
    },
    include: {
      blockchain: true,
      walletAddresses: true,
    },
  });
}

  async getWallet(id: string) {
    return this.app.prisma.wallet.findUnique({
      where: { id },
      include: {
        blockchain: true,
        walletAddresses: true,
      },
    });
  }

  async creditWallet(walletId: string, amount: Prisma.Decimal) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const balance = new Prisma.Decimal(wallet.balance);
    const newBalance = balance.plus(amount);

    return this.app.prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        availableBalance: newBalance,
      },
    });
  }

  async debitWallet(walletId: string, amount: Prisma.Decimal) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const balance = new Prisma.Decimal(wallet.balance);

    if (balance.lessThan(amount)) {
      throw new Error("Insufficient wallet balance.");
    }

    const newBalance = balance.minus(amount);

    return this.app.prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        availableBalance: newBalance,
      },
    });
  }

  async transferFunds(fromWalletId: string, toWalletId: string, amount: Prisma.Decimal) {
    return this.app.prisma.$transaction(async (tx) => {
      const fromWallet = await tx.wallet.findUnique({
        where: { id: fromWalletId },
      });

      if (!fromWallet) {
        throw new Error("Source wallet not found.");
      }

      const toWallet = await tx.wallet.findUnique({
        where: { id: toWalletId },
      });

      if (!toWallet) {
        throw new Error("Destination wallet not found.");
      }

      const fromBalance = new Prisma.Decimal(fromWallet.balance);
      if (fromBalance.lessThan(amount)) {
        throw new Error("Insufficient wallet balance.");
      }

      const newFromBalance = fromBalance.minus(amount);
      const toBalance = new Prisma.Decimal(toWallet.balance);
      const newToBalance = toBalance.plus(amount);

      await tx.wallet.update({
        where: { id: fromWalletId },
        data: {
          balance: newFromBalance,
          availableBalance: newFromBalance,
        },
      });

      await tx.wallet.update({
        where: { id: toWalletId },
        data: {
          balance: newToBalance,
          availableBalance: newToBalance,
        },
      });

      return {
        fromWalletId,
        toWalletId,
        amount,
        status: "SUCCESS",
      };
    });
  }

  async reserveFunds(walletId: string, amount: Prisma.Decimal) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const availableBalance = new Prisma.Decimal(wallet.availableBalance);
    const reservedBalance = new Prisma.Decimal(wallet.reservedBalance);

    if (availableBalance.lessThan(amount)) {
      throw new Error("Insufficient available balance.");
    }

    return this.app.prisma.wallet.update({
      where: { id: walletId },
      data: {
        availableBalance: availableBalance.minus(amount),
        reservedBalance: reservedBalance.plus(amount),
      },
    });
  }

  async releaseFunds(walletId: string, amount: Prisma.Decimal) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const availableBalance = new Prisma.Decimal(wallet.availableBalance);
    const reservedBalance = new Prisma.Decimal(wallet.reservedBalance);

    if (reservedBalance.lessThan(amount)) {
      throw new Error("Insufficient reserved balance.");
    }

    return this.app.prisma.wallet.update({
      where: { id: walletId },
      data: {
        availableBalance: availableBalance.plus(amount),
        reservedBalance: reservedBalance.minus(amount),
      },
    });
  }

  async captureFunds(walletId: string, amount: Prisma.Decimal) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const balance = new Prisma.Decimal(wallet.balance);
    const reservedBalance = new Prisma.Decimal(wallet.reservedBalance);
    const availableBalance = new Prisma.Decimal(wallet.availableBalance);

    if (reservedBalance.lessThan(amount)) {
      throw new Error("Insufficient reserved balance.");
    }

    return this.app.prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: balance.minus(amount),
        reservedBalance: reservedBalance.minus(amount),
        availableBalance,
      },
    });
  }

  async merchantWallets(merchantId: string) {
    return this.app.prisma.wallet.findMany({
      where: { merchantId },
      include: {
        blockchain: true,
        walletAddresses: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

