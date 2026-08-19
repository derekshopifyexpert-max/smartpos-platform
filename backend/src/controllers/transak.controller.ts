import type { FastifyReply, FastifyRequest } from "fastify";
import { TransakConfigurationError, TransakProviderError } from "../integrations/transak/transak.errors.js";
import { transakProvider } from "../integrations/transak/transak.provider.js";
import TransakTransactionService from "../services/transak-transaction.service.js";

function clientIp(request: FastifyRequest): string {
  const ip = request.ip?.trim();
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
    throw new TransakConfigurationError(
      "The originating client IP could not be determined. Configure the trusted proxy and TRUST_PROXY before using Transak checkout."
    );
  }
  return ip;
}

function errorResponse(reply: FastifyReply, error: unknown) {
  if (error instanceof TransakConfigurationError) {
    return reply.code(503).send({ success: false, error: error.message, code: error.code });
  }
  if (error instanceof TransakProviderError) {
    return reply.code(error.statusCode && error.statusCode >= 400 ? error.statusCode : 503).send({
      success: false,
      error: error.message,
      code: error.code,
      retryable: error.retryable,
    });
  }
  return reply.code(502).send({ success: false, error: "Transak request failed safely." });
}

function requireMerchant(request: FastifyRequest) {
  const merchantId = request.user?.merchantId;
  if (!merchantId) throw new Error("Authenticated merchant account is required.");
  return merchantId;
}

export default class TransakController {
  constructor(private readonly transactionService: TransakTransactionService) {}

  capabilities = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      requireMerchant(request);
      return reply.send({ success: true, data: await transakProvider.getCapabilities() });
    } catch (error) {
      if (error instanceof Error && error.message === "Authenticated merchant account is required.") {
        return reply.code(403).send({ success: false, error: error.message });
      }
      return errorResponse(reply, error);
    }
  };

  quote = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      requireMerchant(request);
      const body = request.body as Record<string, unknown>;
      const required = ["fiatCurrency", "fiatAmount", "cryptoCurrency", "network", "countryCode", "walletAddress"];
      for (const field of required) if (typeof body[field] !== "string" || !String(body[field]).trim()) return reply.code(400).send({ success: false, error: `${field} is required.` });
      const quote = await transakProvider.getQuote({
        fiatCurrency: String(body.fiatCurrency),
        fiatAmount: String(body.fiatAmount),
        cryptoCurrency: String(body.cryptoCurrency),
        network: String(body.network),
        countryCode: String(body.countryCode),
        paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
        walletAddress: String(body.walletAddress),
        userIp: clientIp(request),
      });
      return reply.send({ success: true, data: quote });
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  verifyWallet = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      requireMerchant(request);
      const body = request.body as Record<string, unknown>;
      const required = ["walletAddress", "cryptoCurrency", "network", "countryCode"];
      for (const field of required) if (typeof body[field] !== "string" || !String(body[field]).trim()) return reply.code(400).send({ success: false, error: `${field} is required.` });
      const result = await transakProvider.verifyWallet({
        walletAddress: String(body.walletAddress),
        cryptoCurrency: String(body.cryptoCurrency),
        network: String(body.network),
        countryCode: String(body.countryCode),
        userIp: clientIp(request),
      });
      return reply.send({
        success: true,
        data: {
          valid: result.valid === true || result.isValid === true,
          message: typeof result.message === "string" ? result.message : undefined,
          network: typeof result.network === "string" ? result.network : undefined,
          asset: typeof result.asset === "string" ? result.asset : undefined,
        },
      });
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  paymentSession = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const merchantId = requireMerchant(request);
      const body = request.body as Record<string, unknown>;
      const required = ["fiatCurrency", "fiatAmount", "cryptoCurrency", "network", "walletAddress", "countryCode"];
      for (const field of required) if (typeof body[field] !== "string" || !String(body[field]).trim()) return reply.code(400).send({ success: false, error: `${field} is required.` });
      const transaction = await this.transactionService.createOrGet({
        merchantId,
        customerId: typeof body.customerId === "string" ? body.customerId : undefined,
        paymentIntentId: typeof body.paymentIntentId === "string" ? body.paymentIntentId : undefined,
        transakQuoteId: typeof body.quoteId === "string" ? body.quoteId : undefined,
        fiatCurrency: String(body.fiatCurrency),
        fiatAmount: String(body.fiatAmount),
        cryptoCurrency: String(body.cryptoCurrency),
        network: String(body.network),
        walletAddress: String(body.walletAddress),
        paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
        cryptoAmount: typeof body.cryptoAmount === "string" ? body.cryptoAmount : undefined,
        quoteRate: typeof body.quoteRate === "string" ? body.quoteRate : undefined,
        feeAmount: typeof body.feeAmount === "string" ? body.feeAmount : undefined,
        feeCurrency: typeof body.feeCurrency === "string" ? body.feeCurrency : undefined,
      }, typeof body.transactionId === "string" ? body.transactionId : undefined);

      const session = await transakProvider.createWidgetSession({
        fiatCurrency: String(body.fiatCurrency),
        fiatAmount: String(body.fiatAmount),
        cryptoCurrency: String(body.cryptoCurrency),
        network: String(body.network),
        walletAddress: String(body.walletAddress),
        countryCode: String(body.countryCode),
        quoteId: typeof body.quoteId === "string" ? body.quoteId : undefined,
        userIp: clientIp(request),
      });
      return reply.send({ success: true, data: { transactionId: transaction.id, partnerOrderId: transaction.partnerOrderId, ...session } });
    } catch (error) {
      const body = request.body as Record<string, unknown>;
      if (typeof body?.transactionId === "string") {
        const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;
        if (merchantId && error instanceof Error) await this.transactionService.markSessionFailure(body.transactionId, merchantId, error.message);
      }
      return errorResponse(reply, error);
    }
  };

  order = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      requireMerchant(request);
      const { id } = request.params as { id?: string };
      if (!id) return reply.code(400).send({ success: false, error: "Transak order ID is required." });
      return reply.send({ success: true, data: await transakProvider.getOrder(id) });
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  history = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await this.transactionService.list(requireMerchant(request)) });
    } catch (error) {
      if (error instanceof Error && error.message === "Authenticated merchant account is required.") return reply.code(403).send({ success: false, error: error.message });
      return errorResponse(reply, error);
    }
  };

  detail = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ success: false, error: "Transaction ID is required." });
      const transaction = await this.transactionService.get(requireMerchant(request), id);
      if (!transaction) return reply.code(404).send({ success: false, error: "Transak transaction not found." });
      return reply.send({ success: true, data: transaction });
    } catch (error) {
      if (error instanceof Error && error.message === "Authenticated merchant account is required.") return reply.code(403).send({ success: false, error: error.message });
      return errorResponse(reply, error);
    }
  };

  webhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = process.env.TRANSAK_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return reply.code(503).send({ success: false, error: "Transak webhook verification is not configured." });
    }

    const signature = request.headers["x-transak-signature"];
    if (typeof signature !== "string") {
      return reply.code(401).send({ success: false, error: "Missing Transak webhook signature." });
    }

    const payload = request.body as Record<string, unknown>;
    const eventId = typeof payload.eventId === "string" ? payload.eventId : typeof payload.id === "string" ? payload.id : undefined;
    const eventType = typeof payload.eventType === "string" ? payload.eventType : typeof payload.eventName === "string" ? payload.eventName : undefined;
    if (!eventId || !eventType) return reply.code(400).send({ success: false, error: "Invalid Transak webhook event." });

    // The exact provider signature contract must be configured and verified before enabling this route.
    return reply.code(503).send({ success: false, error: "Transak webhook signature verification contract is not configured." });
  };
}
