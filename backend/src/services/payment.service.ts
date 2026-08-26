import {
  Prisma,
  PaymentStatus,
  TransactionStatus,
  SettlementStatus,
} from "@prisma/client";
import { FastifyInstance } from "fastify";
import crypto from "crypto";

type PrismaTransactionClient =
  Prisma.TransactionClient;

export default class PaymentService {
  constructor(
    private readonly app: FastifyInstance,
  ) {}

  /*
   * --------------------------------------------------------------------------
   * Database Client
   * --------------------------------------------------------------------------
   */

  private db(
    tx?: PrismaTransactionClient,
  ) {
    return tx ?? this.app.prisma;
  }

  /*
   * --------------------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------------------
   */

  private generateReference(): string {
    return `TX-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;
  }

  private generateClientSecret(): string {
    return crypto
      .randomBytes(32)
      .toString("hex");
  }

  private normalizeJson(
    value: Prisma.JsonValue,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value),
    ) as Prisma.InputJsonValue;
  }

  private normalizeMetadata(
    metadata?: Prisma.JsonValue,
  ): Prisma.InputJsonValue {
    if (
      metadata === undefined ||
      metadata === null
    ) {
      return {};
    }

    const normalized =
      this.normalizeJson(metadata);

    if (
      typeof normalized !== "object" ||
      Array.isArray(normalized)
    ) {
      return normalized;
    }

    const result =
      normalized as Record<
        string,
        Prisma.InputJsonValue
      >;

    /*
     * SmartPOS supports several historical metadata
     * aliases for crypto settlement destinations.
     *
     * Keep one canonical representation:
     *
     * metadata.cryptoDestination
     */

    const destinationCandidates = [
      "cryptoDestination",
      "crypto_destination",
      "destination",
    ];

    for (const key of destinationCandidates) {
      const candidate = result[key];

      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        const existing =
          result.cryptoDestination;

        result.cryptoDestination = {
          ...(existing &&
          typeof existing === "object" &&
          !Array.isArray(existing)
            ? (existing as Record<
                string,
                Prisma.InputJsonValue
              >)
            : {}),

          ...(candidate as Record<
            string,
            Prisma.InputJsonValue
          >),
        };
      }
    }

    return result;
  }

  private normalizeOptionalJson(
    value?: Prisma.JsonValue | null,
  ):
    | Prisma.InputJsonValue
    | typeof Prisma.JsonNull {
    return value === undefined ||
      value === null
      ? Prisma.JsonNull
      : this.normalizeJson(value);
  }

  /*
   * --------------------------------------------------------------------------
   * Payment Intent
   * --------------------------------------------------------------------------
   */

  async createPaymentIntent(
    data: {
      merchantId: string;
      customerId?: string;
      paymentMethodId?: string;
      paymentProviderAccountId?: string;
      amount: Prisma.Decimal;
      currency: any;
      description?: string;
      metadata?: Prisma.JsonValue;
      expiresAt?: Date;
    },
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).paymentIntent.create({
      data: {
        merchantId:
          data.merchantId,

        customerId:
          data.customerId,

        paymentMethodId:
          data.paymentMethodId,

        paymentProviderAccountId:
          data.paymentProviderAccountId,

        amount:
          data.amount,

        currency:
          data.currency,

        description:
          data.description,

        metadata:
          this.normalizeOptionalJson(
            data.metadata,
          ),

        clientSecret:
          this.generateClientSecret(),

        expiresAt:
          data.expiresAt,

        status:
          PaymentStatus.PENDING,
      },
    });
  }

  async getPaymentIntent(
    paymentIntentId: string,
  ) {
    return this.app.prisma.paymentIntent.findUnique({
      where: {
        id: paymentIntentId,
      },

      include: {
        merchant: true,
        customer: true,
        paymentAttempts: true,
        transactions: true,
      },
    });
  }

  async listPaymentIntents(
    page = 1,
    limit = 10,
  ) {
    const safePage =
      Math.max(1, page);

    const safeLimit =
      Math.max(1, Math.min(limit, 100));

    const skip =
      (safePage - 1) *
      safeLimit;

    const [items, total] =
      await this.app.prisma.$transaction([
        this.app.prisma.paymentIntent.findMany({
          skip,
          take: safeLimit,

          include: {
            merchant: true,
            customer: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        }),

        this.app.prisma.paymentIntent.count(),
      ]);

    return {
      items,

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(
          total / safeLimit,
        ),
      },
    };
  }

  async listTransactions(
    page = 1,
    limit = 10,
  ) {
    const safePage =
      Math.max(1, page);

    const safeLimit =
      Math.max(1, Math.min(limit, 100));

    const skip =
      (safePage - 1) *
      safeLimit;

    const [items, total] =
      await this.app.prisma.$transaction([
        this.app.prisma.transaction.findMany({
          skip,
          take: safeLimit,

          orderBy: {
            createdAt: "desc",
          },

          include: {
            merchant: true,
            terminal: true,
          },
        }),

        this.app.prisma.transaction.count(),
      ]);

    return {
      items,

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(
          total / safeLimit,
        ),
      },
    };
  }

  async expirePaymentIntent(
    paymentIntentId: string,
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).paymentIntent.update({
      where: {
        id: paymentIntentId,
      },

      data: {
        status:
          PaymentStatus.EXPIRED,

        expiresAt:
          new Date(),
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Transaction
   * --------------------------------------------------------------------------
   */

  async createTransaction(
    data: {
      merchantId: string;
      terminalId?: string;
      customerId?: string;
      walletId?: string;
      amount: Prisma.Decimal;
      currency: any;
      paymentMethod: string;
      type: string;
      description?: string;
      paymentIntentId?: string;
      idempotencyKey?: string;
      metadata?: Prisma.JsonValue;
    },
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    /*
     * SmartPOS transaction creation is idempotent.
     *
     * This is important for:
     * - POS retries
     * - Flutterwave webhook retries
     * - frontend retry requests
     * - network timeouts after gateway acceptance
     */

    if (data.idempotencyKey) {
      const existing =
        await db.transaction.findUnique({
          where: {
            idempotencyKey:
              data.idempotencyKey,
          },
        });

      if (existing) {
        return existing;
      }
    }

    const reference =
      this.generateReference();

    return db.transaction.create({
      data: {
        merchantId:
          data.merchantId,

        terminalId:
          data.terminalId,

        customerId:
          data.customerId,

        walletId:
          data.walletId,

        amount:
          data.amount,

        currency:
          data.currency,

        paymentMethod:
          data.paymentMethod,

        type:
          data.type,

        description:
          data.description,

        metadata:
          this.normalizeOptionalJson(
            data.metadata,
          ),

        settlementStatus:
          SettlementStatus.PENDING,

        reference,

        idempotencyKey:
          data.idempotencyKey,

        status:
          TransactionStatus.INITIATED,

        paymentIntentId:
          data.paymentIntentId,
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Payment Attempts
   * --------------------------------------------------------------------------
   */

  async createPaymentAttempt(
    data: {
      paymentIntentId: string;
      transactionId?: string;
      amount: Prisma.Decimal;
      currency: any;
    },
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).paymentAttempt.create({
      data: {
        paymentIntentId:
          data.paymentIntentId,

        transactionId:
          data.transactionId,

        amount:
          data.amount,

        currency:
          data.currency,

        status:
          PaymentStatus.PENDING,
      },
    });
  }

  async completePaymentAttempt(
    paymentAttemptId: string,
    gatewayResponse: Prisma.JsonValue,
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).paymentAttempt.update({
      where: {
        id: paymentAttemptId,
      },

      data: {
        status:
          PaymentStatus.CAPTURED,

        gatewayResponse:
          this.normalizeOptionalJson(
            gatewayResponse,
          ),
      },
    });
  }

  async failPaymentAttempt(
    paymentAttemptId: string,
    errorMessage: string,
    gatewayResponse?: Prisma.JsonValue,
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).paymentAttempt.update({
      where: {
        id: paymentAttemptId,
      },

      data: {
        status:
          PaymentStatus.FAILED,

        errorMessage,

        gatewayResponse:
          this.normalizeOptionalJson(
            gatewayResponse,
          ),
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Authorization
   * --------------------------------------------------------------------------
   *
   * Provider-specific authorization data is deliberately stored here,
   * while the actual gateway call remains inside the provider implementation.
   *
   * This allows Flutterwave card authorization to feed the normal SmartPOS
   * authorization/capture lifecycle.
   */

  async authorizeTransaction(
    data: {
      transactionId: string;
      amount: Prisma.Decimal;
      currency: any;
      authorizationCode?: string;
      gatewayResponse?: Prisma.JsonValue;
      message?: string;
    },
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    return db.authorization.upsert({
      where: {
        transactionId:
          data.transactionId,
      },

      update: {
        authorizationCode:
          data.authorizationCode ??
          undefined,

        amount:
          data.amount,

        currency:
          data.currency,

        status:
          "approved",

        message:
          data.message,

        gatewayResponse:
          this.normalizeOptionalJson(
            data.gatewayResponse,
          ),
      },

      create: {
        transactionId:
          data.transactionId,

        authorizationCode:
          data.authorizationCode,

        amount:
          data.amount,

        currency:
          data.currency,

        status:
          "approved",

        message:
          data.message,

        gatewayResponse:
          this.normalizeOptionalJson(
            data.gatewayResponse,
          ),
      },
    });
  }

  async declineAuthorization(
    transactionId: string,
    message: string,
    gatewayResponse?: Prisma.JsonValue,
    tx?: PrismaTransactionClient,
  ) {
    return this.db(tx).authorization.create({
      data: {
        transactionId,

        amount:
          new Prisma.Decimal(0),

        currency:
          "USD",

        status:
          "declined",

        message,

        gatewayResponse:
          this.normalizeOptionalJson(
            gatewayResponse,
          ),
      },
    });
  }

  async listAuthorizationsForPaymentIntent(
    paymentIntentId: string,
    customerId?: string,
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    return db.authorization.findMany({
      where: {
        status: {
          in: [
            "approved",
            "authorized",
          ],
        },

        transaction: {
          paymentIntentId,

          ...(customerId
            ? {
                customerId,
              }
            : {}),
        },
      },

      include: {
        transaction: true,
      },

      orderBy: {
        authorizedAt: "desc",
      },
    });
  }

  async getAuthorizationForPaymentIntent(
    paymentIntentId: string,
    customerId: string | undefined,
    authorizationId?: string,
    authorizationCode?: string,
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    return db.authorization.findFirst({
      where: {
        ...(authorizationId
          ? {
              id: authorizationId,
            }
          : {}),

        ...(authorizationCode
          ? {
              authorizationCode,
            }
          : {}),

        transaction: {
          paymentIntentId,

          ...(customerId
            ? {
                customerId,
              }
            : {}),
        },
      },

      include: {
        transaction: true,
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Capture
   * --------------------------------------------------------------------------
   */

  async captureTransaction(
    data: {
      transactionId: string;
      amount: Prisma.Decimal;
      currency: any;
      gatewayResponse?: Prisma.JsonValue;
    },
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    return db.capture.create({
      data: {
        transactionId:
          data.transactionId,

        amount:
          data.amount,

        currency:
          data.currency,

        status:
          "completed",

        gatewayResponse:
          this.normalizeOptionalJson(
            data.gatewayResponse,
          ),
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Reversal
   * --------------------------------------------------------------------------
   */

  async reverseTransaction(
    data: {
      transactionId: string;
      amount: Prisma.Decimal;
      currency: any;
      reason?: string;
      gatewayResponse?: Prisma.JsonValue;
    },
    tx?: PrismaTransactionClient,
  ) {
    const db =
      this.db(tx);

    return db.reversal.create({
      data: {
        transactionId:
          data.transactionId,

        amount:
          data.amount,

        currency:
          data.currency,

        reason:
          data.reason,

        status:
          "completed",

        gatewayResponse:
          this.normalizeOptionalJson(
            data.gatewayResponse,
          ),
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Find Transaction
   * --------------------------------------------------------------------------
   */

  async findTransactionById(
    transactionId: string,
  ) {
    return this.app.prisma.transaction.findUnique({
      where: {
        id: transactionId,
      },

      include: {
        merchant: true,
        terminal: true,
        customer: true,
        paymentIntent: true,
        paymentAttempts: true,
      },
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Void Transaction
   * --------------------------------------------------------------------------
   */

  async voidTransaction(
    data: {
      transactionId: string;
      reason?: string;
    },
  ) {
    const transaction =
      await this.app.prisma.transaction.findUnique({
        where: {
          id: data.transactionId,
        },
      });

    if (!transaction) {
      throw new Error(
        "Transaction not found.",
      );
    }

    if (
      transaction.status ===
      TransactionStatus.SETTLED
    ) {
      throw new Error(
        "A settled transaction cannot be voided.",
      );
    }

    if (
      transaction.status ===
      TransactionStatus.VOIDED
    ) {
      return transaction;
    }

    const existingMetadata =
      transaction.metadata &&
      typeof transaction.metadata ===
        "object" &&
      !Array.isArray(
        transaction.metadata,
      )
        ? transaction.metadata
        : {};

    const updatedMetadata =
      this.normalizeJson({
        ...(existingMetadata as Prisma.JsonObject),

        voidReason:
          data.reason ??
          "Transaction voided",

        voidedAt:
          new Date().toISOString(),
      });

    return this.app.prisma.transaction.update({
      where: {
        id: data.transactionId,
      },

      data: {
        status:
          TransactionStatus.VOIDED,

        metadata:
          updatedMetadata,
      },
    });
  }
}
