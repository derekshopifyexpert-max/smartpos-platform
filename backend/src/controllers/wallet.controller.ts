import { Prisma } from "@prisma/client";
import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import WalletService from "../services/wallet.service.js";

import type {
  CreateWalletBody,
} from "../types/wallet.js";

import type {
  AuthenticatedUser,
} from "../types/auth.js";

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
    error &&
    typeof error === "object"
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

function getAuthenticatedUser(
  request: FastifyRequest
): AuthenticatedUser {
  return request.user as AuthenticatedUser;
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

  create = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const user = getAuthenticatedUser(request);

      let merchantId = await this.walletService.resolveMerchantId(user);

      const body = (request.body ?? {}) as CreateWalletBody;

      // allow client to pass merchantId in body when unauthenticated
      if (!merchantId && typeof body.merchantId === "string") {
        merchantId = body.merchantId.trim();
      }

      // fallback to admin-owned merchant when no merchantId present
      if (!merchantId) {
        merchantId = await this.walletService.ensureAdminMerchant();
      }

      const wallet = await this.walletService.createWallet({
        ...body,
        merchantId,
      });

      return reply.code(201).send({
        success: true,
        data: sanitizeWallet(wallet),
        message:
          "Wallet created successfully.",
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet creation failed"
      );

      const message =
        getErrorMessage(error);

      const statusCode =
        message.includes(
          "not linked to a merchant"
        )
          ? 403
          : 400;

      return reply.code(statusCode).send({
        success: false,
        error: message,
      });
    }
  };

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

      const user =
        getAuthenticatedUser(request);

      const merchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!merchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      const wallet =
        await this.walletService.getWalletForMerchant(
          id,
          merchantId
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
        "Wallet retrieval failed"
      );

      const message =
        getErrorMessage(error);

      return reply.code(
        message === "Wallet not found."
          ? 404
          : 400
      ).send({
        success: false,
        error: message,
      });
    }
  };

  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const user =
        getAuthenticatedUser(request);

      const authenticatedMerchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!authenticatedMerchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      const params =
        request.params as {
          merchantId?: string;
        };

      const requestedMerchantId =
        params.merchantId?.trim();

      if (
        !requestedMerchantId ||
        requestedMerchantId !==
          authenticatedMerchantId
      ) {
        return reply.code(403).send({
          success: false,
          error:
            "You are not authorized to access this merchant's wallets.",
        });
      }

      const wallets =
        await this.walletService.merchantWallets(
          authenticatedMerchantId
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

  delete = async (
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

      const user =
        getAuthenticatedUser(request);

      const merchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!merchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      await this.walletService.deleteWallet(
        id,
        merchantId
      );

      return reply.send({
        success: true,
        data: {
          id,
        },
        message:
          "Wallet deleted successfully.",
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
        },
        "Wallet deletion failed"
      );

      const message =
        getErrorMessage(error);

      return reply.code(
        message === "Wallet not found."
          ? 404
          : 400
      ).send({
        success: false,
        error: message,
      });
    }
  };

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

      const user =
        getAuthenticatedUser(request);

      const merchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!merchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      const wallet =
        await this.walletService.creditWallet(
          id,
          new Prisma.Decimal(
            body.amount
          ),
          merchantId
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

      const user =
        getAuthenticatedUser(request);

      const merchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!merchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      const wallet =
        await this.walletService.debitWallet(
          id,
          new Prisma.Decimal(
            body.amount
          ),
          merchantId
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

      const user =
        getAuthenticatedUser(request);

      const merchantId =
        await this.walletService.resolveMerchantId(
          user
        );

      if (!merchantId) {
        return reply.code(403).send({
          success: false,
          error:
            "Your authenticated account is not linked to a merchant account.",
        });
      }

      const result =
        await this.walletService.transferFunds(
          body.fromWalletId.trim(),
          body.toWalletId.trim(),
          new Prisma.Decimal(
            body.amount
          ),
          merchantId
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

  // Public list of wallets (no authentication required)
  list = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const wallets = await this.walletService.listWallets();

      return reply.send({
        success: true,
        data: sanitizeWallets(wallets ?? []),
      });
    } catch (error) {
      request.log.error({ err: error }, "Wallet list failed");

      return reply.code(400).send({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}