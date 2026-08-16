import { Prisma } from "@prisma/client";
import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import WalletService from "../services/wallet.service.js";
import type {
  CreateWalletBody,
} from "../types/wallet.js";

const SENSITIVE_WALLET_FIELDS = new Set([
  "encryptedPrivateKey",
  "privateKey",
  "privateKeyEncrypted",
  "seedPhrase",
  "mnemonic",
  "secretKey",
  "secret",
  "walletSecret",
  "signingKey",
]);

function sanitizeWalletValue(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeWalletValue(item)
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    const source =
      value as Record<string, unknown>;

    const result: Record<
      string,
      unknown
    > = {};

    for (const [key, item] of Object.entries(
      source
    )) {
      if (
        SENSITIVE_WALLET_FIELDS.has(key)
      ) {
        continue;
      }

      result[key] =
        sanitizeWalletValue(item);
    }

    return result;
  }

  return value;
}

function sanitizeWallet(
  wallet: unknown
): unknown {
  return sanitizeWalletValue(wallet);
}

function sanitizeWallets(
  wallets: unknown[]
): unknown[] {
  return wallets.map((wallet) =>
    sanitizeWallet(wallet)
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    const value =
      error as Record<string, unknown>;

    if (
      typeof value.message === "string" &&
      value.message.trim()
    ) {
      return value.message;
    }

    if (
      typeof value.error === "string" &&
      value.error.trim()
    ) {
      return value.error;
    }
  }

  return "Wallet request failed.";
}

function getMerchantIdFromRequest(
  request: FastifyRequest
): string | undefined {
  const params =
    request.params as
      | Record<string, unknown>
      | undefined;

  if (
    params &&
    typeof params.merchantId === "string" &&
    params.merchantId.trim()
  ) {
    return params.merchantId.trim();
  }

  const user =
    request.user as
      | Record<string, unknown>
      | undefined;

  if (!user) {
    return undefined;
  }

  const directMerchantId =
    user.merchantId;

  if (
    typeof directMerchantId === "string" &&
    directMerchantId.trim()
  ) {
    return directMerchantId.trim();
  }

  const nestedMerchant =
    user.merchant;

  if (
    nestedMerchant &&
    typeof nestedMerchant === "object"
  ) {
    const merchant =
      nestedMerchant as Record<
        string,
        unknown
      >;

    if (
      typeof merchant.id === "string" &&
      merchant.id.trim()
    ) {
      return merchant.id.trim();
    }
  }

  return undefined;
}

export default class WalletController {
  constructor(
    private readonly walletService: WalletService
  ) {}

  /**
   * Create a merchant-owned settlement wallet record.
   *
   * SmartPOS never generates a wallet address.
   *
   * The merchant supplies an existing public address.
   * WalletService validates the address for the
   * selected network and persists it atomically.
   */
  create = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const merchantId =
        getMerchantIdFromRequest(request);

      if (!merchantId) {
        return reply.code(401).send({
          success: false,
          error:
            "Authenticated merchant account is required.",
        });
      }

      const body =
        (request.body ?? {}) as CreateWalletBody;

      const wallet =
        await this.walletService.createWallet({
          ...body,
          merchantId,
        });

      if (!wallet) {
        return reply.code(500).send({
          success: false,
          error:
            "Wallet could not be created.",
        });
      }

      return reply.code(201).send({
        success: true,
        data: sanitizeWallet(wallet),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet creation failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };

  /**
   * Transfer funds between internal SmartPOS
   * balance records.
   */
  transferFunds = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const body =
        (request.body ?? {}) as {
          fromWalletId?: string;
          toWalletId?: string;
          amount?: number | string;
        };

      if (
        !body.fromWalletId ||
        !body.toWalletId
      ) {
        return reply.code(400).send({
          success: false,
          error:
            "Source and destination wallets are required.",
        });
      }

      if (
        body.amount === undefined ||
        body.amount === null ||
        body.amount === ""
      ) {
        return reply.code(400).send({
          success: false,
          error: "Transfer amount is required.",
        });
      }

      const result =
        await this.walletService.transferFunds(
          body.fromWalletId,
          body.toWalletId,
          new Prisma.Decimal(body.amount)
        );

      return reply.send({
        success: true,
        data: sanitizeWallet(result),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet transfer failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };

  /**
   * Credit an internal SmartPOS wallet balance.
   */
  credit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { id } =
        (request.params ?? {}) as {
          id?: string;
        };

      const body =
        (request.body ?? {}) as {
          amount?: number | string;
        };

      if (!id) {
        return reply.code(400).send({
          success: false,
          error: "Wallet ID is required.",
        });
      }

      if (
        body.amount === undefined ||
        body.amount === null ||
        body.amount === ""
      ) {
        return reply.code(400).send({
          success: false,
          error: "Credit amount is required.",
        });
      }

      const wallet =
        await this.walletService.creditWallet(
          id,
          new Prisma.Decimal(body.amount)
        );

      return reply.send({
        success: true,
        data: sanitizeWallet(wallet),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet credit failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };

  /**
   * Debit an internal SmartPOS wallet balance.
   */
  debit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { id } =
        (request.params ?? {}) as {
          id?: string;
        };

      const body =
        (request.body ?? {}) as {
          amount?: number | string;
        };

      if (!id) {
        return reply.code(400).send({
          success: false,
          error: "Wallet ID is required.",
        });
      }

      if (
        body.amount === undefined ||
        body.amount === null ||
        body.amount === ""
      ) {
        return reply.code(400).send({
          success: false,
          error: "Debit amount is required.",
        });
      }

      const wallet =
        await this.walletService.debitWallet(
          id,
          new Prisma.Decimal(body.amount)
        );

      return reply.send({
        success: true,
        data: sanitizeWallet(wallet),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet debit failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };

  /**
   * Get one wallet.
   */
  get = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { id } =
        (request.params ?? {}) as {
          id?: string;
        };

      if (!id) {
        return reply.code(400).send({
          success: false,
          error: "Wallet ID is required.",
        });
      }

      const wallet =
        await this.walletService.getWallet(id);

      if (!wallet) {
        return reply.code(404).send({
          success: false,
          error: "Wallet not found.",
        });
      }

      return reply.send({
        success: true,
        data: sanitizeWallet(wallet),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet retrieval failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };

  /**
   * Get all wallets belonging to a merchant.
   *
   * merchantId is preferably obtained from the
   * authenticated user. A route merchantId parameter
   * is supported for compatibility with the existing
   * route structure.
   */
  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const merchantId =
        getMerchantIdFromRequest(request);

      if (!merchantId) {
        return reply.code(401).send({
          success: false,
          error:
            "Authenticated merchant account is required.",
        });
      }

      const wallets =
        await this.walletService.merchantWallets(
          merchantId
        );

      return reply.send({
        success: true,
        data: sanitizeWallets(
          wallets ?? []
        ),
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Merchant wallet retrieval failed"
      );

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}