import { FastifyInstance } from "fastify";

import SettlementService from "../services/settlement.service.js";
import SettlementController from "../controllers/settlement.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export default async function settlementRoutes(
  app: FastifyInstance
) {

  const service =
    new SettlementService(app);

  const controller =
    new SettlementController(service);

  app.get(
    "/crypto-settlements",
    { preHandler: authMiddleware },
    controller.cryptoSettlements
  );

  app.get(
    "/crypto-settlements/:id",
    { preHandler: authMiddleware },
    controller.cryptoSettlement
  );

  app.post(
    "/settlements",
    controller.createSettlement
  );

  app.post(
    "/settlements/:id/process",
    controller.processSettlement
  );

  app.post(
    "/settlements/:id/complete",
    controller.completeSettlement
  );

  app.get(
    "/merchants/:merchantId/settlements",
    controller.merchantSettlements
  );

}
