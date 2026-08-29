import {
  Job,
  Worker,
} from "bullmq";

import {
  BullConnection,
} from "./bullmq.queue.js";

import FlutterwaveWebhookService from "../services/flutterwave-webhook.service.js";

export default function createFlutterwaveWebhookWorker(
  webhookService: FlutterwaveWebhookService,
) {
  return new Worker(
    "flutterwave-webhooks",

    async (job: Job) => {
      const {
        providerWebhookEventId,
      } = job.data as {
        providerWebhookEventId?: string;
      };

      if (!providerWebhookEventId?.trim()) {
        throw new Error(
          "providerWebhookEventId is required.",
        );
      }

      return webhookService.processWebhook(
        providerWebhookEventId.trim(),
      );
    },

    {
      connection: BullConnection,
    },
  );
}