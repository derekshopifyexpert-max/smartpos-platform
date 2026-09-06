import { FastifyReply, FastifyRequest } from "fastify";

import TransactionService from "../services/transaction.service.js";
import {
  isTransactionRetentionEnabled,
  setTransactionRetentionEnabled,
} from "../services/transaction-retention.service.js";

export default class TransactionController {
  constructor(
    private readonly transactionService: TransactionService
  ) {}

  start = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const transaction =
      await this.transactionService.startTransaction(
        request.body as any
      );

    return reply.code(201).send({
      success: true,
      data: transaction
    });
  };

  execute = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {

  const result =
    await this.transactionService.executePayment(
      request.body as any
    );

  return reply.send({
    success: true,
    data: {
      transaction: result.transaction,
      gatewayRequest: result.gatewayRequest,
      conversion: result.conversion,
      quote: result.quote,
      gateway: result.gateway
    }
  });

};

  settle = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const result =
      await this.transactionService.settleTransaction(
        request.body as any
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  complete = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as any;

    const result =
      await this.transactionService.completeTransaction(
        id
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  fail = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const result =
      await this.transactionService.failTransaction(
        request.body as any
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  get = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as any;

    const result =
      await this.transactionService.getTransaction(
        id
      );

    return reply.send({
      success: true,
      data: result
    });
  };

  list = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {

  const {
    page = "1",
    limit = "10",
  } = request.query as any;

  const result =
    await this.transactionService.listTransactions(
      Number(page),
      Number(limit)
    );

  return reply.send({
    success: true,
    data: result,
  });

};

  delete = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const result = await this.transactionService.deleteTransactions(
      request.body as any
    );

    return reply.send({
      success: true,
      data: result,
    });
  };

  retentionStatus = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => reply.send({
    success: true,
    data: { enabled: isTransactionRetentionEnabled(), retentionDays: 7 },
  });

  setRetention = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    setTransactionRetentionEnabled(
      (request.body as { enabled: boolean }).enabled
    );

    return reply.send({
      success: true,
      data: { enabled: isTransactionRetentionEnabled(), retentionDays: 7 },
    });
  };
}