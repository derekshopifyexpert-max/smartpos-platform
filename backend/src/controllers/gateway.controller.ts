import { FastifyReply, FastifyRequest } from "fastify";

import GatewayService from "../services/gateway.service.js";

export default class GatewayController {

  constructor(
    private readonly gatewayService: GatewayService
  ) {}

  createProvider = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {

    const provider =
    await this.gatewayService.createProvider(
      request.body as any
    );

    return reply.code(201).send({
      success: true,
      data: provider,
    });
  };

  providers = async (

    _request: FastifyRequest,

    reply: FastifyReply

  ) => {

    const providers =
      await this.gatewayService.activeProviders();

    return reply.send({

      success: true,

      data: providers

    });

  };

  gatewayStatistics = async (

    request: FastifyRequest,

    reply: FastifyReply

  ) => {

    const { providerId } =
      request.params as any;

    const result =
      await this.gatewayService.providerStatistics(
        providerId
      );

    return reply.send({

      success: true,

      data: result

    });

  };

  checkPaystackChannels = async (
    _request: any,
    reply: FastifyReply
  ) => {
    try {
      // @ts-ignore
      const result = await this.gatewayService.checkPaystackChannels();

      return reply.send({
        success: true,
        data: result
      });
    } catch (e) {
      return reply.code(500).send({
        success: false,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  };

}
