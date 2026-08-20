import type { FastifyInstance } from "fastify";
import QuidaxWebhookController from "../controllers/quidax-webhook.controller.js";

export default async function quidaxWebhookRoutes(app: FastifyInstance) {
  const controller = new QuidaxWebhookController(app);

  app.post("/webhooks/quidax", controller.receive);
}
