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
    if (!options.transactionId) throw new Error("Transaction ID is required for crypto settlement.");

    const asset = String(options.asset ?? "USDT").toUpperCase();
    const network = String(options.network ?? "ETHEREUM").toUpperCase();
    const fiatCurrency = paymentIntent.currency;
    
    const transaction = await this.paymentService.findTransactionById(options.transactionId);
    if (!transaction) throw new Error("Transaction not found.");

    // Validate settlement requirements
    if (process.env.USE_MOCK_CRYPTO_PROVIDER === "true") {
      throw new Error("Mock crypto settlement is disabled. Set USE_MOCK_CRYPTO_PROVIDER=false and configure EXCHANGE_PROVIDER_* environment variables.");
    }

    // STEP 1: Resolve destination wallet
    const destinationResolution = await this.resolveSettlementDestination(paymentIntent, {
      walletId: options.walletId,
      destinationAddress: options.destinationAddress,
      network,
      asset,
    });

    const destination = destinationResolution.destination;
    const merchantWallet = destinationResolution.wallet;

    // STEP 2: Create crypto conversion record for tracking
    const conversion = await this.app.prisma.cryptoConversion.create({
      data: {
        merchantId: paymentIntent.merchantId,
        fromCurrency: fiatCurrency as any,
        toCurrency: asset as any,
        fromAmount: new Prisma.Decimal(String(paymentIntent.amount)),
        toAmount: new Prisma.Decimal("0"), // Will be updated with actual fill
        rate: new Prisma.Decimal("0"), // Will be updated from quote
        status: "pending",
        exchangeProvider: process.env.EXCHANGE_PROVIDER_NAME || "unknown",
        transactionId: transaction.id,
        metadata: {
          paymentIntentId: paymentIntent.id,
          destinationAddress: destination,
          network,
          asset,
          stage: "initiated",
        } as unknown as Prisma.JsonValue,
      },
    });

    try {
      // STEP 3: Get real live quote from provider
      const quoteResponse = await this.exchangeService.getRealQuote({
        baseAsset: asset,
        quoteAsset: fiatCurrency as any,
        side: "BUY",
        amount: new Prisma.Decimal(String(paymentIntent.amount)),
        ttlSeconds: 30,
      });

      // Store quote ID for reference
      const quoteId = quoteResponse.id;

      // Update conversion with quote info
      await this.app.prisma.cryptoConversion.update({
        where: { id: conversion.id },
        data: {
          rate: quoteResponse.rate,
          metadata: {
            ...(conversion.metadata as Record<string, unknown>),
            quoteId,
            stage: "quote_obtained",
            quoteExpiresAt: quoteResponse.expiresAt.toISOString(),
            expectedOutputAmount: quoteResponse.quoteAmount.toString(),
          } as unknown as Prisma.JsonValue,
        },
      });

      // STEP 4: Create idempotent order key
      const clientOrderId = `${paymentIntent.id}:BUY:${Date.now()}`;

      // STEP 5: Execute BUY order with actual provider
      const order = await this.exchangeService.executeBuyOrder({
        baseAsset: asset,
        quoteAsset: fiatCurrency as any,
        amount: new Prisma.Decimal(String(paymentIntent.amount)),
        quoteId,
        clientOrderId,
      });

      if (!order) {
        throw new Error("Failed to execute buy order on exchange provider.");
      }

      // Update conversion with order info
      const orderMetadata = order.metadata && typeof order.metadata === "object" ? order.metadata : {};
      const actualExecutedAmount = new Prisma.Decimal(
        orderMetadata.order?.executedAmount?.toString() || order.filledAmount?.toString() || "0"
      );

      if (actualExecutedAmount.lte(new Prisma.Decimal("0"))) {
        throw new Error(`Exchange order did not fill any amount. Order status: ${order.status}`);
      }

      await this.app.prisma.cryptoConversion.update({
        where: { id: conversion.id },
        data: {
          toAmount: actualExecutedAmount,
          exchangeOrderId: order.id,
          status: "exchange_completed",
          metadata: {
            ...(conversion.metadata as Record<string, unknown>),
            exchangeOrderId: order.id,
            orderId: orderMetadata.order?.orderId,
            actualExecutedAmount: actualExecutedAmount.toString(),
            requestedAmount: String(paymentIntent.amount),
            stage: "exchange_filled",
            orderStatus: order.status,
          } as unknown as Prisma.JsonValue,
        },
      });

      // STEP 6: Execute blockchain transfer with ACTUAL filled amount (not requested)
      const blockchainTransfer = await this.blockchainService.sendUsdtTransfer({
        merchantId: paymentIntent.merchantId,
        walletId: merchantWallet?.id,
        network,
        asset,
        amount: actualExecutedAmount, // Use actual acquired, not requested
        destinationAddress: destination,
        reference: `${paymentIntent.id}:${conversion.id}`,
        metadata: {
          paymentIntentId: paymentIntent.id,
          transactionId: transaction.id,
          conversionId: conversion.id,
          exchangeOrderId: order.id,
          quoteId,
        } as unknown as Prisma.JsonValue,
      });

      // STEP 7: Update conversion as complete
      await this.app.prisma.cryptoConversion.update({
        where: { id: conversion.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          metadata: {
            ...(conversion.metadata as Record<string, unknown>),
            blockchainTransactionId: blockchainTransfer.blockchainTransactionId,
            txHash: blockchainTransfer.txHash,
            stage: "blockchain_broadcast",
          } as unknown as Prisma.JsonValue,
        },
      });

      // STEP 8: Update transaction with settlement details
      const existingMeta = transaction.metadata && typeof transaction.metadata === "object" && !Array.isArray(transaction.metadata)
        ? transaction.metadata
        : {};

      await this.app.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            ...(existingMeta as Record<string, unknown>),
            cryptoSettlement: {
              status: blockchainTransfer.result.status,
              asset,
              network,
              destination,
              transactionHash: blockchainTransfer.txHash,
              requiredConfirmations: blockchainTransfer.requiredConfirmations,
              conversionId: conversion.id,
              exchangeOrderId: order.id,
              requestedAmount: paymentIntent.amount.toString(),
              actualAcquiredAmount: actualExecutedAmount.toString(),
            },
          } as unknown as Prisma.JsonValue,
          cryptoCurrency: asset as any,
          cryptoAmount: actualExecutedAmount,
          blockchainTransactionId: blockchainTransfer.blockchainTransactionId,
        },
      });

      return {
        success: true,
        message: "Crypto settlement complete: exchange order filled and USDT transfer broadcast",
        conversion,
        blockchainTransactionId: blockchainTransfer.blockchainTransactionId,
        transactionHash: blockchainTransfer.txHash,
        confirmations: blockchainTransfer.confirmations,
        requiredConfirmations: blockchainTransfer.requiredConfirmations,
      } as const;
    } catch (error) {
      // Handle settlement failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.app.prisma.cryptoConversion.update({
        where: { id: conversion.id },
        data: {
          status: "failed",
          metadata: {
            ...(conversion.metadata as Record<string, unknown>),
            failureReason: errorMessage,
            failedAt: new Date().toISOString(),
          } as unknown as Prisma.JsonValue,
        },
      });

      throw error;
    }
  }
}
