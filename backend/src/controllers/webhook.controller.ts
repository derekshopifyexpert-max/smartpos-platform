import {
  FastifyReply,
  FastifyRequest
} from "fastify";

import WebhookService from "../services/webhook.service.js";
import { enqueueWebhook } from "../queues/webhook.producer.js";

export default class WebhookController {
  constructor(
    private readonly webhookService: WebhookService
  ) {}

  receive = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body =
      request.body as any;

    /*
     * Flutterwave V3 sends its configured webhook
     * secret hash in the `verif-hash` header.
     *
     * Never process a webhook without validating it.
     */
    const signature =
      request.headers["verif-hash"];

    const webhookSecret =
      process.env.FLUTTERWAVE_WEBHOOK_SECRET;

    if (
      !webhookSecret ||
      typeof signature !== "string" ||
      signature !== webhookSecret
    ) {
      return reply
        .code(401)
        .send({
          success: false,
          statusCode: 401,
          error: "Unauthorized",
          message:
            "Invalid Flutterwave webhook signature."
        });
    }

    /*
     * Flutterwave V3 webhook structure:
     *
     * {
     *   event: "...",
     *   data: {
     *     id: ...,
     *     status: "...",
     *     tx_ref: "..."
     *   }
     * }
     *
     * Map it into the existing SmartPOS
     * WebhookService contract.
     */
    const webhookId =
      body?.id
        ? String(body.id)
        : body?.data?.id
          ? String(body.data.id)
          : body?.data?.tx_ref
            ? String(body.data.tx_ref)
            : undefined;

    if (!webhookId) {
      return reply
        .code(400)
        .send({
          success: false,
          statusCode: 400,
          error: "Bad Request",
          message:
            "Flutterwave webhook ID is missing."
        });
    }

    const event =
      body?.event ??
      body?.type ??
      "unknown";

    const transactionId =
      body?.data?.id
        ? String(body.data.id)
        : body?.data?.tx_ref
          ? String(body.data.tx_ref)
          : undefined;

    const webhook =
      await this.webhookService.receiveWebhook({
        webhookId,
        event,
        payload: body,
        transactionId
      });

    /*
     * Queue processing after persistence.
     *
     * Flutterwave expects a 200 response from the
     * webhook endpoint. We therefore acknowledge
     * immediately after safely persisting the event.
     */
    try {
      await enqueueWebhook(webhook.id);
    } catch (error) {
      request.log.error(
        {
          error,
          webhookId: webhook.id
        },
        "Failed to enqueue Flutterwave webhook"
      );
    }

    return reply
      .code(200)
      .send({
        success: true,
        data: {
          webhookId: webhook.id,
          status: "QUEUED"
        }
      });
  };

  process = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { id } =
      request.params as {
        id: string;
      };

    const job =
      await enqueueWebhook(id);

    return reply
      .code(202)
      .send({
        success: true,
        message:
          "Webhook queued for processing",
        data: {
          jobId: job.id,
          webhookId: id,
          status: "QUEUED"
        }
      });
  };
}