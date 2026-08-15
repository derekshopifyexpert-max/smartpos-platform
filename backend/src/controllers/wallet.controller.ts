import {
  Prisma,
} from "@prisma/client";

import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import WalletService from "../services/wallet.service.js";
import type {
  CreateWalletBody,
} from "../types/wallet.js";

function sanitizeWallet(
  wallet: any
) {
  if (!wallet) {
    return null;
  }

  const {
    encryptedPrivateKey: _encryptedPrivateKey,
    ...safeWallet
  } = wallet;

  return safeWallet;
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : "Wallet request failed.";
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
      const wallet =
        await this.walletService.createWallet(
          request.body as CreateWalletBody
        );

      if (!wallet) {
        return reply.code(500).send({
          success: false,
          message:
            "Wallet was not returned after creation.",
        });
      }

      return reply.code(201).send({
        success: true,
        data: sanitizeWallet(
          wallet
        ),
      });
    } catch (error) {
      const message =
        getErrorMessage(error);

      request.log.error(
        {
          error,
        },
        "Wallet creation failed"
      );

      const statusCode =
        message ===
        "Merchant not found."
          ? 404
          : message.includes(
                "already saved"
              ) ||
            message.includes(
                "already associated"
              )
          ? 409
          : message.includes(
                "required"
              ) ||
            message.includes(
                "Invalid"
              ) ||
            message.includes(
                "Unsupported"
              )
          ? 400
          : 500;

      return reply
        .code(statusCode)
        .send({
          success: false,
          message,
        });
    }
  };

  transferFunds = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {
      fromWalletId,
      toWalletId,
      amount,
    } =
      request.body as {
        fromWalletId: string;
        toWalletId: string;
        amount:
          | number
          | string;
      };

    const result =
      await this.walletService.transferFunds(
        fromWalletId,
        toWalletId,
        new Prisma.Decimal(
          amount
        )
      );

    return reply.send({
      success: true,
      data: result,
    });
  };

  credit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const { amount } =
      request.body as {
        amount:
          | number
          | string;
      };

    const wallet =
      await this.walletService.creditWallet(
        id,
        new Prisma.Decimal(
          amount
        )
      );

    return reply.send({
      success: true,
      data: sanitizeWallet(
        wallet
      ),
    });
  };

  debit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const { amount } =
      request.body as {
        amount:
          | number
          | string;
      };

    const wallet =
      await this.walletService.debitWallet(
        id,
        new Prisma.Decimal(
          amount
        )
      );

    return reply.send({
      success: true,
      data: sanitizeWallet(
        wallet
      ),
    });
  };

  get = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const wallet =
      await this.walletService.getWallet(
        id
      );

    if (!wallet) {
      return reply.code(404).send({
        success: false,
        message:
          "Wallet not found.",
      });
    }

    return reply.send({
      success: true,
      data: sanitizeWallet(
        wallet
      ),
    });
  };

  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {
      merchantId,
    } =
      request.params as {
        merchantId: string;
      };

    try {
      const wallets =
        await this.walletService.merchantWallets(
          merchantId
        );

      return reply.send({
        success: true,

        data: wallets.map(
          (wallet) =>
            sanitizeWallet(
              wallet
            )
        ),
      });
    } catch (error) {
      const message =
        getErrorMessage(error);

      request.log.error(
        {
          error,
          merchantId,
        },
        "Failed to load merchant wallets"
      );

      return reply
        .code(
          message ===
            "Merchant not found."
            ? 404
            : 500
        )
        .send({
          success: false,
          message,
        });
    }
  };
}