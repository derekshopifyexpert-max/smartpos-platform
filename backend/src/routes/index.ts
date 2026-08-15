import { FastifyInstance } from "fastify";

import metricsRoutes from "./metrics.routes.js";
import walletRoutes from "./wallet.routes.js";
import merchantRoutes from "./merchant.routes.js";
import paymentRoutes from "./payment.routes.js";
import transactionRoutes from "./transaction.routes.js";
import blockchainRoutes from "./blockchain.routes.js";
import exchangeRoutes from "./exchange.routes.js";
import gatewayRoutes from "./gateway.routes.js";
import settlementRoutes from "./settlement.routes.js";
import authRoutes from "./auth.routes.js";
import terminalRoutes from "./terminal.routes.js";
import healthRoutes from "./health.routes.js";

export default async function registerRoutes(
  app: FastifyInstance
) {

  app.register(healthRoutes);

  app.register(paymentRoutes, {
    prefix: "/api/v1"
  });

  app.register(metricsRoutes, {
    prefix: "/api/v1"
  });

  app.register(walletRoutes, {
    prefix: "/api/v1"
  });

  app.register(merchantRoutes, {
    prefix: "/api/v1"
  });

  app.register(transactionRoutes, {
    prefix: "/api/v1"
  });

  app.register(blockchainRoutes, {
    prefix: "/api/v1"
  });

  app.register(exchangeRoutes, {
    prefix: "/api/v1"
  });

  app.register(gatewayRoutes, {
    prefix: "/api/v1"
  });

  app.register(settlementRoutes, {
    prefix: "/api/v1"
  });

  app.register(authRoutes, {
    prefix: "/api/v1"
  });

  app.register(terminalRoutes, {
    prefix: "/api/v1"
  });

}
