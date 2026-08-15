import { Prisma } from "@prisma/client";
import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import WalletService from "../services/wallet.service.js";

import type {
  CreateWalletBody,
  CreateWalletRequestData,
} from "../types/wallet.js";

function getAuthenticatedUser(
  request: FastifyRequest
): {
  id: string;
  merchantId?: string;
} {
  const user = request.user as
    | {
        id?: string;
        merchantId?: string;
      }
    | undefined;

  if (!user?.id) {
    const error = new Error(
      "Authentication is required."
    );

    (error as any).statusCode = 401;

    throw error;
  }

  return {
    id: user.id,
    merchantId: user.merchantId,
  };
}

function removeSensitiveWalletFields(
  wallet: any
) {
  if (!wallet) {
    return null;
  }

  const {
    encryptedPrivateKey: _encryptedPrivateKey,
    privateKey: _privateKey,
    seedPhrase: _seedPhrase,
    mnemonic: _mnemonic,
    ...safeWallet
  } = wallet;

  return safeWallet;
}

export default class WalletController {
  constructor(
    private readonly walletService: WalletService
  ) {}

  create = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      getAuthenticatedUser(request);

    if (!user.merchantId) {
      const error = new Error(
        "Your account is not associated with a merchant account."
      );

      (error as any).statusCode = 403;

      throw error;
    }

    const body =
      request.body as CreateWalletBody;

    const wallet =
      await this.walletService.createWallet({
        ...body,
        merchantId: user.merchantId,
      } as CreateWalletRequestData);

    const safeWallet =
      removeSensitiveWalletFields(wallet);

    return reply.send({
      success: true,
      data: safeWallet,
    });
  };

  transferFunds = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {
      fromWalletId,
      toWalletId,
      amount,
    } = request.body as {
      fromWalletId: string;
      toWalletId: string;
      amount: number | string;
    };

    const result =
      await this.walletService.transferFunds(
        fromWalletId,
        toWalletId,
        new Prisma.Decimal(amount)
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
        amount: number | string;
      };

    const wallet =
      await this.walletService.creditWallet(
        id,
        new Prisma.Decimal(amount)
      );

    return reply.send({
      success: true,
      data: wallet,
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
        amount: number | string;
      };

    const wallet =
      await this.walletService.debitWallet(
        id,
        new Prisma.Decimal(amount)
      );

    return reply.send({
      success: true,
      data: wallet,
    });
  };

  get = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      getAuthenticatedUser(request);

    const { id } =
      request.params as {
        id: string;
      };

    const wallet =
      await this.walletService.getWalletForMerchant(
        id,
        user.merchantId
      );

    const safeWallet =
      removeSensitiveWalletFields(wallet);

    return reply.send({
      success: true,
      data: safeWallet,
    });
  };

  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      getAuthenticatedUser(request);

    if (!user.merchantId) {
      const error = new Error(
        "Your account is not associated with a merchant account."
      );

      (error as any).statusCode = 403;

      throw error;
    }

    const wallets =
      await this.walletService.merchantWallets(
        user.merchantId
      );

    const safe =
      (wallets ?? []).map(
        (wallet: any) =>
          removeSensitiveWalletFields(wallet)
      );

    return reply.send({
      success: true,
      data: safe,
    });
  };
}