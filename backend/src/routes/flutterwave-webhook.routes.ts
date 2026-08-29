import {
  FastifyInstance,
} from "fastify";

import FlutterwaveWebhookService from "../services/flutterwave-webhook.service.js";
import FlutterwaveWebhookController from "../controllers/flutterwave-webhook.controller.js";

export default async function flutterwaveWebhookRoutes(
  app: FastifyInstance,
) {
  const secretKey =
    process.env
      .FLUTTERWAVE_SECRET_KEY;

  if (!secretKey?.trim()) {
    throw new Error(
      "FLUTTERWAVE_SECRET_KEY is required for Flutterwave webhook processing.",
    );
  }

  const service =
    new FlutterwaveWebhookService(
      app,
      secretKey,
    );

  const controller =
    new FlutterwaveWebhookController(
      service,
    );

  app.post(
    "/webhooks/flutterwave",
    controller.receive,
  );

  app.post(
    "/webhooks/flutterwave/:id/process",
    controller.process,
  );
}