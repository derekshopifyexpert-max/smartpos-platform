import { Queue } from "bullmq";
import { Redis } from "ioredis";

import env from "../config/env.js";

const connection =
  new Redis(
    env.REDIS_URL,
    {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
  );

export const BullConnection =
  connection;

export const PaymentQueue =
  new Queue(
    "payments",
    {
      connection,
    },
  );

export const SettlementQueue =
  new Queue(
    "settlements",
    {
      connection,
    },
  );

export const FlutterwaveWebhookQueue =
  new Queue(
    "flutterwave-webhooks",
    {
      connection,
    },
  );

export const BlockchainQueue =
  new Queue(
    "blockchain",
    {
      connection,
    },
  );

export const NotificationQueue =
  new Queue(
    "notifications",
    {
      connection,
    },
  );