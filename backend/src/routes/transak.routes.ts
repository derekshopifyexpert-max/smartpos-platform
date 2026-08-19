import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import TransakController from "../controllers/transak.controller.js";
import TransakTransactionService from "../services/transak-transaction.service.js";

export default async function transakRoutes(app: FastifyInstance) {
  const controller = new TransakController(new TransakTransactionService(app));
  const protectedRoute = { preHandler: authMiddleware };

  app.get("/transak/capabilities", protectedRoute, controller.capabilities);
  app.post("/transak/quote", protectedRoute, controller.quote);
  app.post("/transak/wallet/verify", protectedRoute, controller.verifyWallet);
  app.post("/transak/payment-session", protectedRoute, controller.paymentSession);
  app.get("/transak/orders/:id", protectedRoute, controller.order);
  app.get("/transak/transactions", protectedRoute, controller.history);
  app.get("/transak/transactions/:id", protectedRoute, controller.detail);
}
