import { FastifyInstance } from "fastify";

import { authMiddleware } from "../middleware/auth.middleware.js";

import PaymentService from "../services/payment.service.js";
import PaymentOrchestratorService from "../services/payment-orchestrator.service.js";
import PaymentController from "../controllers/payment.controller.js";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";

import {
  createPaymentIntentSchema,
  paymentIntentAuthorizationChargeSchema,
  paymentIntentCheckoutSchema,
  paymentIntentIdSchema,
  paymentAuthorizationIdSchema,
  paymentIntentListQuerySchema,
  paymentMethodChargeSchema,
  paymentMethodIdSchema,
  paymentMethodListQuerySchema,
} from "../validators/payment.validator.js";

export default async function paymentRoutes(app: FastifyInstance) {
  const service = new PaymentService(app);
  const orchestrator = new PaymentOrchestratorService(app);
  const controller = new PaymentController(service, orchestrator);

  app.post("/payments", controller.createPayment);

  app.post(
    "/payment-intents",
    {
      preHandler: [
        authMiddleware,
        validateBody(createPaymentIntentSchema),
      ],
    },
    controller.createPaymentIntent,
  );

  app.get(
    "/payment-intents",
    {
      preHandler: validateQuery(paymentIntentListQuerySchema),
    },
    controller.listPaymentIntents,
  );

  app.get(
    "/payment-intents/:id",
    {
      preHandler: validateParams(paymentIntentIdSchema),
    },
    controller.getPaymentIntent,
  );

  app.get(
    "/payment-intents/:id/authorizations",
    {
      preHandler: validateParams(paymentIntentIdSchema),
    },
    controller.getPaymentIntentAuthorizations,
  );

  app.get(
    "/customers/:customerId/payment-methods",
    {
      preHandler: validateParams(paymentIntentIdSchema),
    },
    controller.listCustomerPaymentMethods,
  );

  app.post(
    "/payment-intents/:id/authorizations/:authorizationId/charge",
    {
      preHandler: [
        validateParams(paymentAuthorizationIdSchema),
        validateBody(paymentIntentAuthorizationChargeSchema),
      ],
    },
    controller.chargeSavedAuthorization,
  );

  app.post(
    "/customers/:customerId/payment-methods/:paymentMethodId/charge",
    {
      preHandler: [
        validateParams(paymentMethodIdSchema),
        validateBody(paymentMethodChargeSchema),
      ],
    },
    controller.chargeCustomerPaymentMethod,
  );

  app.post(
    "/payment-intents/:id/checkout",
    {
      preHandler: [
        validateParams(paymentIntentIdSchema),
        validateBody(paymentIntentCheckoutSchema),
      ],
    },
    controller.checkoutPaymentIntent,
  );

  app.post(
    "/payment-intents/:id/crypto-settlement",
    {
      preHandler: validateParams(paymentIntentIdSchema),
    },
    controller.processCryptoSettlement,
  );

  app.post(
    "/payment-intents/:id/expire",
    {
      preHandler: validateParams(paymentIntentIdSchema),
    },
    controller.expirePaymentIntent,
  );
}