import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import FlutterwaveWebhookService from "../services/flutterwave-webhook.service.js";
import {
  enqueueFlutterwaveWebhook,
} from "../queues/flutterwave-webhook.producer.js";

export default class FlutterwaveWebhookController {
  constructor(
    private readonly webhookService:
      FlutterwaveWebhookService,
  ) {}

  receive = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const body =
      request.body as Record<
        string,
        unknown
      >;

    /*
     * Flutterwave V3 sends the configured secret hash
     * in the `verif-hash` header.
     */
    const signature =
      request.headers["verif-hash"];

    const webhookSecret =
      process.env
        .FLUTTERWAVE_WEBHOOK_SECRET;

    if (
      !webhookSecret?.trim() ||
      typeof signature !== "string" ||
      !signature.trim()
    ) {
      return reply
        .code(401)
        .send({
          success: false,
          statusCode: 401,
          error: "Unauthorized",
          message:
            "Flutterwave webhook signature is missing.",
        });
    }

    if (
      signature.trim() !==
      webhookSecret.trim()
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
     * Flutterwave event ID.
     */
    const eventId =
      body?.id !== undefined &&
      body?.id !== null
        ? String(body.id)
        : undefined;

    if (!eventId) {
      return reply
        .code(400)
        .send({
          success: false,
          statusCode: 400,
          error: "Bad Request",
          message:
            "Flutterwave webhook event ID is missing.",
        });
    }

    /*
     * Flutterwave transaction reference.
     *
     * This MUST correspond to SmartPOS Transaction.reference.
     */
    const transactionReference =
      body?.data &&
      typeof body.data === "object" &&
      typeof (
        body.data as {
          tx_ref?: unknown;
        }
      ).tx_ref === "string"
        ? String(
            (
              body.data as {
                tx_ref: string;
              }
            ).tx_ref,
          ).trim()
        : undefined;

    if (!transactionReference) {
      return reply
        .code(400)
        .send({
          success: false,
          statusCode: 400,
          error: "Bad Request",
          message:
            "Flutterwave transaction reference (tx_ref) is missing.",
        });
    }

    /*
     * Confirm that the tx_ref belongs to a real SmartPOS
     * transaction BEFORE persisting the provider event.
     */
    const transaction =
      await request.server.prisma.transaction.findFirst({
        where: {
          reference:
            transactionReference,
        },

        select: {
          id: true,
          reference: true,
        },
      });

    if (!transaction) {
      return reply
        .code(404)
        .send({
          success: false,
          statusCode: 404,
          error: "Not Found",
          message:
            `No SmartPOS transaction found for Flutterwave tx_ref "${transactionReference}".`,
        });
    }

    /*
     * Persist ProviderWebhookEvent.
     *
     * This is deliberately NOT WebhookDelivery.
     */
    const webhook =
      await this.webhookService.receiveWebhook(
        body,
      );

    /*
     * Queue processing after persistence.
     */
    try {
      await enqueueFlutterwaveWebhook(
        webhook.id,
      );
    } catch (error) {
      request.log.error(
        {
          error,
          providerWebhookEventId:
            webhook.id,
          eventId,
        },
        "Failed to enqueue Flutterwave webhook.",
      );
    }

    /*
     * Always acknowledge a validly authenticated,
     * correlated webhook.
     */
    return reply
      .code(200)
      .send({
        success: true,

        data: {
          provider:
            "flutterwave",

          providerWebhookEventId:
            webhook.id,

          eventId,

          transactionId:
            transaction.id,

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

    if (!id?.trim()) {
      return reply
        .code(400)
        .send({
          success: false,
          statusCode: 400,
          error: "Bad Request",
          message:
            "Provider webhook event ID is required.",
        });
    }

    const job =
      await enqueueFlutterwaveWebhook(
        id,
      );

    return reply
      .code(202)
      .send({
        success: true,

        message:
          "Flutterwave webhook queued for processing.",

        data: {
          jobId: job.id,
          providerWebhookEventId: id,
          status: "QUEUED",
        },
      });
  };
}