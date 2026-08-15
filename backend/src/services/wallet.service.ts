import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { Wallet as EthersWallet } from "ethers";


export default class WalletService {
  constructor(private readonly app: FastifyInstance) {}

  private deriveEncryptionKey() {
    const secret =
      process.env.ENCRYPTION_KEY ??
      process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        "Wallet encryption is not configured. Set ENCRYPTION_KEY or JWT_SECRET."
      );
    }

    return crypto
      .createHash("sha256")
      .update(secret)
      .digest();
  }

  private encryptPrivateKey(privateKey: string) {
    const key = this.deriveEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      key,
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(privateKey, "utf8"),
      cipher.final(),
    ]);

    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  }

  private async ensureBlockchainNetwork(
    db: any,
    networkName: string
  ) {
    const normalized = networkName.toUpperCase();

    const existing =
      await db.blockchainNetwork.findUnique({
        where: {
          name: normalized as any,
        },
      });

    if (existing) {
      return existing;
    }

    return db.blockchainNetwork.create({
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
    }
  ) {
    return this.app.prisma.$transaction(
      async (tx) => {
        /*
         * ---------------------------------------------------------
         * 1. VALIDATE MERCHANT
         * ---------------------------------------------------------
         */

        const merchant =
          await tx.merchant.findUnique({
            where: {
              id: data.merchantId,
            },
          });

        if (!merchant) {
          throw new Error(
            "Merchant not found."
          );
        }

        /*
         * ---------------------------------------------------------
         * 2. NORMALIZE NETWORK + ASSET
         * ---------------------------------------------------------
         */

        const networkName = (
          data.blockchain ??
          data.network ??
          "ETHEREUM"
        )
          .trim()
          .toUpperCase();

        const assetSymbol = (
          data.asset ??
          "USDT"
        )
          .trim()
          .toUpperCase();

        /*
         * ---------------------------------------------------------
         * 3. SUPPORTED BLOCKCHAIN VALIDATION
         *
         * ethers.Wallet creates EVM wallets.
         *
         * Therefore:
         * ETHEREUM -> supported
         * BSC      -> supported
         * TRON     -> rejected
         * ---------------------------------------------------------
         */

        const supportedNetworks = [
          "ETHEREUM",
          "BSC",
        ];

        if (!supportedNetworks.includes(networkName)) {
          if (networkName === "TRON") {
            throw new Error(
              "TRON wallet creation is not supported yet. Please select Ethereum or BSC."
            );
          }

          throw new Error(
            `Wallet creation is not supported for ${networkName}.`
          );
        }

        /*
         * ---------------------------------------------------------
         * 4. GENERATE OR USE PROVIDED WALLET
         *
         * If an address was explicitly supplied, treat it as an
         * external wallet.
         *
         * Otherwise SmartPOS generates the wallet itself.
         * ---------------------------------------------------------
         */

        let walletAddress = (
          data.address ??
          data.walletAddress ??
          ""
        ).trim();

        let encryptedPrivateKey:
          | string
          | null = null;

        let publicKey:
          | string
          | null = null;

        let walletGenerated = false;

        if (!walletAddress) {
          /*
           * Generate a real EVM wallet.
           */
          const generatedWallet =
            EthersWallet.createRandom();

          walletAddress =
            generatedWallet.address;

          publicKey =
            generatedWallet.publicKey;

          /*
           * Never expose the private key to the frontend.
           *
           * Store only the encrypted private key.
           */
          encryptedPrivateKey =
            this.encryptPrivateKey(
              generatedWallet.privateKey
            );

          walletGenerated = true;
        }

        /*
         * ---------------------------------------------------------
         * 5. VALIDATE WALLET ADDRESS
         * ---------------------------------------------------------
         */

        if (!walletAddress) {
          throw new Error(
            "Unable to create wallet address."
          );
        }

        /*
         * Ethereum and BSC both use EVM addresses.
         */
        if (
          networkName === "ETHEREUM" ||
          networkName === "BSC"
        ) {
          if (
            !/^0x[a-fA-F0-9]{40}$/.test(
              walletAddress
            )
          ) {
            throw new Error(
              "Invalid wallet address. The address must be a valid EVM address beginning with 0x."
            );
          }
        }

        /*
         * ---------------------------------------------------------
         * 6. ENSURE BLOCKCHAIN NETWORK EXISTS
         * ---------------------------------------------------------
         */

        const blockchain =
          await this.ensureBlockchainNetwork(
            tx,
            networkName
          );

        /*
         * ---------------------------------------------------------
         * 7. PREVENT DUPLICATE WALLET ADDRESS
         * ---------------------------------------------------------
         */

        const existingAddress =
          await tx.walletAddress.findUnique({
            where: {
              address: walletAddress,
            },
            include: {
              wallet: true,
            },
          });

        if (existingAddress) {
          if (
            existingAddress.wallet.merchantId ===
            data.merchantId
          ) {
            throw new Error(
              "This wallet address is already saved."
            );
          }

          throw new Error(
            "This wallet address is already associated with another merchant."
          );
        }

        /*
         * ---------------------------------------------------------
         * 8. CREATE WALLET
         * ---------------------------------------------------------
         */

        const wallet =
          await tx.wallet.create({
            data: {
              merchantId:
                data.merchantId,

              name:
                data.name?.trim() ||
                `${assetSymbol} Settlement Wallet`,

              type:
                (data.type ??
                  "CRYPTO") as any,

              currency:
                (data.currency ??
                  "USD") as any,

              balance:
                data.balance ??
                new Prisma.Decimal(0),

              availableBalance:
                data.availableBalance ??
                new Prisma.Decimal(0),

              reservedBalance:
                data.reservedBalance ??
                new Prisma.Decimal(0),

              address:
                walletAddress,

              blockchainId:
                blockchain.id,

              /*
               * Generated wallets have their private key
               * encrypted and stored server-side.
               *
               * External wallets have no private key stored.
               */
              encryptedPrivateKey,

              publicKey,

              metadata: {
                ...(data.metadata ?? {}),

                asset:
                  assetSymbol,

                network:
                  networkName,

                walletGenerated,

                walletType:
                  walletGenerated
                    ? "SMARTPOS_GENERATED"
                    : "EXTERNAL_SETTLEMENT",

                purpose:
                  "crypto-settlement",
              },
            },
          });

        /*
         * ---------------------------------------------------------
         * 9. CREATE PRIMARY WALLET ADDRESS
         * ---------------------------------------------------------
         */

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
              asset:
                assetSymbol,

              network:
                networkName,

              source:
                walletGenerated
                  ? "smartpos-wallet-creation"
                  : "merchant-settlement-wallet",
            },
          },
        });

        /*
         * ---------------------------------------------------------
         * 10. RETURN COMPLETE SAFE WALLET
         *
         * The controller removes encryptedPrivateKey before
         * sending the response to the frontend.
         * ---------------------------------------------------------
         */

        const createdWallet =
          await tx.wallet.findUnique({
            where: {
              id: wallet.id,
            },

            include: {
              blockchain: true,

              walletAddresses: true,
            },
          });

        if (!createdWallet) {
          throw new Error(
            "Wallet was created but could not be retrieved."
          );
        }

        return createdWallet;
      }
    );
  }

  async getWallet(id: string) {
    return this.app.prisma.wallet.findUnique({
      where: {
        id,
      },

      include: {
        blockchain: true,

        walletAddresses: true,
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

    const wallet =
      await this.getWallet(walletId);

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

    return this.app.prisma.wallet.update({
      where: {
        id: walletId,
      },

      data: {
        balance:
          newBalance,

        availableBalance:
          newBalance,
      },
    });
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

    const wallet =
      await this.getWallet(walletId);

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

    return this.app.prisma.wallet.update({
      where: {
        id: walletId,
      },

      data: {
        balance:
          newBalance,

        availableBalance:
          newBalance,
      },
    });
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
          toBalance.plus(amount);

        await tx.wallet.update({
          where: {
            id: fromWalletId,
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
            id: toWalletId,
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
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error(
        "Reserve amount must be greater than zero."
      );
    }

    const wallet =
      await this.getWallet(walletId);

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

    return this.app.prisma.wallet.update({
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
    });
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

    const wallet =
      await this.getWallet(walletId);

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

    return this.app.prisma.wallet.update({
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
    });
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

    const wallet =
      await this.getWallet(walletId);

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

    return this.app.prisma.wallet.update({
      where: {
        id: walletId,
      },

      data: {
        balance:
          balance.minus(amount),

        reservedBalance:
          reservedBalance.minus(
            amount
          ),

        availableBalance,
      },
    });
  }

  async merchantWallets(
    merchantId: string
  ) {
    if (!merchantId) {
      throw new Error(
        "Merchant ID is required."
      );
    }

    return this.app.prisma.wallet.findMany({
      where: {
        merchantId,
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
}