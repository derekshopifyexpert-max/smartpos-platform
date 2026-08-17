import { Prisma } from "@prisma/client";
import PaymentService from "./payment.service.js";
import ExchangeService from "./exchange.service.js";
import BlockchainService from "./blockchain.service.js";
import { NotConfiguredCryptoTransferProvider, GenericHttpCryptoProvider } from "../providers/crypto-transfer.provider.js";
import MockCryptoProvider from "../providers/mock-crypto.provider.js";

export default class CryptoSettlementService {
  private readonly paymentService: PaymentService;
  private readonly exchangeService: ExchangeService;
  private readonly blockchainService: BlockchainService;
  private readonly cryptoTransferProvider: any;

  constructor(private readonly app: any) {
    this.paymentService = new PaymentService(app);
    this.exchangeService = new ExchangeService(app);
    this.blockchainService = new BlockchainService(app);

    // Default provider is a not-configured shim; replace via DI where available
    // Allow a mock provider for local testing via env flag
    if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
      this.cryptoTransferProvider = new MockCryptoProvider();
    } else {
      this.cryptoTransferProvider = new NotConfiguredCryptoTransferProvider();
    }
  }

  /**
   * Create a fiat->crypto quote using existing ExchangeService rates.
   */
  async getQuote(
    fromCurrency: any,
    asset: any,
    amount: Prisma.Decimal
  ) {
    return this.exchangeService.calculateQuote(fromCurrency, asset, amount);
  }

  /**
   * Execute a fiat->crypto settlement for an existing verified transaction.
   * This method is intentionally minimal: it creates a conversion record,
   * validates destination address, requests the crypto transfer via the
   * configured `cryptoTransferProvider`, and records metadata on the
   * originating transaction.
   */
  async executeSettlement(
    paymentIntentId: string,
    options: {
      transactionId: string;
      asset?: string;
      network?: string;
      destinationAddress?: string;
    }
  ) {
    const paymentIntent = await this.paymentService.getPaymentIntent(
      paymentIntentId
    );

    if (!paymentIntent) throw new Error("Payment Intent not found.");

    const asset = String(options.asset ?? "USDT").toUpperCase();
    const network = String(options.network ?? "TRON").toUpperCase();
    const destination = options.destinationAddress ?? "";

    if (!destination.trim()) {
      throw new Error("Destination address is required for crypto settlement.");
    }

    // ensure transaction exists
    const transaction = await this.paymentService.findTransactionById(
      options.transactionId
    );

    if (!transaction) throw new Error("Transaction not found.");


    // Select provider: prefer an active ExchangeProvider from the DB.
    let providerInstance: any;
    let dbProvider: any = null;

    if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
      providerInstance = new MockCryptoProvider();
    } else {
      dbProvider = await this.app.prisma.exchangeProvider.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });

      if (!dbProvider) {
        throw new Error("No active exchange provider is configured for crypto settlement.");
      }

      providerInstance = new GenericHttpCryptoProvider({
        baseUrl: dbProvider.baseUrl ?? "",
        apiKey: dbProvider.apiKey ?? undefined,
        apiSecret: dbProvider.apiSecret ?? undefined,
        metadata: dbProvider.metadata ?? undefined,
      });
    }

    // Create a persisted live quote (reservation) and enforce expiry
    const quoteRecord = await this.exchangeService.createQuote({
      fromCurrency: paymentIntent.currency as any,
      toCurrency: asset as any,
      amount: new Prisma.Decimal(Number(paymentIntent.amount)),
      provider: dbProvider?.name ?? "smartpos",
      ttlSeconds: 30,
      metadata: {
        paymentIntentId: paymentIntent.id,
        destinationAddress: destination,
        network,
        asset,
      } as unknown as Prisma.JsonValue,
    });

    if (quoteRecord.expiresAt && new Date(quoteRecord.expiresAt) <= new Date()) {
      throw new Error("Quote expired immediately after creation.");
    }

    // Create conversion record referencing the quote
    const conversion = await this.exchangeService.createConversion({
      merchantId: paymentIntent.merchantId,
      transactionId: transaction.id,
      fromCurrency: paymentIntent.currency as any,
      toCurrency: asset as any,
      fromAmount: new Prisma.Decimal(Number(paymentIntent.amount)),
      exchangeProvider: dbProvider?.name ?? "smartpos",
      metadata: {
        paymentIntentId: paymentIntent.id,
        destinationAddress: destination,
        network,
        asset,
        quoteId: quoteRecord.id,
      } as unknown as Prisma.JsonValue,
    });

    // Validate address if provider supports it
    if (typeof providerInstance.validateAddress === "function") {
      const addressValid = await providerInstance.validateAddress({ asset, network, address: destination });

      if (!addressValid) {
        await this.exchangeService.failConversion(conversion.id);

        return {
          success: false,
          message: "Destination address invalid",
          conversion,
        } as const;
      }
    }

    // If provider supports OTC flow (quote + execute), use that. Otherwise fall back to sendTransaction.
    let sendResult: any;

    if (typeof (providerInstance as any).requestQuote === "function" && typeof (providerInstance as any).executeSwap === "function") {
      // If provider supports server-side quote execution, prefer it.
      try {
        const providerQuote = await (providerInstance as any).requestQuote({
          fiatAmount: Number(paymentIntent.amount),
          fiatCurrency: String(paymentIntent.currency),
          asset,
          network,
          reference: transaction.reference ?? paymentIntent.id,
        });

        // update conversion metadata with providerQuote
        await this.app.prisma.cryptoConversion.update({ where: { id: conversion.id }, data: { metadata: { ...(conversion.metadata as any), providerQuote } } });

        const exec = await (providerInstance as any).executeSwap({
          providerQuoteId: providerQuote.providerQuoteId,
          fiatAmount: Number(paymentIntent.amount),
          fiatCurrency: String(paymentIntent.currency),
          asset,
          network,
          destination,
          reference: transaction.reference ?? paymentIntent.id,
        });

        sendResult = exec;

        // if provider returned a providerTxId/txHash, persist a blockchainTransaction record
        if (exec && (exec.transactionHash || exec.providerTxId)) {
          const blockchain = await this.app.prisma.blockchainNetwork.findFirst({ where: { name: network } });

          const bc = await this.blockchainService.createTransaction({
            blockchain: blockchain?.id ?? "unknown",
            fromAddress: dbProvider?.metadata?.fromAddress ?? "",
            toAddress: destination,
            amount: new Prisma.Decimal(exec.cryptoAmount ?? providerQuote.cryptoAmount ?? 0),
            currency: asset,
            fee: new Prisma.Decimal(0),
            payload: exec.raw ?? Prisma.JsonNull,
            metadata: { providerTxId: exec.providerTxId } as unknown as Prisma.JsonValue,
            // provide txHash when available
            txHash: exec.transactionHash ?? exec.providerTxId,
          } as any);

          // link blockchain transaction to conversion
          await this.app.prisma.cryptoConversion.update({ where: { id: conversion.id }, data: { blockchainTransactionId: bc.id } });
        }
      } catch (err) {
        await this.exchangeService.failConversion(conversion.id);

        return {
          success: false,
          message: err instanceof Error ? err.message : "provider execution failed",
          conversion,
          raw: err,
        } as const;
      }
    } else {
      // Send crypto transaction using selected provider
      sendResult = await providerInstance.sendTransaction({
        asset,
        network,
        toAddress: destination,
        amount: quoteRecord.quoteAmount,
        reference: transaction.reference ?? paymentIntent.id,
      });
    }

    if (!sendResult.success) {
      await this.exchangeService.failConversion(conversion.id);

      return {
        success: false,
        message: sendResult.message,
        conversion,
        raw: sendResult.raw,
      } as const;
    }

    // Update conversion and ledger references. The blockchain tx/hash is
    // provider-dependent; we persist in metadata and leave richer
    // wallet-transfer bookkeeping to BlockchainService if available.
    await this.exchangeService.completeConversion(conversion.id);

    // record on transaction metadata
    const existingMeta =
      transaction.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
        ? transaction.metadata
        : {};

    const updatedMeta = JSON.parse(
      JSON.stringify({
        ...(existingMeta as Record<string, unknown>),
        cryptoSettlement: {
          asset,
          network,
          destination,
          status: sendResult.status,
          transactionHash: sendResult.transactionHash,
          raw: sendResult.raw,
        },
      })
    );

    await this.app.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        metadata: updatedMeta,
        cryptoCurrency: asset as any,
        cryptoAmount: new Prisma.Decimal(quoteRecord.quoteAmount.toString()),
      },
    });

    return {
      success: true,
      message: "Crypto transfer initiated",
      conversion,
      sendResult,
    } as const;
  }
}
