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

    const networkName = (data.blockchain ?? data.network ?? "ETHEREUM").toUpperCase();
    const assetSymbol = (data.asset ?? "USDT").toUpperCase();
    // Do not create TRON wallets using Ethers (EVM) key generation
    if (networkName === "TRON") {
      throw new Error("TRON network is not supported for automatic wallet generation. Use an EVM-compatible network such as ETHEREUM or BSC.");
    }

    const generated = EthersWallet.createRandom();
    const blockchain = await this.ensureBlockchainNetwork(networkName);
    const walletAddress = data.address ?? data.walletAddress ?? generated.address;

    // Create wallet and walletAddress atomically so partial failures do not leave broken state
    const results = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          merchantId: data.merchantId,
          name: data.name ?? `${assetSymbol} Wallet`,
          type: (data.type ?? "CRYPTO") as any,
          currency: (data.currency ?? "USD") as any,
          balance: data.balance ?? new Prisma.Decimal(0),
          availableBalance: data.availableBalance ?? new Prisma.Decimal(0),
          reservedBalance: data.reservedBalance ?? new Prisma.Decimal(0),
          address: walletAddress,
          blockchainId: blockchain.id,
          encryptedPrivateKey: this.encryptPrivateKey(generated.privateKey),
          publicKey: generated.publicKey,
          metadata: {
            ...(data.metadata ?? {}),
            asset: assetSymbol,
            network: networkName,
            walletGenerated: true,
          },
        },
      });

      const walletAddr = await tx.walletAddress.create({
        data: {
          walletId: wallet.id,
          address: walletAddress,
          blockchainId: blockchain.id,
          label: "Primary",
          metadata: {
            asset: assetSymbol,
            network: networkName,
          },
        },
      });

      return { walletId: wallet.id };
    });

    // Return the wallet including related blockchain and addresses
    return db.wallet.findUnique({
      where: { id: results.walletId },
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

