import { Prisma } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";
import WalletService from "../services/wallet.service.js";
import type { CreateWalletBody } from "../types/wallet.js";

export default class WalletController {
  constructor(
    private readonly walletService: WalletService
  ) {}

  create = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const wallet = await this.walletService.createWallet(
      request.body as CreateWalletBody
    );

    const safeWallet = (({ encryptedPrivateKey, ...rest }: any) => rest)(
      wallet ?? {}
    );

    return reply.send({
      success: true,
      data: safeWallet
    });
  };

  transferFunds = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {
      fromWalletId,
      toWalletId,
      amount
    } = request.body as {
      fromWalletId: string;
      toWalletId: string;
      amount: number | string;
    };

    const result = await this.walletService.transferFunds(
      fromWalletId,
      toWalletId,
      new Prisma.Decimal(amount)
    );

    return reply.send({
      success: true,
      data: result
    });
  };

  credit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };
    const { amount } = request.body as { amount: number | string };

    const wallet = await this.walletService.creditWallet(
      id,
      new Prisma.Decimal(amount)
    );

    return reply.send({
      success: true,
      data: wallet
    });
  };

  debit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };
    const { amount } = request.body as { amount: number | string };

    const wallet = await this.walletService.debitWallet(
      id,
      new Prisma.Decimal(amount)
    );

    return reply.send({
      success: true,
      data: wallet
    });
  };

  get = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } = request.params as { id: string };

    const wallet = await this.walletService.getWallet(id);

    const safeWallet = wallet
      ? (({ encryptedPrivateKey, ...rest }: any) => rest)(wallet)
      : null;

    return reply.send({
      success: true,
      data: safeWallet
    });
  };

  merchantWallets = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { merchantId } = request.params as { merchantId: string };

    const wallets = await this.walletService.merchantWallets(
      merchantId
    );

    const safe = (wallets ?? []).map((wallet: any) => {
      const { encryptedPrivateKey, ...rest } = wallet;
      return rest;
    });

    return reply.send({
      success: true,
      data: safe
    });
  };
}
