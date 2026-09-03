import { FastifyInstance } from "fastify";

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
  paymentIntentIdSchema,
  paymentIntentListQuerySchema,
} from "../validators/payment.validator.js";

export default async function paymentRoutes(
  app: FastifyInstance,
) {
  const service = new PaymentService(app);
  const orchestrator = new PaymentOrchestratorService(app);

  const controller = new PaymentController(
    service,
    orchestrator,
  );

  app.post(
    "/payment-intents",
    {
      preHandler: validateBody(
        createPaymentIntentSchema,
      ),
    },
    controller.createPaymentIntent,
  );

  app.get(
    "/payment-intents",
    {
      preHandler: validateQuery(
        paymentIntentListQuerySchema,
      ),
    },
    controller.listPaymentIntents,
  );

  app.get(
    "/payment-intents/:id",
    {
      preHandler: validateParams(
        paymentIntentIdSchema,
      ),
    },
    controller.getPaymentIntent,
  );

  app.patch(
    "/payment-intents/:id/expire",
    {
      preHandler: validateParams(
        paymentIntentIdSchema,
      ),
    },
    controller.expirePaymentIntent,
  );
}