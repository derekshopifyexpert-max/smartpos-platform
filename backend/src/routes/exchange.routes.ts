import { FastifyInstance } from "fastify";

import ExchangeService from "../services/exchange.service.js";
import ExchangeController from "../controllers/exchange.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export default async function exchangeRoutes(
  app: FastifyInstance
) {

  const service =
    new ExchangeService(app);

  const controller =
    new ExchangeController(service);

  // Legacy endpoints
  app.post(
    "/exchange/rates",
    controller.createRate
  );

  app.post(
    "/exchange/quote",
    controller.quote
  );

  // Real exchange provider endpoints
  app.post(
    "/exchange/real-quote",
    { preHandler: authMiddleware },
    controller.getRealQuote
  );

  app.post(
    "/exchange/buy",
    { preHandler: authMiddleware },
    controller.buyOrder
  );

  app.post(
    "/exchange/sell",
    { preHandler: authMiddleware },
    controller.sellOrder
  );

  app.get(
    "/exchange/orders/:orderId",
    { preHandler: authMiddleware },
    controller.getOrderStatus
  );

  app.get(
    "/exchange/orders",
    { preHandler: authMiddleware },
    controller.listOrders
  );

  app.get(
    "/exchange/orders/:orderId/details",
    { preHandler: authMiddleware },
    controller.getOrderDetails
  );

  app.get(
    "/exchange/balance/:asset",
    { preHandler: authMiddleware },
    controller.getBalance
  );

  app.get(
    "/crypto/assets",
    { preHandler: authMiddleware },
    controller.getAssets
  );

  app.get(
    "/crypto/markets",
    { preHandler: authMiddleware },
    controller.getMarkets
  );

  app.get(
    "/crypto/balances",
    { preHandler: authMiddleware },
    controller.getBalances
  );

  app.get(
    "/crypto/provider/status",
    { preHandler: authMiddleware },
    controller.providerStatus
  );

}
