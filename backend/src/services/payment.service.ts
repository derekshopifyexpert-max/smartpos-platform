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

type PrismaMetadataInput =
  Prisma.InputJsonValue |
  Prisma.JsonNullValueInput;

export default class PaymentService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Database Client
  |--------------------------------------------------------------------------
  */

  private db(
    tx?: PrismaTransactionClient
  ) {
    return tx ?? this.app.prisma;
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
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

  /*
  |--------------------------------------------------------------------------
  | JSON / Metadata Helpers
  |--------------------------------------------------------------------------
  |
  | Prisma has separate types for JSON values read from the database and
  | JSON values being written to the database.
  |
  | JsonValue:
  |   Used primarily for values returned from Prisma.
  |
  | InputJsonValue:
  |   Used for values being sent into Prisma create/update operations.
  |
  | JsonNull:
  |   Used when the JSON column itself should contain JSON null.
  |
  |--------------------------------------------------------------------------
  */

  private normalizeMetadata(
    metadata?: Prisma.JsonValue
  ): PrismaMetadataInput {
    if (
      metadata === undefined ||
      metadata === null
    ) {
      return Prisma.JsonNull;
    }

    if (Array.isArray(metadata)) {
      return metadata.map((value) =>
        this.normalizeJsonValue(value)
      ) as Prisma.InputJsonArray;
    }

    if (typeof metadata !== "object") {
      return metadata as Prisma.InputJsonValue;
    }

    const source =
      metadata as Prisma.JsonObject;

    const normalized: Prisma.InputJsonObject =
      {};

    for (const [key, value] of Object.entries(
      source
    )) {
      normalized[key] =
        this.normalizeJsonValue(value);
    }

    /*
    |--------------------------------------------------------------------------
    | Normalize crypto destination aliases
    |--------------------------------------------------------------------------
    */

    const destinationCandidates = [
      "cryptoDestination",
      "crypto_destination",
      "destination",
    ];

    for (const key of destinationCandidates) {
      const candidate =
        normalized[key];

      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        const existing =
          normalized.cryptoDestination;

        normalized.cryptoDestination = {
          ...(
            existing &&
            typeof existing === "object" &&
            !Array.isArray(existing)
              ? (existing as Prisma.InputJsonObject)
              : {}
          ),

          ...(candidate as Prisma.InputJsonObject),
        };
      }
    }

    return normalized;
  }

  private normalizeJsonValue(
    value: Prisma.JsonValue
  ): Prisma.InputJsonValue {
    if (value === null) {
      return Prisma.JsonNull;
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.normalizeJsonValue(item)
      ) as Prisma.InputJsonArray;
    }

    if (typeof value === "object") {
      const result: Prisma.InputJsonObject =
        {};

      for (const [key, nestedValue] of Object.entries(
        value as Prisma.JsonObject
      )) {
        result[key] =
          this.normalizeJsonValue(
            nestedValue
          );
      }

      return result;
    }

    return value;
  }

  /*
  |--------------------------------------------------------------------------
  | Payment Intent
  |--------------------------------------------------------------------------
  */

  async createPaymentIntent(
    data: {
      merchantId: string;
      customerId?: string;
      paymentMethodId?: string;
      amount: Prisma.Decimal;
      currency: any;
      description?: string;
      metadata?: Prisma.JsonValue;
      expiresAt?: Date;
    },
    tx?: PrismaTransactionClient
  ) {
    const metadata =
      this.normalizeMetadata(
        data.metadata
      );

    return this.db(tx).paymentIntent.create({
      data: {
        merchantId:
          data.merchantId,

        customerId:
          data.customerId,

        paymentMethodId:
          data.paymentMethodId,

        amount:
          data.amount,

        currency:
          data.currency,

        description:
          data.description,

        metadata,

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
    paymentIntentId: string
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
    limit = 10
  ) {
    const skip =
      (page - 1) * limit;

    const [items, total] =
      await this.app.prisma.$transaction([
        this.app.prisma.paymentIntent.findMany({
          skip,
          take: limit,

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
        page,
        limit,
        total,
        pages: Math.ceil(
          total / limit
        ),
      },
    };
  }

  async listTransactions(
    page = 1,
    limit = 10
  ) {
    const skip =
      (page - 1) * limit;

    const [items, total] =
      await this.app.prisma.$transaction([
        this.app.prisma.transaction.findMany({
          skip,
          take: limit,

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
        page,
        limit,
        total,
        pages: Math.ceil(
          total / limit
        ),
      },
    };
  }

  async expirePaymentIntent(
    paymentIntentId: string,
    tx?: PrismaTransactionClient
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
  |--------------------------------------------------------------------------
  | Transaction
  |--------------------------------------------------------------------------
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
    tx?: PrismaTransactionClient
  ) {
    const db =
      this.db(tx);

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    if (data.idempotencyKey) {
      const existingTransaction =
        await db.transaction.findUnique({
          where: {
            idempotencyKey:
              data.idempotencyKey,
          },
        });

      if (existingTransaction) {
        return existingTransaction;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Create Transaction
    |--------------------------------------------------------------------------
    */

    const reference =
      this.generateReference();

    const metadata =
      this.normalizeMetadata(
        data.metadata
      );

    const transaction =
      await db.transaction.create({
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

          metadata,

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

    return transaction;
  }

  /*
  |--------------------------------------------------------------------------
  | Payment Attempts
  |--------------------------------------------------------------------------
  */

  async createPaymentAttempt(
    data: {
      paymentIntentId: string;
      transactionId?: string;
      amount: Prisma.Decimal;
      currency: any;
    },
    tx?: PrismaTransactionClient
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
    tx?: PrismaTransactionClient
  ) {
    return this.db(tx).paymentAttempt.update({
      where: {
        id: paymentAttemptId,
      },

      data: {
        status:
          PaymentStatus.CAPTURED,

        gatewayResponse:
          this.normalizeMetadata(
            gatewayResponse
          ),
      },
    });
  }

  async failPaymentAttempt(
    paymentAttemptId: string,
    errorMessage: string,
    gatewayResponse?: Prisma.JsonValue,
    tx?: PrismaTransactionClient
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
          this.normalizeMetadata(
            gatewayResponse
          ),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Authorization
  |--------------------------------------------------------------------------
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
    tx?: PrismaTransactionClient
  ) {
    const db =
      this.db(tx);

    const authorization =
      await db.authorization.upsert({
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
            this.normalizeMetadata(
              data.gatewayResponse
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
            this.normalizeMetadata(
              data.gatewayResponse
            ),
        },
      });

    return authorization;
  }

  async declineAuthorization(
    transactionId: string,
    message: string,
    gatewayResponse?: Prisma.JsonValue,
    tx?: PrismaTransactionClient
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
          this.normalizeMetadata(
            gatewayResponse
          ),
      },
    });
  }

  async listAuthorizationsForPaymentIntent(
    paymentIntentId: string,
    customerId?: string,
    tx?: PrismaTransactionClient
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
    tx?: PrismaTransactionClient
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
  |--------------------------------------------------------------------------
  | Capture
  |--------------------------------------------------------------------------
  */

  async captureTransaction(
    data: {
      transactionId: string;
      amount: Prisma.Decimal;
      currency: any;
      gatewayResponse?: Prisma.JsonValue;
    },
    tx?: PrismaTransactionClient
  ) {
    const db =
      this.db(tx);

    const capture =
      await db.capture.create({
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
            this.normalizeMetadata(
              data.gatewayResponse
            ),
        },
      });

    return capture;
  }

  /*
  |--------------------------------------------------------------------------
  | Reversal
  |--------------------------------------------------------------------------
  */

  async reverseTransaction(
    data: {
      transactionId: string;
      amount: Prisma.Decimal;
      currency: any;
      reason?: string;
      gatewayResponse?: Prisma.JsonValue;
    },
    tx?: PrismaTransactionClient
  ) {
    const db =
      this.db(tx);

    const reversal =
      await db.reversal.create({
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
            this.normalizeMetadata(
              data.gatewayResponse
            ),
        },
      });

    return reversal;
  }

  /*
  |--------------------------------------------------------------------------
  | Find Transaction
  |--------------------------------------------------------------------------
  */

  async findTransactionById(
    transactionId: string
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
  |--------------------------------------------------------------------------
  | Void Transaction
  |--------------------------------------------------------------------------
  */

  async voidTransaction(
    data: {
      transactionId: string;
      reason?: string;
    }
  ) {
    const transaction =
      await this.app.prisma.transaction.findUnique({
        where: {
          id: data.transactionId,
        },
      });

    if (!transaction) {
      throw new Error(
        "Transaction not found."
      );
    }

    if (
      transaction.status ===
      TransactionStatus.SETTLED
    ) {
      throw new Error(
        "A settled transaction cannot be voided."
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
        transaction.metadata
      )
        ? transaction.metadata
        : {};

    const updatedMetadata: Prisma.InputJsonObject =
      {
        ...(existingMetadata as Prisma.InputJsonObject),

        voidReason:
          data.reason ??
          "Transaction voided",

        voidedAt:
          new Date().toISOString(),
      };

    return this.app.prisma.transaction.update({
      where: {
        id: data.transactionId,
      },

      data: {
        metadata:
          updatedMetadata,
      },
    });
  }
}