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

/**
 * Get the merchant ID belonging to the
 * authenticated user.
 *
 * The authenticated identity is authoritative.
 * A route merchantId may only be used as a
 * compatibility check and must never override
 * the authenticated merchant.
 */
function getAuthenticatedMerchantId(
  request: FastifyRequest
): string | undefined {
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

/**
 * Verify that a route merchantId, when supplied,
 * belongs to the authenticated merchant.
 *
 * This prevents a merchant from changing the URL
 * to access another merchant's wallet collection.
 */
function validateMerchantRoute(
  request: FastifyRequest,
  merchantId: string
): string | null {
  const params =
    request.params as
      | Record<string, unknown>
      | undefined;

  const routeMerchantId =
    params?.merchantId;

  if (
    routeMerchantId === undefined
  ) {
    return null;
  }

  if (
    typeof routeMerchantId !== "string" ||
    !routeMerchantId.trim()
  ) {
    return "Merchant ID is required.";
  }

  if (
    routeMerchantId.trim() !==
    merchantId
  ) {
    return "You are not authorized to access this merchant's wallets.";
  }

  return null;
}

function getWalletId(
  request: FastifyRequest
): string | undefined {
  const params =
    request.params as
      | Record<string, unknown>
      | undefined;

  const id = params?.id;

  if (
    typeof id === "string" &&
    id.trim()
  ) {
    return id.trim();
  }

  return undefined;
}

export default class WalletController {
  constructor(
    private readonly walletService: WalletService
  ) {}

  /**
   * Create a merchant settlement wallet.
   *
   * SmartPOS does not generate wallet addresses.
   * The merchant supplies an existing public address.
   *
   * The merchantId is always taken from the
   * authenticated user rather than the request body.
   */
  create = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const merchantId =
        getAuthenticatedMerchantId(
          request
        );

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
   * wallet balance records.
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
          error:
            "Transfer amount is required.",
        });
      }

      const amount =
        new Prisma.Decimal(
          body.amount
        );

      const result =
        await this.walletService.transferFunds(
          body.fromWalletId.trim(),
          body.toWalletId.trim(),
          amount
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
      const id =
        getWalletId(request);

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
          error:
            "Credit amount is required.",
        });
      }

      const wallet =
        await this.walletService.creditWallet(
          id,
          new Prisma.Decimal(
            body.amount
          )
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
      const id =
        getWalletId(request);

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
          error:
            "Debit amount is required.",
        });
      }

      const wallet =
        await this.walletService.debitWallet(
          id,
          new Prisma.Decimal(
            body.amount
          )
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
      const id =
        getWalletId(request);

      if (!id) {
        return reply.code(400).send({
          success: false,
          error: "Wallet ID is required.",
        });
      }

      const wallet =
        await this.walletService.getWallet(
          id
        );

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
   * Get all wallets belonging to the
   * authenticated merchant.
   *
   * The merchantId in the URL is checked against
   * the authenticated merchant and can never override it.
   */
  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const merchantId =
        getAuthenticatedMerchantId(
          request
        );

      if (!merchantId) {
        return reply.code(401).send({
          success: false,
          error:
            "Authenticated merchant account is required.",
        });
      }

      const routeError =
        validateMerchantRoute(
          request,
          merchantId
        );

      if (routeError) {
        return reply.code(403).send({
          success: false,
          error: routeError,
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