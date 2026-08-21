import { CurrencyType, Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";
import QuidaxRampClient from "../providers/quidax/quidax-ramp.client.js";
import QuoteValidatorService from "./quote-validator.service.js";

export default class ExchangeService {
  private readonly quoteValidator: QuoteValidatorService;

  constructor(private readonly app: FastifyInstance) {
    this.quoteValidator = new QuoteValidatorService(app);
  }

  /*
  |--------------------------------------------------------------------------
  | JSON Helpers
  |--------------------------------------------------------------------------
  */

  /**
   * Prisma's JsonValue permits null, while many Prisma CREATE/UPDATE
   * inputs expect InputJsonValue or Prisma.JsonNull.
   *
   * This helper keeps JSON writes type-safe without changing the schema.
   */
  private toPrismaJson(
    value?: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  /**
   * Convert an arbitrary value into a JSON object suitable for Prisma
   * metadata fields.
   */
  private toMetadataObject(
    value?: Prisma.JsonValue | null,
  ): Record<string, Prisma.JsonValue> {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return value as Record<string, Prisma.JsonValue>;
    }

    return {};
  }

  /**
   * CurrencyType is a Prisma enum. Runtime callers may supply strings,
   * so normalize them once at the persistence boundary.
   */
  private toCurrencyType(value: string): CurrencyType {
    return value.toUpperCase() as CurrencyType;
  }

  /*
  |--------------------------------------------------------------------------
  | Quidax On-Ramp
  |--------------------------------------------------------------------------
  */

  async initiateQuidaxOnRamp(request: {
    fromCurrency: string;
    toCurrency: string;
    fromAmount: Prisma.Decimal;
    merchantReference: string;
    customer: {
      email: string;
      firstName: string;
      lastName: string;
      phoneNumber?: string;
    };
    walletAddress: {
      address: string;
      network: string;
    };
  }) {
    const configuration =
      await import("../config/env.js").then(
        (module) => module.default,
      );

    if (
      !configuration.QUIDAX_RAMP_BASE_URL ||
      !configuration.QUIDAX_PRIVATE_KEY
    ) {
      throw new Error(
        "Quidax Ramp is not configured. Set QUIDAX_RAMP_BASE_URL and QUIDAX_PRIVATE_KEY.",
      );
    }

    const client = new QuidaxRampClient(
      configuration.QUIDAX_RAMP_BASE_URL,
      configuration.QUIDAX_PRIVATE_KEY,
      configuration.QUIDAX_TIMEOUT_MS,
    );

    return client.initiateOnRamp({
      fromCurrency:
        request.fromCurrency.toLowerCase() as "ngn" | "ghs",

      toCurrency:
        request.toCurrency.toLowerCase() as
          | "usdt"
          | "usdc"
          | "cngn",

      fromAmount: request.fromAmount.toString(),

      merchantReference:
        request.merchantReference,

      customer: {
        email: request.customer.email,
        first_name: request.customer.firstName,
        last_name: request.customer.lastName,
        ...(request.customer.phoneNumber
          ? {
              phone_number:
                request.customer.phoneNumber,
            }
          : {}),
      },

      walletAddress: {
        address: request.walletAddress.address,
        network: request.walletAddress.network,
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Exchange Rate
  |--------------------------------------------------------------------------
  */

  async latestRate(
    fromCurrency: any,
    toCurrency: any,
  ) {
    return this.app.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
      },
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async createExchangeRate(data: {
    fromCurrency: any;
    toCurrency: any;
    rate: Prisma.Decimal;
    source: string;
    expiresAt?: Date;
    metadata?: Prisma.JsonValue;
  }) {
    return this.app.prisma.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        rate: data.rate,
        source: data.source,
        expiresAt: data.expiresAt,
        metadata: this.toPrismaJson(data.metadata),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Quote
  |--------------------------------------------------------------------------
  */

  async calculateQuote(
    fromCurrency: any,
    toCurrency: any,
    amount: Prisma.Decimal,
  ) {
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        rate: new Prisma.Decimal(1),
        amount,
        convertedAmount: amount,
        expiresAt: null,
      };
    }

    const rate =
      await this.latestRate(
        fromCurrency,
        toCurrency,
      );

    if (!rate) {
      throw new Error(
        `Exchange rate unavailable for ${fromCurrency}/${toCurrency}. ` +
        `Please configure a real exchange provider or request an updated rate.`,
      );
    }

    const convertedAmount =
      amount.mul(rate.rate);

    return {
      fromCurrency,
      toCurrency,
      rate: rate.rate,
      amount,
      convertedAmount,
      expiresAt: rate.expiresAt,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Conversion
  |--------------------------------------------------------------------------
  */

  async createConversion(data: {
    merchantId: string;
    transactionId?: string;
    fromCurrency: any;
    toCurrency: any;
    fromAmount: Prisma.Decimal;
    fee?: Prisma.Decimal;
    exchangeProvider?: string;
    metadata?: Prisma.JsonValue;
  }) {
    const quote =
      await this.calculateQuote(
        data.fromCurrency,
        data.toCurrency,
        data.fromAmount,
      );

    const fee =
      data.fee ??
      new Prisma.Decimal(0);

    const finalAmount =
      quote.convertedAmount.sub(fee);

    return this.app.prisma.cryptoConversion.create({
      data: {
        merchantId: data.merchantId,
        transactionId: data.transactionId,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        fromAmount: data.fromAmount,
        toAmount: finalAmount,
        rate: quote.rate,
        fee,
        exchangeProvider:
          data.exchangeProvider,
        metadata: this.toPrismaJson(data.metadata),
        status: "pending",
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Crypto Quote
  |--------------------------------------------------------------------------
  */

  /**
   * Persist a live crypto quote using the latest stored exchange rate.
   *
   * ttlSeconds controls quote validity; default is 30 seconds.
   */
  async createQuote(data: {
    fromCurrency: any;
    toCurrency: any;
    amount: Prisma.Decimal;
    provider?: string;
    ttlSeconds?: number;
    metadata?: Prisma.JsonValue;
  }) {
    const ttl = data.ttlSeconds ?? 30;

    const rate =
      await this.latestRate(
        data.fromCurrency,
        data.toCurrency,
      );

    if (!rate) {
      throw new Error(
        `Exchange rate unavailable for ${data.fromCurrency}/${data.toCurrency}. ` +
        `Please configure a real exchange provider or request an updated rate.`,
      );
    }

    const quoteAmount =
      data.amount.mul(rate.rate);

    const expiresAt =
      new Date(Date.now() + ttl * 1000);

    return this.app.prisma.cryptoQuote.create({
      data: {
        fromCurrency:
          this.toCurrencyType(
            String(data.fromCurrency),
          ),

        toCurrency:
          this.toCurrencyType(
            String(data.toCurrency),
          ),

        amount: data.amount,

        quoteAmount,

        rate: rate.rate,

        expiresAt,

        provider:
          data.provider ?? "",

        metadata:
          this.toPrismaJson(data.metadata),
      },
    });
  }

  async completeConversion(
    conversionId: string,
  ) {
    return this.app.prisma.cryptoConversion.update({
      where: {
        id: conversionId,
      },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  async failConversion(
    conversionId: string,
  ) {
    return this.app.prisma.cryptoConversion.update({
      where: {
        id: conversionId,
      },
      data: {
        status: "failed",
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Lookup
  |--------------------------------------------------------------------------
  */

  async findConversion(
    id: string,
  ) {
    return this.app.prisma.cryptoConversion.findUnique({
      where: {
        id,
      },
      include: {
        merchant: true,
        transaction: true,
        walletTransfer: true,
      },
    });
  }

  async merchantConversions(
    merchantId: string,
  ) {
    return this.app.prisma.cryptoConversion.findMany({
      where: {
        merchantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Real Exchange Provider Integration
  |--------------------------------------------------------------------------
  */

  /**
   * Get a real Quidax exchange provider instance.
   */
  async getExchangeProvider() {
    const configuration =
      await import("../config/env.js").then(
        (module) => module.default,
      );

    if (
      !configuration.QUIDAX_API_KEY ||
      !configuration.QUIDAX_BASE_URL
    ) {
      throw new Error(
        "Quidax is not configured. Set QUIDAX_API_KEY and QUIDAX_BASE_URL on the backend.",
      );
    }

    const {
      QuidaxProviderAdapter,
    } = await import(
      "../providers/quidax/quidax.provider.js"
    );

    return new QuidaxProviderAdapter({
      apiKey:
        configuration.QUIDAX_API_KEY,

      baseUrl:
        configuration.QUIDAX_BASE_URL,

      timeoutMs:
        configuration.QUIDAX_TIMEOUT_MS,
    });
  }

  async getProviderAssets() {
    const provider =
      await this.getExchangeProvider();

    if (!("getAssets" in provider)) {
      throw new Error(
        "Quidax asset lookup is unavailable.",
      );
    }

    return provider.getAssets();
  }

  async getProviderMarkets() {
    const provider =
      await this.getExchangeProvider();

    if (!("getMarkets" in provider)) {
      throw new Error(
        "Quidax market lookup is unavailable.",
      );
    }

    return provider.getMarkets();
  }

  async getProviderBalances() {
    const provider =
      await this.getExchangeProvider();

    if (!("getBalances" in provider)) {
      throw new Error(
        "Quidax balance lookup is unavailable.",
      );
    }

    return provider.getBalances();
  }

  /*
  |--------------------------------------------------------------------------
  | Real Quote
  |--------------------------------------------------------------------------
  */

  /**
   * Get a live quote from Quidax and persist it as ExchangeQuote.
   */
  async getRealQuote(request: {
    baseAsset: string;
    quoteAsset: string;
    side: "BUY" | "SELL";
    amount: Prisma.Decimal;
    ttlSeconds?: number;
  }) {
    try {
      const provider =
        await this.getExchangeProvider();

      const providerQuote =
        await provider.getQuote({
          baseAsset:
            request.baseAsset,

          quoteAsset:
            request.quoteAsset,

          side:
            request.side,

          amount:
            request.amount,
        });

      const exchangeProvider =
        await this.getOrCreateProviderRecord(
          provider.constructor.name,
        );

      const quote =
        await this.app.prisma.exchangeQuote.create({
          data: {
            exchangeProviderId:
              exchangeProvider.id,

            fromCurrency:
              this.toCurrencyType(
                request.side === "BUY"
                  ? request.quoteAsset
                  : request.baseAsset,
              ),

            toCurrency:
              this.toCurrencyType(
                request.side === "BUY"
                  ? request.baseAsset
                  : request.quoteAsset,
              ),

            fromAmount:
              request.side === "BUY"
                ? request.amount
                : providerQuote.inputAmount,

            toAmount:
              request.side === "BUY"
                ? providerQuote.outputAmount
                : request.amount,

            rate:
              providerQuote.price,

            expiresAt:
              providerQuote.expiresAt,

            metadata:
              this.toPrismaJson({
                providerQuote,
                quoteId:
                  providerQuote.quoteId,
                feePercentage:
                  providerQuote.feePercentage.toString(),
              } as unknown as Prisma.JsonValue),
          },
        });

      return quote;
    } catch (error) {
      this.app.log.error(
        { error },
        "Failed to get real exchange quote",
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | BUY Order
  |--------------------------------------------------------------------------
  */

  /**
   * Execute a real BUY order on Quidax.
   *
   * Features:
   * - Quote validation when quoteId is supplied.
   * - Idempotency through clientOrderId.
   * - Provider order persistence.
   * - Trade/fill persistence.
   */
  async executeBuyOrder(request: {
    baseAsset: string;
    quoteAsset: string;
    amount: Prisma.Decimal;
    merchantId?: string;
    quoteId?: string;
    clientOrderId?: string;
    limitPrice?: Prisma.Decimal;
  }) {
    try {
      /*
       * Idempotency
       */
      if (request.clientOrderId) {
        const existingOrder =
          await this.quoteValidator
            .getOrderByClientOrderId(
              request.clientOrderId,
            );

        if (existingOrder) {
          this.app.log.info(
            {
              clientOrderId:
                request.clientOrderId,
            },
            "Idempotent order retrieval: returning existing order",
          );

          return existingOrder;
        }
      }

      /*
       * Quote validation
       */
      if (request.quoteId) {
        const quote =
          await this.app.prisma.exchangeQuote.findUnique({
            where: {
              id: request.quoteId,
            },
          });

        if (!quote) {
          throw new Error(
            `Quote not found: ${request.quoteId}`,
          );
        }

        /*
         * QuoteValidatorService operates on the CryptoQuote-style
         * representation (amount / quoteAmount / provider), while
         * ExchangeQuote stores fromAmount / toAmount.
         *
         * Adapt the persisted ExchangeQuote without changing either
         * database model.
         */
        const validatorQuote = {
          id: quote.id,

          metadata:
            quote.metadata,

          createdAt:
            quote.createdAt,

          updatedAt:
            quote.updatedAt,

          fromCurrency:
            quote.fromCurrency,

          toCurrency:
            quote.toCurrency,

          rate:
            quote.rate,

          expiresAt:
            quote.expiresAt,

          amount:
            quote.fromAmount,

          quoteAmount:
            quote.toAmount,

          provider:
            "QUIDAX",
        };

        const validation =
          await this.quoteValidator.validateQuote(
            validatorQuote,
            {
              baseAsset:
                request.baseAsset,

              quoteAsset:
                request.quoteAsset,

              requestedAmount:
                request.amount,

              allowedVariancePercent:
                2,
            },
          );

        if (!validation.valid) {
          throw new Error(
            `Quote validation failed: ${validation.error}`,
          );
        }

        /*
         * Mark quote as used.
         */
        const quoteMetadata =
          this.toMetadataObject(
            quote.metadata,
          );

        await this.app.prisma.exchangeQuote.update({
          where: {
            id: request.quoteId,
          },

          data: {
            metadata:
              this.toPrismaJson({
                ...quoteMetadata,

                usedAt:
                  new Date().toISOString(),
              }),
          },
        });
      }

      /*
       * Execute provider order
       */
      const provider =
        await this.getExchangeProvider();

      const order =
        await provider.buy({
          baseAsset:
            request.baseAsset,

          quoteAsset:
            request.quoteAsset,

          side:
            "BUY",

          amount:
            request.amount,

          quoteId:
            request.quoteId,

          clientOrderId:
            request.clientOrderId,

          limitPrice:
            request.limitPrice,
        });

      /*
       * Persist provider
       */
      const providerRecord =
        await this.getOrCreateProviderRecord(
          provider.constructor.name,
        );

      /*
       * Persist exchange order
       */
      const dbOrder =
        await this.app.prisma.exchangeOrder.create({
          data: {
            exchangeProviderId:
              providerRecord.id,

            merchantId:
              request.merchantId,

            orderId:
              order.orderId,

            symbol:
              order.symbol,

            side:
              "BUY",

            type:
              request.limitPrice
                ? "LIMIT"
                : "MARKET",

            price:
              order.averagePrice,

            amount:
              order.requestedAmount,

            filledAmount:
              order.executedAmount,

            avgPrice:
              order.averagePrice,

            status:
              order.status,

            metadata:
              this.toPrismaJson({
                order,

                clientOrderId:
                  request.clientOrderId,

                quoteId:
                  request.quoteId,
              } as unknown as Prisma.JsonValue),
          },
        });

      /*
       * Persist trade/fill
       */
      if (
        order.executedAmount.gt(
          new Prisma.Decimal("0"),
        )
      ) {
        await this.app.prisma.exchangeTrade.create({
          data: {
            orderId:
              dbOrder.id,

            tradeId:
              order.orderId,

            price:
              order.averagePrice,

            amount:
              order.executedAmount,

            total:
              order.executedAmount.mul(
                order.averagePrice,
              ),

            fee:
              order.totalFee,

            feeCurrency:
              "USD" as any,

            metadata:
              this.toPrismaJson(
                order.metadata as unknown as Prisma.JsonValue,
              ),
          },
        });
      }

      return dbOrder;
    } catch (error) {
      this.app.log.error(
        {
          error,
          request,
        },
        "Failed to execute buy order",
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SELL Order
  |--------------------------------------------------------------------------
  */

  /**
   * Execute a real SELL order on Quidax.
   */
  async executeSellOrder(request: {
    baseAsset: string;
    quoteAsset: string;
    amount: Prisma.Decimal;
    merchantId?: string;
    quoteId?: string;
    clientOrderId?: string;
    limitPrice?: Prisma.Decimal;
  }) {
    try {
      /*
       * Idempotency
       */
      if (request.clientOrderId) {
        const existingOrder =
          await this.quoteValidator
            .getOrderByClientOrderId(
              request.clientOrderId,
            );

        if (existingOrder) {
          this.app.log.info(
            {
              clientOrderId:
                request.clientOrderId,
            },
            "Idempotent order retrieval: returning existing order",
          );

          return existingOrder;
        }
      }

      /*
       * Quote validation
       */
      if (request.quoteId) {
        const quote =
          await this.app.prisma.exchangeQuote.findUnique({
            where: {
              id: request.quoteId,
            },
          });

        if (!quote) {
          throw new Error(
            `Quote not found: ${request.quoteId}`,
          );
        }

        const validatorQuote = {
          id: quote.id,

          metadata:
            quote.metadata,

          createdAt:
            quote.createdAt,

          updatedAt:
            quote.updatedAt,

          fromCurrency:
            quote.fromCurrency,

          toCurrency:
            quote.toCurrency,

          rate:
            quote.rate,

          expiresAt:
            quote.expiresAt,

          amount:
            quote.fromAmount,

          quoteAmount:
            quote.toAmount,

          provider:
            "QUIDAX",
        };

        const validation =
          await this.quoteValidator.validateQuote(
            validatorQuote,
            {
              baseAsset:
                request.baseAsset,

              quoteAsset:
                request.quoteAsset,

              requestedAmount:
                request.amount,

              allowedVariancePercent:
                2,
            },
          );

        if (!validation.valid) {
          throw new Error(
            `Quote validation failed: ${validation.error}`,
          );
        }

        /*
         * Mark quote as used.
         */
        const quoteMetadata =
          this.toMetadataObject(
            quote.metadata,
          );

        await this.app.prisma.exchangeQuote.update({
          where: {
            id: request.quoteId,
          },

          data: {
            metadata:
              this.toPrismaJson({
                ...quoteMetadata,

                usedAt:
                  new Date().toISOString(),
              }),
          },
        });
      }

      /*
       * Execute provider order
       */
      const provider =
        await this.getExchangeProvider();

      const order =
        await provider.sell({
          baseAsset:
            request.baseAsset,

          quoteAsset:
            request.quoteAsset,

          side:
            "SELL",

          amount:
            request.amount,

          quoteId:
            request.quoteId,

          clientOrderId:
            request.clientOrderId,

          limitPrice:
            request.limitPrice,
        });

      /*
       * Persist provider
       */
      const providerRecord =
        await this.getOrCreateProviderRecord(
          provider.constructor.name,
        );

      /*
       * Persist exchange order
       */
      const dbOrder =
        await this.app.prisma.exchangeOrder.create({
          data: {
            exchangeProviderId:
              providerRecord.id,

            merchantId:
              request.merchantId,

            orderId:
              order.orderId,

            symbol:
              order.symbol,

            side:
              "SELL",

            type:
              request.limitPrice
                ? "LIMIT"
                : "MARKET",

            price:
              order.averagePrice,

            amount:
              order.requestedAmount,

            filledAmount:
              order.executedAmount,

            avgPrice:
              order.averagePrice,

            status:
              order.status,

            metadata:
              this.toPrismaJson({
                order,

                clientOrderId:
                  request.clientOrderId,

                quoteId:
                  request.quoteId,
              } as unknown as Prisma.JsonValue),
          },
        });

      /*
       * Persist trade/fill
       */
      if (
        order.executedAmount.gt(
          new Prisma.Decimal("0"),
        )
      ) {
        await this.app.prisma.exchangeTrade.create({
          data: {
            orderId:
              dbOrder.id,

            tradeId:
              order.orderId,

            price:
              order.averagePrice,

            amount:
              order.executedAmount,

            total:
              order.executedAmount.mul(
                order.averagePrice,
              ),

            fee:
              order.totalFee,

            feeCurrency:
              "USD" as any,

            metadata:
              this.toPrismaJson(
                order.metadata as unknown as Prisma.JsonValue,
              ),
          },
        });
      }

      return dbOrder;
    } catch (error) {
      this.app.log.error(
        {
          error,
          request,
        },
        "Failed to execute sell order",
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Order Status
  |--------------------------------------------------------------------------
  */

  /**
   * Get order status from Quidax.
   */
  async getOrderStatus(
    orderId: string,
    merchantId?: string,
  ) {
    try {
      /*
       * Verify merchant ownership when merchantId is supplied.
       */
      if (merchantId) {
        const ownedOrder =
          await this.app.prisma.exchangeOrder.findFirst({
            where: {
              orderId,
              merchantId,
            },

            select: {
              id: true,
            },
          });

        if (!ownedOrder) {
          throw new Error(
            "Exchange order not found.",
          );
        }
      }

      const provider =
        await this.getExchangeProvider();

      const order =
        await provider.getOrder(orderId);

      /*
       * orderId is NOT a Prisma unique field in the
       * current schema, so findFirst must be used here.
       */
      const dbOrder =
        await this.app.prisma.exchangeOrder.findFirst({
          where: {
            orderId,
          },
        });

      if (dbOrder) {
        const existingMetadata =
          this.toMetadataObject(
            dbOrder.metadata,
          );

        await this.app.prisma.exchangeOrder.update({
          where: {
            id: dbOrder.id,
          },

          data: {
            status:
              order.status,

            filledAmount:
              order.executedAmount,

            avgPrice:
              order.averagePrice,

            metadata:
  this.toPrismaJson({
    ...existingMetadata,

    lastStatusUpdate:
      new Date().toISOString(),

    order:
      JSON.parse(
        JSON.stringify(order),
      ),
  }),
          },
        });
      }

      return order;
    } catch (error) {
      this.app.log.error(
        {
          error,
          orderId,
        },
        "Failed to get order status",
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Provider Balance
  |--------------------------------------------------------------------------
  */

  /**
   * Get provider account balance for an asset.
   */
  async getProviderBalance(
    asset: string,
  ) {
    try {
      const provider =
        await this.getExchangeProvider();

      return provider.getBalance(asset);
    } catch (error) {
      this.app.log.error(
        {
          error,
          asset,
        },
        "Failed to get provider balance",
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Merchant Orders
  |--------------------------------------------------------------------------
  */

  async listMerchantOrders(
    merchantId: string,
    page = 1,
    limit = 10,
  ) {
    const skip =
      Math.max(0, page - 1) *
      limit;

    const [
      items,
      total,
    ] = await Promise.all([
      this.app.prisma.exchangeOrder.findMany({
        where: {
          merchantId,
        },

        include: {
          exchangeProvider: true,
          trades: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: limit,
      }),

      this.app.prisma.exchangeOrder.count({
        where: {
          merchantId,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages:
        Math.ceil(total / limit),
    };
  }

  async getMerchantOrderDetails(
    merchantId: string,
    orderId: string,
  ) {
    const order =
      await this.app.prisma.exchangeOrder.findFirst({
        where: {
          merchantId,

          OR: [
            {
              id: orderId,
            },
            {
              orderId,
            },
          ],
        },

        include: {
          exchangeProvider: true,
          trades: true,
        },
      });

    if (!order) {
      return null;
    }

    const conversion =
      await this.app.prisma.cryptoConversion.findFirst({
        where: {
          exchangeOrderId:
            order.id,
        },

        include: {
          transaction: {
            include: {
              blockchainTransaction:
                true,

              wallet:
                true,
            },
          },
        },
      });

    return {
      order,
      conversion,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Provider Record
  |--------------------------------------------------------------------------
  */

  /**
   * Get or create the ExchangeProvider database record.
   */
  private async getOrCreateProviderRecord(
    providerName: string,
  ) {
    let provider =
      await this.app.prisma.exchangeProvider.findUnique({
        where: {
          name: providerName,
        },
      });

    if (!provider) {
      provider =
        await this.app.prisma.exchangeProvider.create({
          data: {
            name:
              providerName,

            isActive:
              true,
          },
        });
    }

    return provider;
  }
}