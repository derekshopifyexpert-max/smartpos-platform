import { FastifyInstance } from "fastify";

import PaymentService from "../services/payment.service.js";
import PaymentOrchestratorService from "../services/payment-orchestrator.service.js";
import PaymentController from "../controllers/payment.controller.js";

import {
  validateBody,
  validateParams,
  validateQuery
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
  paymentMethodListQuerySchema
} from "../validators/payment.validator.js";

export default async function paymentRoutes(
  app: FastifyInstance
) {

  const service =
    new PaymentService(app);

  const orchestrator =
    new PaymentOrchestratorService(app);

  const controller =
    new PaymentController(
      service,
      orchestrator
    );

  /*
  |--------------------------------------------------------------------------
  | Create Payment
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payments",
    controller.createPayment
  );

  /*
  |--------------------------------------------------------------------------
  | Create Payment Intent
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payment-intents",
    {
      preHandler: validateBody(
        createPaymentIntentSchema
      )
    },
    controller.createPaymentIntent
  );

  /*
  |--------------------------------------------------------------------------
  | Checkout Payment Intent
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payment-intents/:id/checkout",
    {
      preHandler: [
        validateParams(
          paymentIntentIdSchema
        ),
        validateBody(
          paymentIntentCheckoutSchema
        )
      ]
    },
    controller.checkoutPaymentIntent
  );

  /*
  |--------------------------------------------------------------------------
  | List Payment Intents
  |--------------------------------------------------------------------------
  */

  app.get(
    "/payment-intents",
    {
      preHandler: validateQuery(
        paymentIntentListQuerySchema
      )
    },
    controller.listPaymentIntents
  );

  /*
  |--------------------------------------------------------------------------
  | Get Payment Intent
  |--------------------------------------------------------------------------
  */

  app.get(
    "/payment-intents/:id",
    {
      preHandler: validateParams(
        paymentIntentIdSchema
      )
    },
    controller.getPaymentIntent
  );

  /*
  |--------------------------------------------------------------------------
  | List Saved Authorizations
  |--------------------------------------------------------------------------
  */

  app.get(
    "/payment-intents/:id/authorizations",
    {
      preHandler: validateParams(
        paymentIntentIdSchema
      )
    },
    controller.getPaymentIntentAuthorizations
  );

  /*
  |--------------------------------------------------------------------------
  | Charge Saved Authorization
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payment-intents/:id/authorizations/:authorizationId/charge",
    {
      preHandler: [
        validateParams(
          paymentIntentIdSchema
        ),
        validateParams(
          paymentAuthorizationIdSchema
        ),
        validateBody(
          paymentIntentAuthorizationChargeSchema
        )
      ]
    },
    controller.chargeSavedAuthorization
  );

  /*
  |--------------------------------------------------------------------------
  | List Reusable Customer Payment Methods
  |--------------------------------------------------------------------------
  */

  app.get(
    "/payment-methods",
    {
      preHandler: validateQuery(
        paymentMethodListQuerySchema
      )
    },
    controller.listCustomerPaymentMethods
  );

  /*
  |--------------------------------------------------------------------------
  | Charge Reusable Customer Payment Method
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payment-methods/:id/charge",
    {
      preHandler: [
        validateParams(
          paymentMethodIdSchema
        ),
        validateBody(
          paymentMethodChargeSchema
        )
      ]
    },
    controller.chargeCustomerPaymentMethod
  );

  /*
  |--------------------------------------------------------------------------
  | Expire Payment Intent
  |--------------------------------------------------------------------------
  */

  app.post(
    "/payment-intents/:id/crypto-settlement",
    controller.processCryptoSettlement
  );

  app.patch(
    "/payment-intents/:id/expire",
    {
      preHandler: validateParams(
        paymentIntentIdSchema
      )
    },
    controller.expirePaymentIntent
  );

}
