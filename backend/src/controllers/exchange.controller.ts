import { FastifyReply, FastifyRequest } from "fastify";
import ExchangeService from "../services/exchange.service.js";
import { Prisma } from "@prisma/client";

export default class ExchangeController {
  constructor(
    private readonly exchangeService: ExchangeService
  ) {}

  createRate = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const rate =
      await this.exchangeService.createExchangeRate(
        request.body as any
      );

    return reply.code(201).send({
      success: true,
      message: "Exchange rate created",
      data: rate
    });
  };

  quote = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {
      fromCurrency,
      toCurrency,
      amount
    } = request.body as any;

    const result =
      await this.exchangeService.calculateQuote(
        fromCurrency,
        toCurrency,
        amount
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  /**
   * GET /exchange/real-quote
   * Get a live quote from the configured real exchange provider
   * 
   * Request body:
   * {
   *   "baseAsset": "USDT",
   *   "quoteAsset": "USD",
   *   "side": "BUY",
   *   "amount": "1000.00",
   *   "ttlSeconds": 30
   * }
   */
  getRealQuote = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { baseAsset, quoteAsset, side, amount, ttlSeconds } = request.body as any;

      // Validate inputs
      if (!baseAsset || !quoteAsset || !side || !amount) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: baseAsset, quoteAsset, side, amount"
        });
      }

      if (!["BUY", "SELL"].includes(side)) {
        return reply.code(400).send({
          success: false,
          error: "side must be BUY or SELL"
        });
      }

      const quote = await this.exchangeService.getRealQuote({
        baseAsset,
        quoteAsset,
        side,
        amount: new Prisma.Decimal(amount),
        ttlSeconds
      });

      return reply.code(200).send({
        success: true,
        message: "Quote retrieved successfully",
        data: quote
      });
    } catch (error: any) {
      return reply.code(error.retryable ? 503 : 400).send({
        success: false,
        error: error.message || "Failed to get quote"
      });
    }
  };

  /**
   * POST /exchange/buy
   * Execute a BUY order on the exchange provider
   * 
   * Request body:
   * {
   *   "baseAsset": "USDT",
   *   "quoteAsset": "USD",
   *   "amount": "1000.00",
   *   "quoteId": "quote_123456",
   *   "clientOrderId": "order_client_123",
   *   "limitPrice": "1.05"
   * }
   */
  buyOrder = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { baseAsset, quoteAsset, amount, quoteId, clientOrderId, limitPrice } = request.body as any;
      const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;

      // Validate inputs
      if (!baseAsset || !quoteAsset || !amount) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: baseAsset, quoteAsset, amount"
        });
      }

      const order = await this.exchangeService.executeBuyOrder({
        baseAsset,
        quoteAsset,
        amount: new Prisma.Decimal(amount),
        merchantId,
        quoteId,
        clientOrderId,
        limitPrice: limitPrice ? new Prisma.Decimal(limitPrice) : undefined
      });

      return reply.code(201).send({
        success: true,
        message: "Buy order executed successfully",
        data: order
      });
    } catch (error: any) {
      return reply.code(error.retryable ? 503 : 400).send({
        success: false,
        error: error.message || "Failed to execute buy order"
      });
    }
  };

  /**
   * POST /exchange/sell
   * Execute a SELL order on the exchange provider
   * 
   * Request body:
   * {
   *   "baseAsset": "USDT",
   *   "quoteAsset": "USD",
   *   "amount": "100.00",
   *   "quoteId": "quote_123456",
   *   "clientOrderId": "order_client_123",
   *   "limitPrice": "0.95"
   * }
   */
  sellOrder = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { baseAsset, quoteAsset, amount, quoteId, clientOrderId, limitPrice } = request.body as any;
      const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;

      // Validate inputs
      if (!baseAsset || !quoteAsset || !amount) {
        return reply.code(400).send({
          success: false,
          error: "Missing required fields: baseAsset, quoteAsset, amount"
        });
      }

      const order = await this.exchangeService.executeSellOrder({
        baseAsset,
        quoteAsset,
        amount: new Prisma.Decimal(amount),
        merchantId,
        quoteId,
        clientOrderId,
        limitPrice: limitPrice ? new Prisma.Decimal(limitPrice) : undefined
      });

      return reply.code(201).send({
        success: true,
        message: "Sell order executed successfully",
        data: order
      });
    } catch (error: any) {
      return reply.code(error.retryable ? 503 : 400).send({
        success: false,
        error: error.message || "Failed to execute sell order"
      });
    }
  };

  /**
   * GET /exchange/orders/:orderId
   * Get order status from the provider
   */
  getOrderStatus = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { orderId } = request.params as any;
      const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;

      if (!orderId || !merchantId) {
        return reply.code(400).send({
          success: false,
          error: "orderId is required"
        });
      }

      const order = await this.exchangeService.getOrderStatus(orderId, merchantId);

      return reply.send({
        success: true,
        data: order
      });
    } catch (error: any) {
      return reply.code(error.retryable ? 503 : 404).send({
        success: false,
        error: error.message || "Failed to get order status"
      });
    }
  };

  /**
   * GET /exchange/balance/:asset
   * Get provider balance for a specific asset
   */
  getBalance = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { asset } = request.params as any;

      if (!asset) {
        return reply.code(400).send({
          success: false,
          error: "asset is required"
        });
      }

      const balance = await this.exchangeService.getProviderBalance(asset);

      return reply.send({
        success: true,
        data: balance
      });
    } catch (error: any) {
      return reply.code(error.retryable ? 503 : 404).send({
        success: false,
        error: error.message || "Failed to get balance"
      });
    }
  };

  listOrders = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;
    if (!merchantId) {
      return reply.code(403).send({ success: false, error: "Authenticated merchant account is required." });
    }

    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
    const result = await this.exchangeService.listMerchantOrders(
      merchantId,
      Math.max(1, Number(page)),
      Math.min(50, Math.max(1, Number(limit)))
    );

    return reply.send({ success: true, data: result });
  };

  getOrderDetails = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;
    const { orderId } = request.params as { orderId?: string };
    if (!merchantId || !orderId) {
      return reply.code(400).send({ success: false, error: "Authenticated merchant and order ID are required." });
    }

    const details = await this.exchangeService.getMerchantOrderDetails(merchantId, orderId);
    if (!details) {
      return reply.code(404).send({ success: false, error: "Exchange order not found." });
    }

    return reply.send({ success: true, data: details });
  };
}
