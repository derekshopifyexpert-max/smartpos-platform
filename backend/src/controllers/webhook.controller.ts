import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import WebhookService from "../services/webhook.service.js";
import { enqueueWebhook } from "../queues/webhook.producer.js";

export default class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
  ) {}

  receive = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const body = request.body as any;

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
      signature.trim() !== webhookSecret.trim()
    ) {
      return reply
        .code(401)
        .send({
          success: false,
          statusCode: 401,
          error: "Unauthorized",
          message:
            "Invalid Flutterwave webhook signature.",
        });
    }

    /*
     * Flutterwave V3 webhook structure:
     *
     * {
     *   id: "...",
     *   event: "...",
     *   data: {
     *     id: ...,
     *     status: "...",
     *     tx_ref: "..."
     *   }
     *
     * The Flutterwave `data.id` is NOT the SmartPOS
     * Transaction primary key.
     *
     * We correlate the webhook to SmartPOS using
     * Flutterwave's `tx_ref`, which must correspond
     * to the SmartPOS Transaction.reference.
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
            "Flutterwave webhook ID is missing.",
        });
    }

    const event =
      body?.event ??
      body?.type ??
      "unknown";

    const transactionReference =
      body?.data?.tx_ref
        ? String(body.data.tx_ref)
        : undefined;

    /*
     * Resolve the Flutterwave transaction reference
     * to the actual SmartPOS Transaction primary key.
     *
     * WebhookDelivery.transactionId is a foreign key
     * to SmartPOS Transaction.id, so we must NEVER
     * store Flutterwave's numeric data.id here.
     */
    let transactionId: string | undefined;

    if (transactionReference) {
      const transaction =
        await request.server.prisma.transaction.findFirst({
          where: {
            reference: transactionReference,
          },
          select: {
            id: true,
          },
        });

      transactionId = transaction?.id;
    }

    /*
     * Do not allow an unknown transaction reference
     * to reach Prisma as a foreign key.
     */
    if (!transactionId) {
      return reply
        .code(404)
        .send({
          success: false,
          statusCode: 404,
          error: "Not Found",
          message:
            `No SmartPOS transaction found for Flutterwave tx_ref "${transactionReference ?? "missing"}".`,
        });
    }

    /*
     * Persist the webhook only after:
     *
     * 1. Signature validation
     * 2. Webhook ID validation
     * 3. Flutterwave tx_ref extraction
     * 4. SmartPOS Transaction resolution
     *
     * This guarantees WebhookDelivery.transactionId
     * satisfies the database foreign-key constraint.
     */
    const webhook =
      await this.webhookService.receiveWebhook({
        webhookId,
        event,
        payload: body,
        transactionId,
      });

    /*
     * Queue processing after persistence.
     *
     * Flutterwave expects a successful response from
     * the webhook endpoint. A queue failure must not
     * turn an already-persisted webhook into a failed
     * HTTP delivery.
     */
    try {
      await enqueueWebhook(webhook.id);
    } catch (error) {
      request.log.error(
        {
          error,
          webhookId: webhook.id,
        },
        "Failed to enqueue Flutterwave webhook",
      );
    }

    return reply
      .code(200)
      .send({
        success: true,
        data: {
          webhookId: webhook.id,
          status: "QUEUED",
        },
      });
  };

  process = async (
    request: FastifyRequest,
    reply: FastifyReply,
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
          status: "QUEUED",
        },
      });
  };
}