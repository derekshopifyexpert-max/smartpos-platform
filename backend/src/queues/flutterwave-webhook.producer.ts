import { FlutterwaveWebhookQueue } from "./bullmq.queue.js";

export async function enqueueFlutterwaveWebhook(
  providerWebhookEventId: string,
) {
  if (!providerWebhookEventId?.trim()) {
    throw new Error(
      "Flutterwave provider webhook event ID is required.",
    );
  }

  return FlutterwaveWebhookQueue.add(
    "process-flutterwave-webhook",
    {
      providerWebhookEventId:
        providerWebhookEventId.trim(),
    },
  );
}