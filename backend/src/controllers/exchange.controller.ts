import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { Prisma } from "@prisma/client";

import ExchangeService from "../services/exchange.service.js";

type ExchangeUser = {
  merchantId?: string;
};

type RealQuoteBody = {
  baseAsset?: unknown;
  quoteAsset?: unknown;
  side?: unknown;
  amount?: unknown;
  ttlSeconds?: unknown;
  network?: unknown;
};

type OrderBody = {
  baseAsset?: unknown;
  quoteAsset?: unknown;
  amount?: unknown;
  quoteId?: unknown;
  clientOrderId?: unknown;
  limitPrice?: unknown;
};

function getMerchantId(
  request: FastifyRequest,
): string | undefined {
  return (
    request.user as
      | ExchangeUser
      | undefined
  )?.merchantId;
}

function requiredString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return undefined;
  }

  return value.trim();
}

function decimalFrom(
  value: unknown,
): Prisma.Decimal | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  try {
    const decimal =
      new Prisma.Decimal(
        String(value),
      );

    if (!decimal.isFinite()) {
      return undefined;
    }

    return decimal;
  } catch {
    return undefined;
  }
}

function positiveDecimal(
  value: unknown,
): Prisma.Decimal | undefined {
  const decimal =
    decimalFrom(value);

  if (
    !decimal ||
    decimal.lte(0)
  ) {
    return undefined;
  }

  return decimal;
}

function errorStatus(
  error: unknown,
  fallback = 400,
): number {
  if (
    error &&
    typeof error === "object"
  ) {
    const value =
      error as {
        status?: unknown;
        statusCode?: unknown;
        retryable?: unknown;
      };

    if (
      typeof value.status ===
        "number" &&
      value.status >= 400 &&
      value.status <= 599
    ) {
      return value.status;
    }

    if (
      typeof value.statusCode ===
        "number" &&
      value.statusCode >= 400 &&
      value.statusCode <= 599
    ) {
      return value.statusCode;
    }

    if (
      value.retryable === true
    ) {
      return 503;
    }
  }

  return fallback;
}

function errorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return String(
      (
        error as {
          message: string;
        }
      ).message,
    );
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  return fallback;
}

export default class ExchangeController {
  constructor(
    private readonly exchangeService: ExchangeService,
  ) {}

  createRate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body =
        request.body as Record<
          string,
          unknown
        >;

      const fromCurrency =
        requiredString(
          body?.fromCurrency,
        );

      const toCurrency =
        requiredString(
          body?.toCurrency,
        );

      const rate =
        decimalFrom(body?.rate);

      const source =
        requiredString(
          body?.source,
        );

      if (
        !fromCurrency ||
        !toCurrency ||
        !rate ||
        !source
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "fromCurrency, toCurrency, rate and source are required.",
          });
      }

      if (rate.lte(0)) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "rate must be greater than zero.",
          });
      }

      const result =
        await this.exchangeService.createExchangeRate(
          {
            ...body,
            fromCurrency,
            toCurrency,
            rate,
            source,
          } as any,
        );

      return reply
        .code(201)
        .send({
          success: true,
          message:
            "Exchange rate created",
          data: result,
        });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to create exchange rate",
      );

      return reply
        .code(
          errorStatus(error),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to create exchange rate",
            ),
        });
    }
  };

  quote = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body =
        request.body as Record<
          string,
          unknown
        >;

      const fromCurrency =
        requiredString(
          body?.fromCurrency,
        );

      const toCurrency =
        requiredString(
          body?.toCurrency,
        );

      const amount =
        positiveDecimal(
          body?.amount,
        );

      if (
        !fromCurrency ||
        !toCurrency ||
        !amount
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "fromCurrency, toCurrency and a positive amount are required.",
          });
      }

      const result =
        await this.exchangeService.calculateQuote(
          fromCurrency,
          toCurrency,
          amount,
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to calculate exchange quote",
      );

      return reply
        .code(
          errorStatus(error),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to calculate exchange quote",
            ),
        });
    }
  };

  /**
   * POST /exchange/real-quote
   *
   * Current Quidax Ramp BUY request:
   *
   * {
   *   "baseAsset": "USDT",
   *   "quoteAsset": "NGN",
   *   "side": "BUY",
   *   "amount": "100000",
   *   "network": "trc20",
   *   "ttlSeconds": 30
   * }
   */
  getRealQuote = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body =
        (request.body ??
          {}) as RealQuoteBody;

      const baseAsset =
        requiredString(
          body.baseAsset,
        );

      const quoteAsset =
        requiredString(
          body.quoteAsset,
        );

      const side =
        requiredString(
          body.side,
        )?.toUpperCase();

      const amount =
        positiveDecimal(
          body.amount,
        );

      const network =
        requiredString(
          body.network,
        );

      let ttlSeconds:
        | number
        | undefined;

      if (
        body.ttlSeconds !==
          undefined &&
        body.ttlSeconds !==
          null &&
        body.ttlSeconds !== ""
      ) {
        const parsed =
          Number(
            body.ttlSeconds,
          );

        if (
          !Number.isFinite(
            parsed,
          ) ||
          parsed <= 0
        ) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                "ttlSeconds must be a positive number.",
            });
        }

        ttlSeconds =
          Math.floor(parsed);
      }

      if (
        !baseAsset ||
        !quoteAsset ||
        !side ||
        !amount
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "baseAsset, quoteAsset, side and a positive amount are required.",
          });
      }

      if (
        side !== "BUY" &&
        side !== "SELL"
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "side must be BUY or SELL.",
          });
      }

      if (
        side === "BUY" &&
        !network
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "network is required for a Quidax BUY quote.",
          });
      }

      if (
        side === "BUY" &&
        !["NGN", "GHS"].includes(
          quoteAsset.toUpperCase(),
        )
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "Quidax BUY quotes currently support NGN or GHS only.",
          });
      }

      const quote =
        await this.exchangeService.getRealQuote(
          {
            baseAsset,
            quoteAsset,
            side,
            amount,
            ttlSeconds,

            ...(network
              ? {
                  network,
                }
              : {}),
          } as any,
        );

      return reply
        .code(200)
        .send({
          success: true,
          message:
            "Quote retrieved successfully",
          data: quote,
        });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to get real exchange quote",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to get quote",
            ),
        });
    }
  };

  /**
   * POST /exchange/buy
   */
  buyOrder = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body =
        (request.body ??
          {}) as OrderBody;

      const baseAsset =
        requiredString(
          body.baseAsset,
        );

      const quoteAsset =
        requiredString(
          body.quoteAsset,
        );

      const amount =
        positiveDecimal(
          body.amount,
        );

      const quoteId =
        requiredString(
          body.quoteId,
        );

      const clientOrderId =
        requiredString(
          body.clientOrderId,
        );

      const limitPrice =
        body.limitPrice ===
          undefined ||
        body.limitPrice ===
          null ||
        body.limitPrice === ""
          ? undefined
          : positiveDecimal(
              body.limitPrice,
            );

      if (
        !baseAsset ||
        !quoteAsset ||
        !amount
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "baseAsset, quoteAsset and a positive amount are required.",
          });
      }

      if (
        body.limitPrice !==
          undefined &&
        body.limitPrice !==
          null &&
        body.limitPrice !== "" &&
        !limitPrice
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "limitPrice must be a positive number.",
          });
      }

      const merchantId =
        getMerchantId(request);

      const order =
        await this.exchangeService.executeBuyOrder(
          {
            baseAsset,
            quoteAsset,
            amount,
            merchantId,
            quoteId,
            clientOrderId,
            limitPrice,
          },
        );

      return reply
        .code(201)
        .send({
          success: true,
          message:
            "Buy order executed successfully",
          data: order,
        });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to execute buy order",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to execute buy order",
            ),
        });
    }
  };

  /**
   * POST /exchange/sell
   */
  sellOrder = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body =
        (request.body ??
          {}) as OrderBody;

      const baseAsset =
        requiredString(
          body.baseAsset,
        );

      const quoteAsset =
        requiredString(
          body.quoteAsset,
        );

      const amount =
        positiveDecimal(
          body.amount,
        );

      const quoteId =
        requiredString(
          body.quoteId,
        );

      const clientOrderId =
        requiredString(
          body.clientOrderId,
        );

      const limitPrice =
        body.limitPrice ===
          undefined ||
        body.limitPrice ===
          null ||
        body.limitPrice === ""
          ? undefined
          : positiveDecimal(
              body.limitPrice,
            );

      if (
        !baseAsset ||
        !quoteAsset ||
        !amount
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "baseAsset, quoteAsset and a positive amount are required.",
          });
      }

      if (
        body.limitPrice !==
          undefined &&
        body.limitPrice !==
          null &&
        body.limitPrice !== "" &&
        !limitPrice
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "limitPrice must be a positive number.",
          });
      }

      const merchantId =
        getMerchantId(request);

      const order =
        await this.exchangeService.executeSellOrder(
          {
            baseAsset,
            quoteAsset,
            amount,
            merchantId,
            quoteId,
            clientOrderId,
            limitPrice,
          },
        );

      return reply
        .code(201)
        .send({
          success: true,
          message:
            "Sell order executed successfully",
          data: order,
        });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to execute sell order",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to execute sell order",
            ),
        });
    }
  };

  /**
   * GET /exchange/orders/:orderId
   */
  getOrderStatus = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const {
        orderId,
      } =
        request.params as {
          orderId?: string;
        };

      const merchantId =
        getMerchantId(request);

      if (
        !orderId ||
        !merchantId
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "Authenticated merchant and orderId are required.",
          });
      }

      const order =
        await this.exchangeService.getOrderStatus(
          orderId,
          merchantId,
        );

      return reply.send({
        success: true,
        data: order,
      });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to get order status",
      );

      return reply
        .code(
          errorStatus(
            error,
            404,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to get order status",
            ),
        });
    }
  };

  /**
   * GET /exchange/balance/:asset
   */
  getBalance = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { asset } =
        request.params as {
          asset?: string;
        };

      const normalizedAsset =
        requiredString(asset);

      if (
        !normalizedAsset
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "asset is required.",
          });
      }

      const balance =
        await this.exchangeService.getProviderBalance(
          normalizedAsset,
        );

      return reply.send({
        success: true,
        data: balance,
      });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to get provider balance",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to get balance",
            ),
        });
    }
  };

  getAssets = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const assets =
        await this.exchangeService.getProviderAssets();

      return reply.send({
        success: true,
        data: assets,
      });
    } catch (error) {
      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Quidax assets unavailable.",
            ),
        });
    }
  };

  getMarkets = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const markets =
        await this.exchangeService.getProviderMarkets();

      return reply.send({
        success: true,
        data: markets,
      });
    } catch (error) {
      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Quidax markets unavailable.",
            ),
        });
    }
  };

  getBalances = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const balances =
        await this.exchangeService.getProviderBalances();

      return reply.send({
        success: true,
        data: balances,
      });
    } catch (error) {
      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Quidax balances unavailable.",
            ),
        });
    }
  };

  providerStatus = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const configuration =
      await import(
        "../config/env.js"
      ).then(
        (module) =>
          module.default,
      );

    try {
      const provider =
        await this.exchangeService.getExchangeProvider();

      const account =
        await provider.getAccountInfo();

      return reply.send({
        success: true,
        data: {
          provider:
            "QUIDAX",
          environment:
            configuration.QUIDAX_ENVIRONMENT,
          connected: true,
          exchangeConnected: true,
          rampConfigured: Boolean(
            configuration.QUIDAX_RAMP_BASE_URL &&
              configuration.QUIDAX_RAMP_PRIVATE_KEY,
          ),
          accountId:
            account.accountId,
        },
      });
    } catch (error) {
      return reply
        .code(200)
        .send({
          success: true,
          data: {
            provider:
              "QUIDAX",
            environment:
              configuration.QUIDAX_ENVIRONMENT,
            connected: false,
            exchangeConnected: false,
            rampConfigured: Boolean(
              configuration.QUIDAX_RAMP_BASE_URL &&
                configuration.QUIDAX_RAMP_PRIVATE_KEY,
            ),
            error:
              errorMessage(
                error,
                "Quidax unavailable.",
              ),
          },
        });
    }
  };

  listOrders = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const merchantId =
        getMerchantId(request);

      if (!merchantId) {
        return reply
          .code(403)
          .send({
            success: false,
            error:
              "Authenticated merchant account is required.",
          });
      }

      const query =
        request.query as {
          page?:
            | number
            | string;
          limit?:
            | number
            | string;
        };

      const pageNumber =
        Number(
          query?.page ?? 1,
        );

      const limitNumber =
        Number(
          query?.limit ?? 10,
        );

      const page =
        Number.isFinite(
          pageNumber,
        )
          ? Math.max(
              1,
              Math.floor(
                pageNumber,
              ),
            )
          : 1;

      const limit =
        Number.isFinite(
          limitNumber,
        )
          ? Math.min(
              50,
              Math.max(
                1,
                Math.floor(
                  limitNumber,
                ),
              ),
            )
          : 10;

      const result =
        await this.exchangeService.listMerchantOrders(
          merchantId,
          page,
          limit,
        );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to list merchant exchange orders",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to load exchange orders.",
            ),
        });
    }
  };

  getOrderDetails = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const merchantId =
        getMerchantId(request);

      const {
        orderId,
      } =
        request.params as {
          orderId?: string;
        };

      if (
        !merchantId ||
        !orderId
      ) {
        return reply
          .code(400)
          .send({
            success: false,
            error:
              "Authenticated merchant and order ID are required.",
          });
      }

      const details =
        await this.exchangeService.getMerchantOrderDetails(
          merchantId,
          orderId,
        );

      if (!details) {
        return reply
          .code(404)
          .send({
            success: false,
            error:
              "Exchange order not found.",
          });
      }

      return reply.send({
        success: true,
        data: details,
      });
    } catch (error) {
      request.log.error(
        { error },
        "Failed to get exchange order details",
      );

      return reply
        .code(
          errorStatus(
            error,
            400,
          ),
        )
        .send({
          success: false,
          error:
            errorMessage(
              error,
              "Failed to get exchange order details.",
            ),
        });
    }
  };
}