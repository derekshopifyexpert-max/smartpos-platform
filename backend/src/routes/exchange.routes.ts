import { FastifyInstance } from "fastify";

import ExchangeService from "../services/exchange.service.js";
import ExchangeController from "../controllers/exchange.controller.js";

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
    controller.getRealQuote
  );

  app.post(
    "/exchange/buy",
    controller.buyOrder
  );

  app.post(
    "/exchange/sell",
    controller.sellOrder
  );

  app.get(
    "/exchange/orders/:orderId",
    controller.getOrderStatus
  );

  app.get(
    "/exchange/balance/:asset",
    controller.getBalance
  );

}
