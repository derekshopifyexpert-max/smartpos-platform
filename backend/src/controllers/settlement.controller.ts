import { FastifyReply, FastifyRequest } from "fastify";

import SettlementService from "../services/settlement.service.js";
import { enqueueSettlement } from "../queues/settlement.producer.js";

export default class SettlementController {

  constructor(
    private readonly settlementService: SettlementService
  ) {}

  createSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const settlement =
      await this.settlementService.createSettlement(
        request.body as any
      );

    return reply.code(201).send({

      success: true,

      message: "Settlement Created",

      data: settlement

    });

  };

  processSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { id } =
      request.params as any;

    const job =
      await enqueueSettlement(id);

    return reply.code(202).send({

      success: true,

      message: "Settlement queued for processing",

      data: {

        jobId: job.id,

        settlementId: id,

        status: "QUEUED"

      }

    });

  };

  completeSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { id } =
      request.params as any;

    const settlement =
      await this.settlementService.completeSettlement(
        id
      );

    return reply.send({

      success: true,

      data: settlement

    });

  };

  merchantSettlements = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const { merchantId } =
      request.params as any;

    const settlements =
      await this.settlementService.merchantSettlements(
        merchantId
      );

    return reply.send({

      success: true,

      data: settlements

    });

  };

  cryptoSettlements = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;
    if (!merchantId) {
      return reply.code(403).send({ success: false, error: "Authenticated merchant account is required." });
    }

    const settlements = await this.settlementService.listCryptoSettlements(merchantId);
    return reply.send({ success: true, data: settlements });
  };

  cryptoSettlement = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const merchantId = (request.user as { merchantId?: string } | undefined)?.merchantId;
    const { id } = request.params as { id?: string };
    if (!merchantId || !id) {
      return reply.code(400).send({ success: false, error: "Authenticated merchant and payment ID are required." });
    }

    const settlement = await this.settlementService.getCryptoSettlement(merchantId, id);
    if (!settlement) {
      return reply.code(404).send({ success: false, error: "Crypto settlement not found." });
    }

    return reply.send({ success: true, data: settlement });
  };

}
