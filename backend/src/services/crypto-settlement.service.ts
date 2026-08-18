import { Prisma } from "@prisma/client";
import PaymentService from "./payment.service.js";
import ExchangeService from "./exchange.service.js";
import BlockchainService from "./blockchain.service.js";
import { GenericHttpCryptoProvider, NotConfiguredCryptoTransferProvider } from "../providers/crypto-transfer.provider.js";

export default class CryptoSettlementService {
  private readonly paymentService: PaymentService;
  private readonly exchangeService: ExchangeService;
  private readonly blockchainService: BlockchainService;
  private readonly cryptoTransferProvider: any;

  constructor(private readonly app: any) {
    this.paymentService = new PaymentService(app);
    this.exchangeService = new ExchangeService(app);
    this.blockchainService = new BlockchainService(app);

    // Real settlement is never allowed to run through a fake/mock blockchain path.
    // Keep the explicit not-configured provider as the default to surface a clear
    // production failure rather than silently succeeding with fabricated hashes.
    this.cryptoTransferProvider = new NotConfiguredCryptoTransferProvider();
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
  async resolveSettlementDestination(
    paymentIntent: any,
    options: {
      walletId?: string;
      destinationAddress?: string;
      network?: string;
      asset?: string;
    }
  ) {
    const walletId = (options.walletId ?? "").trim();
    const inputAddress = (options.destinationAddress ?? "").trim();
    const network = String(options.network ?? "ETHEREUM").toUpperCase();
    const asset = String(options.asset ?? "USDT").toUpperCase();

    if (walletId) {
      const wallet = await this.app.prisma.wallet.findFirst({
        where: {
          id: walletId,
          merchantId: paymentIntent.merchantId,
        },
        include: {
          blockchain: true,
          walletAddresses: true,
        },
      });

      if (!wallet) {
        throw new Error("The destination wallet does not belong to the merchant or does not exist.");
      }

      const walletNetwork = String(wallet.blockchain?.name ?? wallet.metadata?.network ?? "").toUpperCase();
      if (walletNetwork && walletNetwork !== network) {
        throw new Error(`Destination wallet network mismatch: wallet is on ${walletNetwork}, settlement requested for ${network}.`);
      }

      const walletAsset = String(wallet.currency ?? wallet.metadata?.asset ?? "").toUpperCase();
      if (walletAsset && walletAsset !== asset) {
        throw new Error(`Destination wallet asset mismatch: wallet holds ${walletAsset}, settlement requested for ${asset}.`);
      }

      const walletAddress = wallet.address || wallet.walletAddresses?.[0]?.address || "";
      const resolved = walletAddress.trim();

      if (!resolved) {
        throw new Error("Selected merchant wallet does not have a valid settlement address.");
      }

      if (inputAddress && inputAddress !== resolved) {
        throw new Error("Destination address does not match the selected merchant wallet address.");
      }

      return { destination: resolved, wallet };
    }

    if (!inputAddress) {
      throw new Error("Destination address is required for crypto settlement.");
    }

    return { destination: inputAddress, wallet: null };
  }

  async executeSettlement(
    paymentIntentId: string,
    options: {
      transactionId: string;
      asset?: string;
      network?: string;
      destinationAddress?: string;
      walletId?: string;
    }
  ) {
    const paymentIntent = await this.paymentService.getPaymentIntent(
      paymentIntentId
    );

    if (!paymentIntent) throw new Error("Payment Intent not found.");

    if (!options.transactionId) {
      throw new Error("Transaction ID is required for crypto settlement.");
    }

    const asset = String(options.asset ?? "USDT").toUpperCase();
    const network = String(options.network ?? "ETHEREUM").toUpperCase();
    const transaction = await this.paymentService.findTransactionById(
      options.transactionId
    );

    if (!transaction) throw new Error("Transaction not found.");

    const destinationResolution = await this.resolveSettlementDestination(paymentIntent, {
      walletId: options.walletId,
      destinationAddress: options.destinationAddress,
      network,
      asset,
    });

    const destination = destinationResolution.destination;
    const wallet = destinationResolution.wallet;

    if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
      throw new Error("Mock crypto settlement is disabled. Set USE_MOCK_CRYPTO_PROVIDER=false and configure a real crypto transfer provider or RPC signer.");
    }

    const dbProvider = await this.app.prisma.exchangeProvider.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!dbProvider) {
      throw new Error("No active exchange provider is configured for crypto settlement.");
    }

    const providerInstance = new GenericHttpCryptoProvider({
      baseUrl: dbProvider.baseUrl ?? "",
      apiKey: dbProvider.apiKey ?? undefined,
      apiSecret: dbProvider.apiSecret ?? undefined,
      metadata: dbProvider.metadata ?? undefined,
    });

    const settlementReference = `USDT-${paymentIntent.id}-${transaction.id}`;

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

    if (typeof providerInstance.validateAddress === "function") {
      const addressValid = await providerInstance.validateAddress({ asset, network, address: destination });
      if (!addressValid) {
        await this.exchangeService.failConversion(conversion.id);
        return { success: false, message: "Destination address invalid", conversion } as const;
      }
    }

    let sendResult: any;
    if (typeof (providerInstance as any).requestQuote === "function" && typeof (providerInstance as any).executeSwap === "function") {
      try {
        const providerQuote = await (providerInstance as any).requestQuote({
          fiatAmount: Number(paymentIntent.amount),
          fiatCurrency: String(paymentIntent.currency),
          asset,
          network,
          reference: transaction.reference ?? paymentIntent.id,
        });

        await this.app.prisma.cryptoConversion.update({
          where: { id: conversion.id },
          data: { metadata: { ...(conversion.metadata as any), providerQuote } },
        });

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

    const blockchainTransfer = await this.blockchainService.sendUsdtTransfer({
      merchantId: paymentIntent.merchantId,
      walletId: wallet?.id,
      network,
      asset,
      amount: new Prisma.Decimal(String(quoteRecord.quoteAmount)),
      destinationAddress: destination,
      reference: settlementReference,
      metadata: {
        paymentIntentId: paymentIntent.id,
        transactionId: transaction.id,
        conversionId: conversion.id,
        quoteId: quoteRecord.id,
      },
    });

    await this.exchangeService.completeConversion(conversion.id);

    const existingMeta = transaction.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
      ? transaction.metadata
      : {};

    const updatedMeta = JSON.parse(JSON.stringify({
      ...(existingMeta as Record<string, unknown>),
      cryptoSettlement: {
        asset,
        network,
        destination,
        status: blockchainTransfer.result.status,
        transactionHash: blockchainTransfer.txHash,
        raw: blockchainTransfer.result.raw,
      },
    }));

    await this.app.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        metadata: updatedMeta,
        cryptoCurrency: asset as any,
        cryptoAmount: new Prisma.Decimal(quoteRecord.quoteAmount.toString()),
        blockchainTransactionId: blockchainTransfer.blockchainTransactionId,
      },
    });

    return {
      success: true,
      message: "USDT transfer broadcast and awaiting confirmations",
      conversion,
      sendResult: blockchainTransfer.result,
      transactionHash: blockchainTransfer.txHash,
      blockchainTransactionId: blockchainTransfer.blockchainTransactionId,
      confirmations: blockchainTransfer.confirmations,
      requiredConfirmations: blockchainTransfer.requiredConfirmations,
    } as const;
  }
}
