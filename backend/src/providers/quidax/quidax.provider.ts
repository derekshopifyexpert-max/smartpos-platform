import { Prisma } from "@prisma/client";

import {
  IExchangeProvider,
  normalizeOrderStatus,
  type CryptoOrderRequest,
  type CryptoOrderResponse,
  type CryptoQuoteRequest,
  type CryptoQuoteResponse,
  type ProviderAccountInfo,
  type ProviderBalance,
} from "../exchange-provider.interface.js";

import { QuidaxClient } from "./quidax.client.js";

import {
  QuidaxConfigurationError,
  QuidaxProviderError,
} from "./quidax.errors.js";

import type {
  QuidaxBalanceRecord,
  QuidaxConfig,
  QuidaxProvider,
  QuidaxWithdrawal,
  QuidaxWithdrawalRequest,
} from "./quidax.types.js";

function record(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const body = record(value);

  for (const key of [
    "data",
    "items",
    "results",
    "markets",
    "assets",
    "balances",
    "trades",
  ]) {
    if (Array.isArray(body[key])) {
      return body[key] as unknown[];
    }
  }

  return [];
}

function apiData(value: unknown): unknown {
  const body = record(value);

  if (body.status === "error") {
    const details = record(body.data);

    throw new QuidaxProviderError(
      String(
        details.message ??
          body.message ??
          "Quidax request failed."
      ),
      {
        code: String(
          details.code ??
            "QUIDAX_API_ERROR"
        ),
      }
    );
  }

  return body.data ?? value;
}

function requiredString(
  value: unknown,
  field: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new QuidaxProviderError(
      `Quidax response did not include ${field}.`,
      {
        code: "QUIDAX_INVALID_RESPONSE",
      }
    );
  }

  return value;
}

function decimal(
  value: unknown,
  field: string
): Prisma.Decimal {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new QuidaxProviderError(
      `Quidax response did not include ${field}.`,
      {
        code: "QUIDAX_INVALID_RESPONSE",
      }
    );
  }

  try {
    return new Prisma.Decimal(
      String(value)
    );
  } catch {
    throw new QuidaxProviderError(
      `Quidax response contained an invalid ${field}.`,
      {
        code: "QUIDAX_INVALID_RESPONSE",
      }
    );
  }
}

function bodyData(
  value: unknown
): Record<string, unknown> {
  const body = record(value);

  return record(
    body.data ?? body
  );
}

function firstString(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value;
    }

    if (
      typeof value === "number"
    ) {
      return String(value);
    }
  }

  return undefined;
}

function firstNumber(
  source: Record<string, unknown>,
  keys: string[]
): Prisma.Decimal | undefined {
  const value = firstString(
    source,
    keys
  );

  if (value === undefined) {
    return undefined;
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    return undefined;
  }
}

function normalizeNetwork(
  network?: string
): string {
  if (!network) {
    /**
     * Quidax documents a network as required for the Ramp
     * purchase quote. For SmartPOS, defaulting to tron is
     * intentionally NOT done silently.
     */
    throw new QuidaxProviderError(
      "A crypto network is required for a Quidax Ramp quote.",
      {
        code:
          "QUIDAX_RAMP_NETWORK_REQUIRED",
        category:
          "INVALID_REQUEST",
      }
    );
  }

  return network
    .trim()
    .toLowerCase();
}

export class QuidaxProviderAdapter
  implements QuidaxProvider {

  readonly name = "QUIDAX";

  private readonly client: QuidaxClient;

  private readonly config: QuidaxConfig;

  constructor(
    config: QuidaxConfig
  ) {
    this.config = config;

    this.client =
      new QuidaxClient(config);
  }

  async getAccountInfo(): Promise<ProviderAccountInfo> {
    const balances =
      await this.getBalances();

    return {
      accountId: "UNAVAILABLE",

      accountName:
        "Quidax account unavailable",

      status: "ACTIVE",

      balances:
        balances.map(
          (balance) =>
            this.toBalance(balance)
        ),
    };
  }

  async getBalances(): Promise<QuidaxBalanceRecord[]> {
    const response =
      await this.client.request<unknown>({
        method: "GET",
        url: "/users/me/wallets",
      });

    const data =
      apiData(response);

    if (!Array.isArray(data)) {
      throw new QuidaxProviderError(
        "Quidax wallets response was malformed.",
        {
          code:
            "QUIDAX_INVALID_RESPONSE",
        }
      );
    }

    return data.map((item) => {
      const value =
        record(item);

      return {
        asset:
          requiredString(
            value.currency,
            "wallet currency"
          ),

        available:
          requiredString(
            value.balance,
            "wallet balance"
          ),

        locked:
          typeof value.locked ===
          "string"
            ? value.locked
            : undefined,

        total:
          typeof value.balance ===
          "string"
            ? value.balance
            : undefined,

        updatedAt:
          typeof value.updated_at ===
          "string"
            ? value.updated_at
            : undefined,
      };
    });
  }

  async getBalance(
    asset: string
  ): Promise<ProviderBalance> {
    const balances =
      await this.getBalances();

    const balance =
      balances.find(
        (item) =>
          item.asset.toUpperCase() ===
          asset.toUpperCase()
      );

    if (!balance) {
      throw new QuidaxProviderError(
        `Quidax wallet for ${asset} was not found.`,
        {
          code:
            "ASSET_UNSUPPORTED",
        }
      );
    }

    return this.toBalance(
      balance
    );
  }

  /**
   * Quidax Ramp BUY quote.
   *
   * Current documented endpoint:
   *
   * POST
   * /api/v1/merchants/purchase_quotes/buy
   *
   * Query parameters:
   * currency
   * token
   * fiat_amount
   * token_network
   *
   * Authentication:
   * x-private-key
   */
  async getQuote(
    request: CryptoQuoteRequest
  ): Promise<CryptoQuoteResponse> {
    if (
      request.side !== "BUY"
    ) {
      throw new QuidaxProviderError(
        "Quidax Ramp quote integration currently supports BUY quotes only.",
        {
          code:
            "QUIDAX_RAMP_BUY_ONLY",
          category:
            "CAPABILITY_NOT_SUPPORTED",
        }
      );
    }

    return this.getRampQuote(
      request
    );
  }

  async getRampQuote(
    request: CryptoQuoteRequest & {
      network?: string;
    }
  ): Promise<CryptoQuoteResponse> {
    if (!this.config.rampBaseUrl) {
      throw new QuidaxConfigurationError(
        "QUIDAX_RAMP_BASE_URL is not configured."
      );
    }

    if (!this.config.rampPrivateKey) {
      throw new QuidaxConfigurationError(
        "QUIDAX_PRIVATE_KEY is not configured."
      );
    }

    const fiat =
      request.quoteAsset
        .trim()
        .toLowerCase();

    const token =
      request.baseAsset
        .trim()
        .toLowerCase();

    const network =
      normalizeNetwork(
        request.network
      );

    /**
     * Current Quidax Ramp purchase quote documentation
     * supports NGN and GHS as fiat currencies.
     */
    if (
      !["ngn", "ghs"].includes(
        fiat
      )
    ) {
      throw new QuidaxProviderError(
        `Quidax Ramp purchase quotes currently support NGN and GHS, not ${request.quoteAsset}.`,
        {
          code:
            "QUIDAX_RAMP_FIAT_UNSUPPORTED",
          category:
            "CAPABILITY_NOT_SUPPORTED",
        }
      );
    }

    /**
     * Current documented purchase quote tokens.
     */
    if (
      ![
        "usdt",
        "usdc",
        "xaut",
        "usat",
      ].includes(token)
    ) {
      throw new QuidaxProviderError(
        `Quidax Ramp purchase quotes do not support ${request.baseAsset}.`,
        {
          code:
            "QUIDAX_RAMP_TOKEN_UNSUPPORTED",
          category:
            "CAPABILITY_NOT_SUPPORTED",
        }
      );
    }

    if (
      request.amount.lte(
        new Prisma.Decimal("0")
      )
    ) {
      throw new QuidaxProviderError(
        "Quote amount must be greater than zero.",
        {
          code:
            "QUIDAX_INVALID_AMOUNT",
          category:
            "INVALID_REQUEST",
        }
      );
    }

    try {
      const response =
        await this.client.rampRequest<unknown>({
          method: "POST",

          url:
            "/merchants/purchase_quotes/buy",

          params: {
            currency: fiat,
            token,
            fiat_amount:
              request.amount.toString(),
            token_network: network,
          },
        });

      const body =
        record(response);

      if (
        body.status ===
        "error"
      ) {
        const details =
          record(body.data);

        throw new QuidaxProviderError(
          String(
            details.message ??
              body.message ??
              "Quidax Ramp quote failed."
          ),
          {
            code:
              String(
                details.code ??
                  "QUIDAX_RAMP_QUOTE_FAILED"
              ),
            category:
              "RAMP_QUOTE_FAILED",
          }
        );
      }

      const data =
        bodyData(response);

      /**
       * Quidax's Ramp response has changed shape across
       * API revisions. Normalize known field names while
       * preserving the raw response in metadata.
       */
      const quoteId =
        firstString(
          data,
          [
            "quote_id",
            "quoteId",
            "id",
            "public_id",
            "reference",
          ]
        );

      if (!quoteId) {
        throw new QuidaxProviderError(
          "Quidax Ramp quote response did not include a quote identifier.",
          {
            code:
              "QUIDAX_INVALID_RESPONSE",
          }
        );
      }

      const tokenAmount =
        firstString(
          data,
          [
            "token_amount",
            "tokenAmount",
            "crypto_amount",
            "cryptoAmount",
            "receive_amount",
            "receiveAmount",
            "amount",
          ]
        );

      if (!tokenAmount) {
        throw new QuidaxProviderError(
          "Quidax Ramp quote response did not include the crypto amount.",
          {
            code:
              "QUIDAX_INVALID_RESPONSE",
          }
        );
      }

      const price =
        firstNumber(
          data,
          [
            "price",
            "rate",
            "exchange_rate",
            "exchangeRate",
          ]
        );

      const fee =
        firstNumber(
          data,
          [
            "fee",
            "fees",
            "processing_fee",
            "processingFee",
            "fiat_processing_fee",
            "fiatProcessingFee",
          ]
        ) ??
        new Prisma.Decimal("0");

      const expiresInRaw =
        firstString(
          data,
          [
            "expires_in",
            "expiresIn",
            "ttl",
          ]
        );

      const expiresAtRaw =
        firstString(
          data,
          [
            "expires_at",
            "expiresAt",
            "expiry",
            "expires",
          ]
        );

      const expiresIn =
        expiresInRaw
          ? Number(expiresInRaw)
          : 30;

      const providerTimestamp =
        new Date();

      const expiresAt =
        expiresAtRaw &&
        !Number.isNaN(
          Date.parse(expiresAtRaw)
        )
          ? new Date(expiresAtRaw)
          : new Date(
              providerTimestamp.getTime() +
                Math.max(
                  expiresIn,
                  1
                ) *
                  1000
            );

      const outputAmount =
        new Prisma.Decimal(
          tokenAmount
        );

      const effectivePrice =
        price ??
        (
          outputAmount.gt(
            new Prisma.Decimal("0")
          )
            ? request.amount.div(
                outputAmount
              )
            : new Prisma.Decimal("0")
        );

      const feePercentage =
        request.amount.gt(
          new Prisma.Decimal("0")
        )
          ? fee
              .div(request.amount)
              .mul(100)
          : new Prisma.Decimal("0");

      return {
        quoteId,

        provider:
          this.name,

        symbol:
          `${request.baseAsset}_${request.quoteAsset}`,

        baseAsset:
          request.baseAsset.toUpperCase(),

        quoteAsset:
          request.quoteAsset.toUpperCase(),

        side:
          "BUY",

        price:
          effectivePrice,

        inputAmount:
          request.amount,

        outputAmount,

        fee,

        feeCurrency:
          request.quoteAsset.toUpperCase(),

        feePercentage,

        expiresAt,

        expiresIn:
          Math.max(
            1,
            Math.floor(
              (expiresAt.getTime() -
                Date.now()) /
                1000
            )
          ),

        providerTimestamp,

        metadata: {
          provider:
            "QUIDAX_RAMP",

          rampBaseUrl:
            this.config.rampBaseUrl,

          tokenNetwork:
            network,

          raw:
            response,
        },
      };
    } catch (error) {
      if (
        error instanceof
        QuidaxProviderError
      ) {
        throw error;
      }

      throw new QuidaxProviderError(
        `Failed to get Quidax Ramp quote for ${request.baseAsset}/${request.quoteAsset}.`,
        {
          code:
            "QUIDAX_RAMP_QUOTE_FAILED",

          retryable:
            false,

          category:
            "RAMP_QUOTE_FAILED",
        }
      );
    }
  }

  async buy(
    request: CryptoOrderRequest
  ): Promise<CryptoOrderResponse> {
    return this.createOrder({
      ...request,
      side: "BUY",
    });
  }

  async sell(
    request: CryptoOrderRequest
  ): Promise<CryptoOrderResponse> {
    return this.createOrder({
      ...request,
      side: "SELL",
    });
  }

  private async createOrder(
    request: CryptoOrderRequest
  ): Promise<CryptoOrderResponse> {
    const response =
      await this.client.request<unknown>({
        method: "POST",

        url:
          "/users/me/orders",

        data: {
          market:
            `${request.baseAsset}${request.quoteAsset}`
              .toLowerCase(),

          side:
            request.side.toLowerCase(),

          ord_type:
            request.limitPrice
              ? "limit"
              : "market",

          price:
            request.limitPrice?.toString(),

          volume:
            request.amount.toString(),
        },
      });

    return this.normalizeOrder(
      record(
        apiData(response)
      ),
      request
    );
  }

  async getOrder(
    orderId: string
  ): Promise<CryptoOrderResponse> {
    const response =
      await this.client.request<unknown>({
        method: "GET",

        url:
          `/users/me/orders/${encodeURIComponent(
            orderId
          )}`,
      });

    return this.normalizeOrder(
      record(
        apiData(response)
      )
    );
  }

  async getTrades(
    orderId: string
  ): Promise<unknown[]> {
    const order =
      await this.getOrder(
        orderId
      );

    const trades =
      order.metadata?.trades;

    return Array.isArray(
      trades
    )
      ? trades
      : [];
  }

  async getAssets(): Promise<unknown[]> {
    const markets =
      await this.getMarkets();

    const assets =
      new Map<
        string,
        {
          symbol: string;
          markets: string[];
        }
      >();

    for (
      const market of markets
    ) {
      const value =
        record(market);

      const base =
        typeof value.base_unit ===
        "string"
          ? value.base_unit
          : undefined;

      if (!base) {
        continue;
      }

      const existing =
        assets.get(base) ??
        {
          symbol: base,
          markets: [],
        };

      if (
        typeof value.id ===
        "string"
      ) {
        existing.markets.push(
          value.id
        );
      }

      assets.set(
        base,
        existing
      );
    }

    return [
      ...assets.values(),
    ];
  }

  async getMarkets(): Promise<unknown[]> {
    const response =
      await this.client.request<unknown>({
        method: "GET",
        url: "/markets",
      });

    const data =
      apiData(response);

    if (!Array.isArray(data)) {
      throw new QuidaxProviderError(
        "Quidax markets response was malformed.",
        {
          code:
            "QUIDAX_INVALID_RESPONSE",
        }
      );
    }

    return data;
  }

  async getWithdrawalFee(
    asset: string,
    network: string
  ) {
    const response =
      await this.client.request<unknown>({
        method: "GET",

        url:
          `/users/me/fee_rule?currency=${encodeURIComponent(
            asset.toLowerCase()
          )}&amount=0&network=${encodeURIComponent(
            network.toLowerCase()
          )}`,
      });

    const value =
      record(
        apiData(response)
      );

    return {
      asset,
      network,

      fee:
        String(
          value.fee ?? "0"
        ),

      minimum:
        typeof value.minimum ===
        "string"
          ? value.minimum
          : undefined,
    };
  }

  async createWithdrawal(
    request: QuidaxWithdrawalRequest
  ): Promise<QuidaxWithdrawal> {
    const response =
      await this.client.request<unknown>({
        method: "POST",

        url:
          "/users/me/withdraws",

        data: {
          currency:
            request.asset.toLowerCase(),

          amount:
            request.amount,

          fund_uid:
            request.address,

          network:
            request.network,

          reference:
            request.idempotencyKey,
        },
      });

    return this.normalizeWithdrawal(
      record(
        apiData(response)
      )
    );
  }

  async getWithdrawal(
    withdrawalId: string
  ): Promise<QuidaxWithdrawal> {
    const response =
      await this.client.request<unknown>({
        method: "GET",

        url:
          `/users/me/withdraws/${encodeURIComponent(
            withdrawalId
          )}`,
      });

    return this.normalizeWithdrawal(
      record(
        apiData(response)
      )
    );
  }

  private normalizeWithdrawal(
    value: Record<string, unknown>
  ): QuidaxWithdrawal {
    return {
      id:
        requiredString(
          value.id,
          "withdrawal ID"
        ),

      status:
        requiredString(
          value.status,
          "withdrawal status"
        ),

      txHash:
        typeof value.txId ===
        "string"
          ? value.txId
          : undefined,

      fee:
        typeof value.fee ===
          "string" ||
        typeof value.fee ===
          "number"
          ? String(value.fee)
          : undefined,

      amount:
        requiredString(
          value.amount,
          "withdrawal amount"
        ),

      asset:
        requiredString(
          value.currency,
          "withdrawal asset"
        ),

      network:
        typeof value.network ===
        "string"
          ? value.network
          : undefined,

      createdAt:
        typeof value.created_at ===
        "string"
          ? value.created_at
          : undefined,

      updatedAt:
        typeof value.updated_at ===
        "string"
          ? value.updated_at
          : undefined,
    };
  }

  private normalizeOrder(
    value: Record<string, unknown>,
    request?: CryptoOrderRequest
  ): CryptoOrderResponse {
    const orderId =
      requiredString(
        value.id,
        "order ID"
      );

    const side =
      String(
        value.side ??
          request?.side ??
          ""
      ).toUpperCase() as
        | "BUY"
        | "SELL";

    if (
      side !== "BUY" &&
      side !== "SELL"
    ) {
      throw new QuidaxProviderError(
        "Quidax response did not include a valid order side.",
        {
          code:
            "QUIDAX_INVALID_RESPONSE",
        }
      );
    }

    const volume =
      record(
        value.volume
      );

    const originVolume =
      record(
        value.origin_volume
      );

    const executedVolume =
      record(
        value.executed_volume
      );

    const price =
      record(
        value.price
      );

    const avgPrice =
      record(
        value.avg_price
      );

    const requestedAmount =
      decimal(
        originVolume.amount ??
          volume.amount ??
          request?.amount?.toString(),
        "requested amount"
      );

    const executedRaw =
      executedVolume.amount;

    const executedAmount =
      executedRaw === undefined
        ? new Prisma.Decimal("0")
        : decimal(
            executedRaw,
            "executed amount"
          );

    const status =
      normalizeOrderStatus(
        String(
          value.status ?? ""
        ),
        executedAmount,
        requestedAmount
      );

    const priceRaw =
      avgPrice.amount ??
      price.amount;

    const feeRaw =
      value.fee ??
      value.total_fee;

    const market =
      value.market ??
      value.symbol ??
      (
        request
          ? `${request.baseAsset}_${request.quoteAsset}`
          : undefined
      );

    return {
      orderId,

      provider:
        "QUIDAX",

      symbol:
        requiredString(
          typeof market ===
          "object"
            ? record(market).id
            : market,
          "market"
        ),

      baseAsset:
        request?.baseAsset ??
        String(
          record(
            market
          ).base_unit ?? ""
        ),

      quoteAsset:
        request?.quoteAsset ??
        String(
          record(
            market
          ).quote_unit ?? ""
        ),

      side,

      status,

      requestedAmount,

      executedAmount,

      averagePrice:
        priceRaw === undefined
          ? new Prisma.Decimal("0")
          : decimal(
              priceRaw,
              "average price"
            ),

      totalFee:
        feeRaw === undefined
          ? new Prisma.Decimal("0")
          : decimal(
              feeRaw,
              "fee"
            ),

      feeCurrency:
        String(
          value.fee_currency ??
            request?.quoteAsset ??
            ""
        ),

      createdAt:
        value.created_at
          ? new Date(
              String(
                value.created_at
              )
            )
          : new Date(),

      updatedAt:
        value.updated_at
          ? new Date(
              String(
                value.updated_at
              )
            )
          : new Date(),

      metadata: {
        rawStatus:
          value.status,

        trades:
          value.trades,
      },
    };
  }

  private toBalance(
    balance: QuidaxBalanceRecord
  ): ProviderBalance {
    const available =
      new Prisma.Decimal(
        balance.available
      );

    const reserved =
      balance.locked === undefined
        ? new Prisma.Decimal("0")
        : new Prisma.Decimal(
            balance.locked
          );

    const total =
      balance.total === undefined
        ? available.add(
            reserved
          )
        : new Prisma.Decimal(
            balance.total
          );

    return {
      asset:
        balance.asset,

      available,

      reserved,

      total,
    };
  }
}