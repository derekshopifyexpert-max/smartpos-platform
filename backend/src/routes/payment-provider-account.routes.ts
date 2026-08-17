import { FastifyInstance } from "fastify";
import PaymentProviderAccountService from "../services/payment-provider-account.service.js";

export default async function paymentProviderAccountRoutes(
  app: FastifyInstance
) {
  const service = new PaymentProviderAccountService(app);

  /**
   * GET /api/v1/payment-provider-accounts
   * List all available payment provider accounts (safe metadata only)
   * No secret keys exposed to frontend
   */
  app.get("/payment-provider-accounts", async (request, reply) => {
    try {
      const accounts = await service.listAccounts();
      return reply.send({
        success: true,
        data: accounts,
      });
    } catch (err) {
      app.log.error({ err }, "Failed to list payment provider accounts");
      return reply.code(500).send({
        success: false,
        error: "Failed to retrieve payment provider accounts",
      });
    }
  });

  /**
   * GET /api/v1/payment-provider-accounts/:id
   * Get a single account by ID (safe metadata only)
   */
  app.get("/payment-provider-accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const account = await service.getAccount(id);
      if (!account) {
        return reply.code(404).send({
          success: false,
          error: "Payment provider account not found",
        });
      }

      return reply.send({
        success: true,
        data: account,
      });
    } catch (err) {
      app.log.error({ err }, "Failed to get payment provider account");
      return reply.code(500).send({
        success: false,
        error: "Failed to retrieve payment provider account",
      });
    }
  });

  /**
   * GET /api/v1/payment-provider-accounts/by-provider/:provider
   * Get all accounts for a specific provider
   */
  app.get("/payment-provider-accounts/by-provider/:provider", async (request, reply) => {
    const { provider } = request.params as { provider: string };

    try {
      const accounts = await service.getAccountsByProvider(provider);
      return reply.send({
        success: true,
        data: accounts,
      });
    } catch (err) {
      app.log.error({ err }, "Failed to list accounts by provider");
      return reply.code(500).send({
        success: false,
        error: "Failed to retrieve accounts",
      });
    }
  });
}
