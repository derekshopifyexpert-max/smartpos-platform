/**
 * Quote Validator Service
 * 
 * Validates quotes before order execution to ensure:
 * - Quote hasn't expired
 * - Assets match between quote and order
 * - Price variance is within acceptable limits
 * - Order amount matches quote requirements
 */

import { CryptoQuote } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";

export interface QuoteValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    expiryStatus: "valid" | "expired";
    timeRemainingMs?: number;
    priceMatch: boolean;
    assetMatch: boolean;
    amountMatch: boolean;
  };
}

export default class QuoteValidatorService {
  constructor(private readonly app: FastifyInstance) {}

  /**
   * Validate a quote before order execution
   * 
   * Checks:
   * 1. Quote exists and is not expired
   * 2. Assets match between quote and intended order
   * 3. Order amount is within acceptable variance of quoted amount
   * 4. Quote is not already used (idempotency)
   */
  async validateQuote(
    quote: CryptoQuote,
    options: {
      baseAsset?: string;
      quoteAsset?: string;
      requestedAmount?: Prisma.Decimal;
      allowedVariancePercent?: number; // Default 1%
    } = {}
  ): Promise<QuoteValidationResult> {
    const allowedVariance = options.allowedVariancePercent ?? 1;

    // Check expiry
    if (quote.expiresAt && quote.expiresAt < new Date()) {
      return {
        valid: false,
        error: "Quote has expired",
        details: {
          expiryStatus: "expired",
          priceMatch: false,
          assetMatch: false,
          amountMatch: false,
        },
      };
    }

    const timeRemaining = quote.expiresAt
      ? quote.expiresAt.getTime() - Date.now()
      : undefined;

    if (timeRemaining && timeRemaining < 1000) {
      // Less than 1 second remaining
      return {
        valid: false,
        error: "Quote is expiring soon (less than 1 second remaining)",
        details: {
          expiryStatus: "valid",
          timeRemainingMs: timeRemaining,
          priceMatch: false,
          assetMatch: false,
          amountMatch: false,
        },
      };
    }

    // Check assets if provided
    const assetMatch =
      !options.baseAsset ||
      !options.quoteAsset ||
      quote.fromCurrency === options.baseAsset ||
      quote.toCurrency === options.quoteAsset;

    if (!assetMatch) {
      return {
        valid: false,
        error: `Quote assets don't match. Quote: ${quote.fromCurrency}/${quote.toCurrency}, Order: ${options.baseAsset}/${options.quoteAsset}`,
        details: {
          expiryStatus: "valid",
          timeRemainingMs: timeRemaining,
          priceMatch: false,
          assetMatch: false,
          amountMatch: false,
        },
      };
    }

    // Check amount if provided
    let amountMatch = true;
    if (options.requestedAmount && quote.amount) {
      const variance = options.requestedAmount
        .sub(quote.amount)
        .abs()
        .div(quote.amount)
        .mul(100);

      amountMatch = variance.lte(new Prisma.Decimal(allowedVariance));

      if (!amountMatch) {
        return {
          valid: false,
          error: `Order amount variance exceeds ${allowedVariance}%. Quoted: ${quote.amount}, Requested: ${options.requestedAmount}, Variance: ${variance.toFixed(2)}%`,
          details: {
            expiryStatus: "valid",
            timeRemainingMs: timeRemaining,
            priceMatch: false,
            assetMatch: true,
            amountMatch: false,
          },
        };
      }
    }

    return {
      valid: true,
      details: {
        expiryStatus: "valid",
        timeRemainingMs: timeRemaining,
        priceMatch: true,
        assetMatch: true,
        amountMatch: true,
      },
    };
  }

  /**
   * Mark a quote as used (for idempotency tracking)
   */
  async markQuoteAsUsed(quoteId: string): Promise<void> {
    await this.app.prisma.cryptoQuote.update({
      where: { id: quoteId },
      data: {
        metadata: {
          ...(this.app.prisma.cryptoQuote.findUnique({
            where: { id: quoteId },
          }) as any).metadata,
          usedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Check if a quote has already been used
   */
  async isQuoteAlreadyUsed(quoteId: string): Promise<boolean> {
    const quote = await this.app.prisma.cryptoQuote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) return false;

    const metadata = quote.metadata as any;
    return !!metadata?.usedAt;
  }

  /**
   * Check if a client order ID has already been used (idempotency)
   */
  async hasClientOrderIdBeenUsed(clientOrderId: string): Promise<boolean> {
    const existingOrder = await this.app.prisma.exchangeOrder.findFirst({
      where: {
        metadata: {
          path: ["clientOrderId"],
          equals: clientOrderId,
        },
      },
    });

    return !!existingOrder;
  }

  /**
   * Get existing order by client order ID (for idempotent operations)
   */
  async getOrderByClientOrderId(clientOrderId: string) {
    return this.app.prisma.exchangeOrder.findFirst({
      where: {
        metadata: {
          path: ["clientOrderId"],
          equals: clientOrderId,
        },
      },
    });
  }

  /**
   * Validate and retrieve an order by client order ID
   * Returns existing order if available (idempotent behavior)
   */
  async getOrCreateOrder(
    clientOrderId: string,
    orderCreatorFn: () => Promise<any>
  ): Promise<{ order: any; isNew: boolean }> {
    // Check if order already exists
    const existingOrder = await this.getOrderByClientOrderId(clientOrderId);
    if (existingOrder) {
      return { order: existingOrder, isNew: false };
    }

    // Create new order
    const newOrder = await orderCreatorFn();
    return { order: newOrder, isNew: true };
  }
}
