import { FastifyInstance } from "fastify";

import GatewayService from "../services/gateway.service.js";
import GatewayController from "../controllers/gateway.controller.js";

export default async function gatewayRoutes(
  app: FastifyInstance
) {

  const service =
    new GatewayService(app);

  const controller =
    new GatewayController(service);

    app.post(
      "/gateway/providers",
      controller.createProvider
    );

    app.get(
      "/gateway/providers",
      controller.providers
    );

    app.get(
      "/gateway/providers/:providerId/statistics",
      controller.gatewayStatistics
    );

}
