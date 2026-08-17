import { Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";

export default class ExchangeService {

  constructor(
    private readonly app: FastifyInstance
  ) {}

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
      // If running in mock mode, create a fallback 1:1 rate to allow local e2e testing
      if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
        const fallback = new Prisma.Decimal(1);
        await this.createExchangeRate({
          fromCurrency,
          toCurrency,
          rate: fallback,
          source: "mock-fallback",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        });

        return {
          fromCurrency,
          toCurrency,
          rate: fallback,
          amount,
          convertedAmount: amount,
          expiresAt: null,
        };
      }

      throw new Error(
        "Exchange rate unavailable."
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
      if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
        // create a mock 1:1 rate for local testing
        const fallback = new Prisma.Decimal(1);
        rate = await this.createExchangeRate({
          fromCurrency: data.fromCurrency,
          toCurrency: data.toCurrency,
          rate: fallback,
          source: "mock-fallback",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        }) as any;
      } else {
        throw new Error("Exchange rate unavailable for quote.");
      }
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

}
