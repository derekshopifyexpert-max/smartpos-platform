import { Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";
import QuoteValidatorService from "./quote-validator.service.js";

export default class ExchangeService {

  private readonly quoteValidator: QuoteValidatorService;

  constructor(
    private readonly app: FastifyInstance
  ) {
    this.quoteValidator = new QuoteValidatorService(app);
  }

  /*
  |--------------------------------------------------------------------------
  | Exchange Rate
  |--------------------------------------------------------------------------
  */

  async latestRate(

    fromCurrency: any,

    toCurrency: any

  ) {

    return this.app.prisma.exchangeRate.findFirst({

      where: {

        fromCurrency,

        toCurrency

      },

      orderBy: {

        timestamp: "desc"

      }

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

        metadata: data.metadata ?? Prisma.JsonNull

      }

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

    amount: Prisma.Decimal

  ) {

    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        rate: new Prisma.Decimal(1),
        amount,
        convertedAmount: amount,
        expiresAt: null
      };
    }

    const rate =
      await this.latestRate(
        fromCurrency,
        toCurrency
      );

    if (!rate) {
      // In production, throw a clear error - don't create fake rates
      throw new Error(
        `Exchange rate unavailable for ${fromCurrency}/${toCurrency}. ` +
        `Please configure a real exchange provider or request an updated rate.`
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

      expiresAt: rate.expiresAt

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

        data.fromAmount

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

        metadata: data.metadata ?? Prisma.JsonNull,

        status: "pending"

      }

    });

  }

  /**
   * Persist a live crypto quote (CryptoQuote) using the latest stored rate.
   * ttlSeconds controls quote validity; default 30 seconds.
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

    let rate = await this.latestRate(data.fromCurrency, data.toCurrency);

    if (!rate) {
      // In production, require real rate from provider
      throw new Error(
        `Exchange rate unavailable for ${data.fromCurrency}/${data.toCurrency}. ` +
        `Please configure a real exchange provider or request an updated rate.`
      );
    }

    const quoteAmount = data.amount.mul(rate.rate);

    const expiresAt = new Date(Date.now() + ttl * 1000);

    return this.app.prisma.cryptoQuote.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        amount: data.amount,
        quoteAmount,
        rate: rate.rate,
        expiresAt,
        provider: data.provider ?? "",
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async completeConversion(

    conversionId: string

  ) {

    return this.app.prisma.cryptoConversion.update({

      where: {

        id: conversionId

      },

      data: {

        status: "completed",

        completedAt: new Date()

      }

    });

  }

  async failConversion(

    conversionId: string

  ) {

    return this.app.prisma.cryptoConversion.update({

      where: {

        id: conversionId

      },

      data: {

        status: "failed"

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Lookup
  |--------------------------------------------------------------------------
  */

  async findConversion(

    id: string

  ) {

    return this.app.prisma.cryptoConversion.findUnique({

      where: {

        id

      },

      include: {

        merchant: true,

        transaction: true,

        walletTransfer: true

      }

    });

  }

  async merchantConversions(

    merchantId: string

  ) {

    return this.app.prisma.cryptoConversion.findMany({

      where: {

        merchantId

      },

      orderBy: {

        createdAt: "desc"

      }

    });

  }

  /*
  |--------------------------------------------------------------------------
  | Real Exchange Provider Integration
  |--------------------------------------------------------------------------
  */

  /**
   * Get or create a real exchange provider instance.
   * Configured via ExchangeProvider database model or environment variables.
   */
  async getExchangeProvider() {
    // Try to get configured provider from database first
    const dbProvider = await this.app.prisma.exchangeProvider.findFirst({
      where: { isActive: true }
    });

    if (dbProvider && dbProvider.baseUrl && dbProvider.apiKey) {
      // Use database-configured provider
      const { RealExchangeProvider } = await import("../providers/real-exchange.provider.js");
      return new RealExchangeProvider({
        provider: dbProvider.name,
        baseUrl: dbProvider.baseUrl,
        apiKey: dbProvider.apiKey,
        apiSecret: dbProvider.apiSecret ?? undefined,
        metadata: dbProvider.metadata as any,
      });
    }

    // Try environment variables
    const { EXCHANGE_PROVIDER_NAME, EXCHANGE_PROVIDER_BASE_URL, EXCHANGE_PROVIDER_API_KEY, EXCHANGE_PROVIDER_API_SECRET } = await import("../config/env.js").then(m => m.default);

    if (!EXCHANGE_PROVIDER_NAME || !EXCHANGE_PROVIDER_BASE_URL) {
      throw new Error(
        "No exchange provider configured. " +
        "Set EXCHANGE_PROVIDER_NAME and EXCHANGE_PROVIDER_BASE_URL in environment variables " +
        "or configure an active ExchangeProvider in the database."
      );
    }

    const { RealExchangeProvider } = await import("../providers/real-exchange.provider.js");
    return new RealExchangeProvider({
      provider: EXCHANGE_PROVIDER_NAME,
      baseUrl: EXCHANGE_PROVIDER_BASE_URL,
      apiKey: EXCHANGE_PROVIDER_API_KEY,
      apiSecret: EXCHANGE_PROVIDER_API_SECRET,
    });
  }

  /**
   * Get a live quote from the real exchange provider.
   * Quote expires after ttlSeconds (default 30 seconds).
   */
  async getRealQuote(request: {
    baseAsset: string;      // e.g., "USDT"
    quoteAsset: string;     // e.g., "USD", "NGN"
    side: "BUY" | "SELL";
    amount: Prisma.Decimal;
    ttlSeconds?: number;
  }) {
    try {
      const provider = await this.getExchangeProvider();

      // Get quote from provider
      const providerQuote = await provider.getQuote({
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        side: request.side,
        amount: request.amount,
      });

      // Persist quote in database
      const quote = await this.app.prisma.exchangeQuote.create({
        data: {
          exchangeProviderId: (await this.getOrCreateProviderRecord(provider.constructor.name)).id,
          fromCurrency: request.side === "BUY" ? request.quoteAsset : request.baseAsset,
          toCurrency: request.side === "BUY" ? request.baseAsset : request.quoteAsset,
          fromAmount: request.side === "BUY" ? request.amount : providerQuote.inputAmount,
          toAmount: request.side === "BUY" ? providerQuote.outputAmount : request.amount,
          rate: providerQuote.price,
          expiresAt: providerQuote.expiresAt,
          metadata: {
            providerQuote,
            quoteId: providerQuote.quoteId,
            feePercentage: providerQuote.feePercentage.toString(),
          } as unknown as Prisma.JsonValue,
        },
      });

      return quote;
    } catch (error) {
      this.app.log.error({ error }, "Failed to get real exchange quote");
      throw error;
    }
  }

  /**
   * Execute a real BUY order on the exchange provider.
   * 
   * Features:
   * - Quote validation if quoteId provided
   * - Idempotent: returns existing order if clientOrderId was already used
   * - Validates provider balance before execution
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
      // Idempotency: Check if order already exists
      if (request.clientOrderId) {
        const existingOrder = await this.quoteValidator.getOrderByClientOrderId(
          request.clientOrderId
        );
        if (existingOrder) {
          this.app.log.info(
            { clientOrderId: request.clientOrderId },
            "Idempotent order retrieval: returning existing order"
          );
          return existingOrder;
        }
      }

      // Quote validation: If quote provided, validate it
      if (request.quoteId) {
        const quote = await this.app.prisma.exchangeQuote.findUnique({
          where: { id: request.quoteId },
        });

        if (!quote) {
          throw new Error(`Quote not found: ${request.quoteId}`);
        }

        const validation = await this.quoteValidator.validateQuote(quote, {
          baseAsset: request.baseAsset,
          quoteAsset: request.quoteAsset,
          requestedAmount: request.amount,
          allowedVariancePercent: 2, // Allow 2% variance
        });

        if (!validation.valid) {
          throw new Error(`Quote validation failed: ${validation.error}`);
        }

        // Mark quote as used
        if (!quote.metadata || typeof quote.metadata !== "object") {
          quote.metadata = {};
        }
        await this.app.prisma.exchangeQuote.update({
          where: { id: request.quoteId },
          data: {
            metadata: {
              ...quote.metadata,
              usedAt: new Date().toISOString(),
            } as unknown as Prisma.JsonValue,
          },
        });
      }

      const provider = await this.getExchangeProvider();

      const order = await provider.buy({
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        side: "BUY",
        amount: request.amount,
        quoteId: request.quoteId,
        clientOrderId: request.clientOrderId,
        limitPrice: request.limitPrice,
      });

      // Persist order in database
      const providerRecord = await this.getOrCreateProviderRecord(provider.constructor.name);
      const dbOrder = await this.app.prisma.exchangeOrder.create({
        data: {
          exchangeProviderId: providerRecord.id,
          merchantId: request.merchantId,
          orderId: order.orderId,
          symbol: order.symbol,
          side: "BUY",
          type: request.limitPrice ? "LIMIT" : "MARKET",
          price: order.averagePrice,
          amount: order.requestedAmount,
          filledAmount: order.executedAmount,
          avgPrice: order.averagePrice,
          status: order.status,
          metadata: {
            order,
            clientOrderId: request.clientOrderId,
            quoteId: request.quoteId,
          } as unknown as Prisma.JsonValue,
        },
      });

      // Record the trade/fill if provider returned executed amounts
      if (order.executedAmount.gt(new Prisma.Decimal("0"))) {
        await this.app.prisma.exchangeTrade.create({
          data: {
            orderId: dbOrder.id,
            tradeId: order.orderId,
            price: order.averagePrice,
            amount: order.executedAmount,
            total: order.executedAmount.mul(order.averagePrice),
            fee: order.totalFee,
            feeCurrency: "USD" as any,
            metadata: order.metadata as unknown as Prisma.JsonValue,
          },
        });
      }

      return dbOrder;
    } catch (error) {
      this.app.log.error({ error, request }, "Failed to execute buy order");
      throw error;
    }
  }

  /**
   * Execute a real SELL order on the exchange provider.
   * 
   * Features:
   * - Quote validation if quoteId provided
   * - Idempotent: returns existing order if clientOrderId was already used
   * - Validates provider balance before execution
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
      // Idempotency: Check if order already exists
      if (request.clientOrderId) {
        const existingOrder = await this.quoteValidator.getOrderByClientOrderId(
          request.clientOrderId
        );
        if (existingOrder) {
          this.app.log.info(
            { clientOrderId: request.clientOrderId },
            "Idempotent order retrieval: returning existing order"
          );
          return existingOrder;
        }
      }

      // Quote validation: If quote provided, validate it
      if (request.quoteId) {
        const quote = await this.app.prisma.exchangeQuote.findUnique({
          where: { id: request.quoteId },
        });

        if (!quote) {
          throw new Error(`Quote not found: ${request.quoteId}`);
        }

        const validation = await this.quoteValidator.validateQuote(quote, {
          baseAsset: request.baseAsset,
          quoteAsset: request.quoteAsset,
          requestedAmount: request.amount,
          allowedVariancePercent: 2, // Allow 2% variance
        });

        if (!validation.valid) {
          throw new Error(`Quote validation failed: ${validation.error}`);
        }

        // Mark quote as used
        if (!quote.metadata || typeof quote.metadata !== "object") {
          quote.metadata = {};
        }
        await this.app.prisma.exchangeQuote.update({
          where: { id: request.quoteId },
          data: {
            metadata: {
              ...quote.metadata,
              usedAt: new Date().toISOString(),
            } as unknown as Prisma.JsonValue,
          },
        });
      }

      const provider = await this.getExchangeProvider();

      const order = await provider.sell({
        baseAsset: request.baseAsset,
        quoteAsset: request.quoteAsset,
        side: "SELL",
        amount: request.amount,
        quoteId: request.quoteId,
        clientOrderId: request.clientOrderId,
        limitPrice: request.limitPrice,
      });

      // Persist order in database
      const providerRecord = await this.getOrCreateProviderRecord(provider.constructor.name);
      const dbOrder = await this.app.prisma.exchangeOrder.create({
        data: {
          exchangeProviderId: providerRecord.id,
          merchantId: request.merchantId,
          orderId: order.orderId,
          symbol: order.symbol,
          side: "SELL",
          type: request.limitPrice ? "LIMIT" : "MARKET",
          price: order.averagePrice,
          amount: order.requestedAmount,
          filledAmount: order.executedAmount,
          avgPrice: order.averagePrice,
          status: order.status,
          metadata: {
            order,
            clientOrderId: request.clientOrderId,
            quoteId: request.quoteId,
          } as unknown as Prisma.JsonValue,
        },
      });

      // Record the trade/fill if provider returned executed amounts
      if (order.executedAmount.gt(new Prisma.Decimal("0"))) {
        await this.app.prisma.exchangeTrade.create({
          data: {
            orderId: dbOrder.id,
            tradeId: order.orderId,
            price: order.averagePrice,
            amount: order.executedAmount,
            total: order.executedAmount.mul(order.averagePrice),
            fee: order.totalFee,
            feeCurrency: "USD" as any,
            metadata: order.metadata as unknown as Prisma.JsonValue,
          },
        });
      }

      return dbOrder;
    } catch (error) {
      this.app.log.error({ error, request }, "Failed to execute sell order");
      throw error;
    }
  }

  /**
   * Get order status from provider
   */
  async getOrderStatus(orderId: string, merchantId?: string) {
    try {
      if (merchantId) {
        const ownedOrder = await this.app.prisma.exchangeOrder.findFirst({
          where: { orderId, merchantId },
          select: { id: true },
        });
        if (!ownedOrder) throw new Error("Exchange order not found.");
      }

      const provider = await this.getExchangeProvider();
      const order = await provider.getOrder(orderId);

      // Update database record if it exists
      const dbOrder = await this.app.prisma.exchangeOrder.findUnique({
        where: { orderId }
      });

      if (dbOrder) {
        await this.app.prisma.exchangeOrder.update({
          where: { id: dbOrder.id },
          data: {
            status: order.status,
            filledAmount: order.executedAmount,
            avgPrice: order.averagePrice,
            metadata: {
              ...(dbOrder.metadata as any),
              lastStatusUpdate: new Date(),
              order,
            } as unknown as Prisma.JsonValue,
          },
        });
      }

      return order;
    } catch (error) {
      this.app.log.error({ error, orderId }, "Failed to get order status");
      throw error;
    }
  }

  /**
   * Get provider account balance for an asset
   */
  async getProviderBalance(asset: string) {
    try {
      const provider = await this.getExchangeProvider();
      const balance = await provider.getBalance(asset);
      return balance;
    } catch (error) {
      this.app.log.error({ error, asset }, "Failed to get provider balance");
      throw error;
    }
  }

  async listMerchantOrders(merchantId: string, page = 1, limit = 10) {
    const skip = Math.max(0, page - 1) * limit;
    const [items, total] = await Promise.all([
      this.app.prisma.exchangeOrder.findMany({
        where: { merchantId },
        include: { exchangeProvider: true, trades: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.app.prisma.exchangeOrder.count({ where: { merchantId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getMerchantOrderDetails(merchantId: string, orderId: string) {
    const order = await this.app.prisma.exchangeOrder.findFirst({
      where: { merchantId, OR: [{ id: orderId }, { orderId }] },
      include: { exchangeProvider: true, trades: true },
    });

    if (!order) return null;

    const conversion = await this.app.prisma.cryptoConversion.findFirst({
      where: { exchangeOrderId: order.id },
      include: {
        transaction: {
          include: { blockchainTransaction: true, wallet: true },
        },
      },
    });

    return { order, conversion };
  }

  /**
   * Helper: Get or create ExchangeProvider record
   */
  private async getOrCreateProviderRecord(providerName: string) {
    let provider = await this.app.prisma.exchangeProvider.findUnique({
      where: { name: providerName }
    });

    if (!provider) {
      provider = await this.app.prisma.exchangeProvider.create({
        data: {
          name: providerName,
          isActive: true,
        }
      });
    }

    return provider;
  }

}

