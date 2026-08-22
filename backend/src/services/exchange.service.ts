import { CurrencyType, Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";

import QuoteValidatorService from "./quote-validator.service.js";

type OrderRequest = {
  baseAsset: string;
  quoteAsset: string;
  amount: Prisma.Decimal;
  merchantId?: string;
  quoteId?: string;
  clientOrderId?: string;
  limitPrice?: Prisma.Decimal;
};

type RealQuoteRequest = {
  baseAsset: string;
  quoteAsset: string;
  side: "BUY" | "SELL";
  amount: Prisma.Decimal;
  ttlSeconds?: number;
  network?: string;
};

export default class ExchangeService {
  private readonly quoteValidator: QuoteValidatorService;

  constructor(private readonly app: FastifyInstance) {
    this.quoteValidator = new QuoteValidatorService(app);
  }

  private toPrismaJson(
    value?: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    return value == null
      ? Prisma.JsonNull
      : (value as Prisma.InputJsonValue);
  }

  private toMetadataObject(
    value?: Prisma.JsonValue | null,
  ): Record<string, Prisma.JsonValue> {
    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }

  private toCurrencyType(value: string): CurrencyType {
    return value.toUpperCase() as CurrencyType;
  }

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
    const config = await import("../config/env.js").then(
      (m) => m.default,
    );

    if (
    ) {
      throw new Error(
      );
    }

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

        ...(request.customer.phoneNumber && {
          phone_number:
            request.customer.phoneNumber,
        }),
      },

      walletAddress:
        request.walletAddress,
    });
  }

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
        ...data,
        metadata:
          this.toPrismaJson(data.metadata),
      },
    });
  }

  async calculateQuote(
    fromCurrency: any,
    toCurrency: any,
    amount: Prisma.Decimal,
  ) {
    if (
      String(fromCurrency).toUpperCase() ===
      String(toCurrency).toUpperCase()
    ) {
      return {
        fromCurrency,
        toCurrency,
        rate: new Prisma.Decimal(1),
        amount,
        convertedAmount: amount,
        expiresAt: null,
      };
    }

    const rate = await this.latestRate(
      fromCurrency,
      toCurrency,
    );

    if (!rate) {
      throw new Error(
        `Exchange rate unavailable for ${fromCurrency}/${toCurrency}.`,
      );
    }

    return {
      fromCurrency,
      toCurrency,
      rate: rate.rate,
      amount,
      convertedAmount:
        amount.mul(rate.rate),
      expiresAt: rate.expiresAt,
    };
  }

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

    return this.app.prisma.cryptoConversion.create({
      data: {
        merchantId:
          data.merchantId,

        transactionId:
          data.transactionId,

        fromCurrency:
          data.fromCurrency,

        toCurrency:
          data.toCurrency,

        fromAmount:
          data.fromAmount,

        toAmount:
          quote.convertedAmount.sub(fee),

        rate:
          quote.rate,

        fee,

        exchangeProvider:
          data.exchangeProvider,

        metadata:
          this.toPrismaJson(
            data.metadata,
          ),

        status: "pending",
      },
    });
  }

  async createQuote(data: {
    fromCurrency: any;
    toCurrency: any;
    amount: Prisma.Decimal;
    provider?: string;
    ttlSeconds?: number;
    metadata?: Prisma.JsonValue;
  }) {
    const rate =
      await this.latestRate(
        data.fromCurrency,
        data.toCurrency,
      );

    if (!rate) {
      throw new Error(
        `Exchange rate unavailable for ${data.fromCurrency}/${data.toCurrency}.`,
      );
    }

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

        amount:
          data.amount,

        quoteAmount:
          data.amount.mul(rate.rate),

        rate:
          rate.rate,

        expiresAt:
          new Date(
            Date.now() +
              (data.ttlSeconds ?? 30) *
                1000,
          ),

        provider:
          data.provider ?? "",

        metadata:
          this.toPrismaJson(
            data.metadata,
          ),
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

  async findConversion(id: string) {
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

  async getExchangeProvider() {
    const config =
      await import("../config/env.js").then(
        (m) => m.default,
      );

    if (
    ) {
      throw new Error(
      );
    }

    const {
    } = await import(
    );

      apiKey:

      baseUrl:

      timeoutMs:

      rampBaseUrl:

      rampPrivateKey:
    });
  }

  async getProviderAssets() {
    const provider =
      await this.getExchangeProvider();

    if (!("getAssets" in provider)) {
      throw new Error(
      );
    }

    return provider.getAssets();
  }

  async getProviderMarkets() {
    const provider =
      await this.getExchangeProvider();

    if (!("getMarkets" in provider)) {
      throw new Error(
      );
    }

    return provider.getMarkets();
  }

  async getProviderBalances() {
    const provider =
      await this.getExchangeProvider();

    if (!("getBalances" in provider)) {
      throw new Error(
      );
    }

    return provider.getBalances();
  }

  /**
   * Get a live provider-backed quote.
   *
   *
   *   Fiat: NGN, GHS
   *   Tokens: USDT, USDC, XAUT, USAT
   *
   * The Ramp API also requires token_network.
   *
   * IMPORTANT:
   * USD is intentionally NOT converted to NGN or GHS here.
   * Doing so would silently change the user's requested
   * currency and amount.
   */
  async getRealQuote(
    request: RealQuoteRequest,
  ) {
    try {
      const baseAsset =
        request.baseAsset
          .trim()
          .toUpperCase();

      const quoteAsset =
        request.quoteAsset
          .trim()
          .toUpperCase();

      const side =
        request.side;

      if (
        !baseAsset ||
        !quoteAsset
      ) {
        throw new Error(
          "baseAsset and quoteAsset are required.",
        );
      }

      if (
        !request.amount ||
        request.amount.lte(
          new Prisma.Decimal(0),
        )
      ) {
        throw new Error(
          "amount must be greater than zero.",
        );
      }

      /*
       *
       * Therefore:
       *
       *   BUY USDT/NGN
       *   BUY USDT/GHS
       *
       * are valid Ramp requests.
       *
       * USD is NOT a supported Ramp fiat currency.
       */
      if (side === "BUY") {
        const supportedFiat =
          ["NGN", "GHS"].includes(
            quoteAsset,
          );

        if (!supportedFiat) {
          throw new Error(
          );
        }

        if (!request.network) {
          throw new Error(
          );
        }

        if (
          ![
            "USDT",
            "USDC",
            "XAUT",
            "USAT",
          ].includes(baseAsset)
        ) {
          throw new Error(
          );
        }
      }

      /*
       * Ramp quotes through getQuote().
       *
       * Pass a clean request object so network can never
       * accidentally be dropped before reaching the provider.
       */
      const provider =
        await this.getExchangeProvider();

      const providerQuote =
        await provider.getQuote({
          ...request,

          baseAsset,

          quoteAsset,

          side,

          ...(request.network
            ? {
                network:
                  request.network
                    .trim()
                    .toLowerCase(),
              }
            : {}),
        } as any);

      if (!providerQuote) {
        throw new Error(
        );
      }

      const providerRecord =
        await this.getOrCreateProviderRecord(
        );

      return this.app.prisma.exchangeQuote.create({
        data: {
          exchangeProviderId:
            providerRecord.id,

          fromCurrency:
            this.toCurrencyType(
              side === "BUY"
                ? quoteAsset
                : baseAsset,
            ),

          toCurrency:
            this.toCurrencyType(
              side === "BUY"
                ? baseAsset
                : quoteAsset,
            ),

          fromAmount:
            side === "BUY"
              ? request.amount
              : providerQuote.inputAmount,

          toAmount:
            side === "BUY"
              ? providerQuote.outputAmount
              : request.amount,

          rate:
            providerQuote.price,

          expiresAt:
            providerQuote.expiresAt,

          metadata:
            this.toPrismaJson({
              providerQuote:
                JSON.parse(
                  JSON.stringify(
                    providerQuote,
                  ),
                ),

              quoteId:
                providerQuote.quoteId,

              feePercentage:
                providerQuote.feePercentage.toString(),

              provider:

              ...(request.network
                ? {
                    network:
                      request.network
                        .trim()
                        .toLowerCase(),
                  }
                : {}),
            }),
        },
      });
    } catch (error) {
      this.app.log.error(
        {
          error,
          request: {
            ...request,
            amount:
              request.amount.toString(),
          },
        },
        "Failed to get real exchange quote",
      );

      throw error;
    }
  }

  async executeBuyOrder(
    request: OrderRequest,
  ) {
    return this.executeOrder(
      "BUY",
      request,
    );
  }

  async executeSellOrder(
    request: OrderRequest,
  ) {
    return this.executeOrder(
      "SELL",
      request,
    );
  }

  private async executeOrder(
    side: "BUY" | "SELL",
    request: OrderRequest,
  ) {
    try {
      const existing =
        await this.getExistingOrder(
          request,
        );

      if (existing) {
        return existing;
      }

      await this.validateAndUseQuote(
        request,
      );

      const provider =
        await this.getExchangeProvider();

      const order =
        side === "BUY"
          ? await provider.buy({
              ...request,
              side,
            })
          : await provider.sell({
              ...request,
              side,
            });

      const providerRecord =
        await this.getOrCreateProviderRecord(
        );

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

            side,

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
                order:
                  JSON.parse(
                    JSON.stringify(
                      order,
                    ),
                  ),

                clientOrderId:
                  request.clientOrderId,

                quoteId:
                  request.quoteId,
              }),
          },
        });

      await this.createTradeIfFilled(
        dbOrder.id,
        order,
      );

      return dbOrder;
    } catch (error) {
      this.app.log.error(
        {
          error,
          request,
          side,
        },
        `Failed to execute ${side.toLowerCase()} order`,
      );

      throw error;
    }
  }

  private async getExistingOrder(
    request: OrderRequest,
  ) {
    if (!request.clientOrderId) {
      return null;
    }

    const order =
      await this.quoteValidator.getOrderByClientOrderId(
        request.clientOrderId,
      );

    if (order) {
      this.app.log.info(
        {
          clientOrderId:
            request.clientOrderId,
        },
        "Idempotent order retrieval: returning existing order",
      );
    }

    return order;
  }

  private async validateAndUseQuote(
    request: OrderRequest,
  ) {
    if (!request.quoteId) {
      return;
    }

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

    const validation =
      await this.quoteValidator.validateQuote(
        {
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
        },

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

    const metadata =
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
            ...metadata,

            usedAt:
              new Date().toISOString(),
          }),
      },
    });
  }

  private async createTradeIfFilled(
    orderId: string,
    order: any,
  ) {
    if (
      !order.executedAmount.gt(
        new Prisma.Decimal(0),
      )
    ) {
      return;
    }

    return this.app.prisma.exchangeTrade.create({
      data: {
        orderId,

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
            order.metadata,
          ),
      },
    });
  }

  async getOrderStatus(
    orderId: string,
    merchantId?: string,
  ) {
    try {
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
        await provider.getOrder(
          orderId,
        );

      const dbOrder =
        await this.app.prisma.exchangeOrder.findFirst({
          where: {
            orderId,
          },
        });

      if (dbOrder) {
        const metadata =
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
                ...metadata,

                lastStatusUpdate:
                  new Date().toISOString(),

                order:
                  JSON.parse(
                    JSON.stringify(
                      order,
                    ),
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

  async getProviderBalance(
    asset: string,
  ) {
    try {
      const provider =
        await this.getExchangeProvider();

      return provider.getBalance(
        asset,
      );
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

  async listMerchantOrders(
    merchantId: string,
    page = 1,
    limit = 10,
  ) {
    const skip =
      Math.max(
        0,
        page - 1,
      ) * limit;

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
        Math.ceil(
          total / limit,
        ),
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
              blockchainTransaction: true,
              wallet: true,
            },
          },
        },
      });

    return {
      order,
      conversion,
    };
  }

  private async getOrCreateProviderRecord(
    providerName: string,
  ) {
    return this.app.prisma.exchangeProvider.upsert({
      where: {
        name: providerName,
      },

      update: {},

      create: {
        name: providerName,
        isActive: true,
      },
    });
  }
}