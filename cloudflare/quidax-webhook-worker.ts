export interface Env {
  QUIDAX_WEBHOOK_SECRET?: string;
  SMARTPOS_BACKEND_WEBHOOK_URL?: string;
  SMARTPOS_WEBHOOK_SECRET?: string;
  MAX_WEBHOOK_BODY_BYTES?: string;
  INTERNAL_TIMEOUT_MS?: string;
  WORKER_ENVIRONMENT?: string;
  WEBHOOK_DEDUPE?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

const SERVICE_NAME = "smartpos-quidax-webhook";
const QUIDAX_SIGNATURE_HEADER = "quidax-signature";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function object(value: unknown): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    return null;
  }

  const result = new Uint8Array(value.length / 2);

  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(
      value.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return result;
}

function parseQuidaxSignature(value: string): {
  timestamp: string;
  signature: string;
} | null {
  const sections = value.split(",");

  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const section of sections) {
    const separator = section.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = section.slice(0, separator).trim();
    const itemValue = section.slice(separator + 1).trim();

    if (key === "timestamp") {
      timestamp = itemValue;
    }

    if (key === "signature") {
      signature = itemValue;
    }
  }

  if (!timestamp || !signature) {
    return null;
  }

  return {
    timestamp,
    signature,
  };
}

function constantTimeEqual(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

async function verifyQuidaxSignature(
  rawBody: ArrayBuffer,
  signatureHeader: string | undefined,
  env: Env,
): Promise<boolean> {
  const secret = text(env.QUIDAX_WEBHOOK_SECRET);

  if (!secret || !signatureHeader) {
    return false;
  }

  const parsed = parseQuidaxSignature(signatureHeader);

  if (!parsed) {
    return false;
  }

  const requestBody = new TextDecoder().decode(rawBody);
  const payload = `${parsed.timestamp}.${requestBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  const expected = new Uint8Array(digest);
  const actual = hexToBytes(parsed.signature);

  if (!actual) {
    return false;
  }

  return constantTimeEqual(expected, actual);
}

function eventValue(
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = text(payload[key]) || text(data[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeQuidaxEvent(
  payload: Record<string, unknown>,
  receivedAt: string,
  webhookId: string,
) {
  const data = object(payload.data);

  const eventName = eventValue(
    payload,
    data,
    [
      "event",
      "event_name",
      "name",
      "type",
    ],
  );

  const providerEventId = eventValue(
    payload,
    data,
    [
      "event_id",
      "eventId",
      "id",
      "public_id",
    ],
  );

  const providerReference = eventValue(
    payload,
    data,
    [
      "reference",
      "order_id",
      "withdrawal_id",
      "public_id",
      "id",
    ],
  );

  const merchantReference = eventValue(
    payload,
    data,
    [
      "merchant_reference",
      "merchantReference",
      "partner_reference",
    ],
  );

  if (
    !eventName ||
    (!providerEventId && !providerReference)
  ) {
    return null;
  }

  return {
    provider: "quidax",
    receivedAt,
    event: {
      name: eventName,
      providerEventId: providerEventId || webhookId,
      merchantReference,
      providerReference,
      raw: payload,
    },
    signatureVerified: true,
  };
}

function eventKey(
  envelope: {
    event: {
      name: string;
      providerEventId?: string;
      providerReference?: string;
    };
  },
): string {
  const identifier =
    envelope.event.providerEventId ||
    envelope.event.providerReference;

  return `quidax:${envelope.event.name}:${identifier}`;
}

async function forwardToSmartPOS(
  envelope: unknown,
  webhookId: string,
  env: Env,
): Promise<Response> {
  const url = text(env.SMARTPOS_BACKEND_WEBHOOK_URL);
  const secret = text(env.SMARTPOS_WEBHOOK_SECRET);

  if (!url || !secret) {
    return json(
      {
        error:
          "Worker backend forwarding is not configured.",
      },
      503,
    );
  }

  const timeout = Number(
    env.INTERNAL_TIMEOUT_MS || 10000,
  );

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "x-smartpos-webhook-provider": "quidax",
        "x-smartpos-webhook-version": "1",
        "x-smartpos-webhook-id": webhookId,
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });

    if (!response.ok) {
      return json(
        {
          error:
            "SmartPOS backend rejected the verified webhook.",
        },
        502,
      );
    }

    return json({
      ok: true,
      forwarded: true,
    });
  } catch {
    return json(
      {
        error:
          "SmartPOS backend unavailable.",
      },
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/health" ||
      (
        (url.pathname === "/api/quidax/webhook" || url.pathname === "/webhooks/quidax") &&
        request.method === "GET"
      )
    ) {
      return json({
        ok: true,
        service: SERVICE_NAME,
        environment:
          env.WORKER_ENVIRONMENT || "unknown",
      });
    }

    if (url.pathname !== "/api/quidax/webhook" && url.pathname !== "/webhooks/quidax") {
      return json(
        {
          error: "Not found",
        },
        404,
      );
    }

    if (request.method !== "POST") {
      return json(
        {
          error: "Method not allowed",
        },
        405,
      );
    }

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return json(
        {
          error:
            "Content-Type must be application/json",
        },
        415,
      );
    }

    const maxBytes = Number(
      env.MAX_WEBHOOK_BODY_BYTES || 262144,
    );

    const declaredLength = Number(
      request.headers.get("content-length") || 0,
    );

    if (declaredLength > maxBytes) {
      return json(
        {
          error: "Webhook payload too large",
        },
        413,
      );
    }

    const rawBody =
      await request.arrayBuffer();

    if (rawBody.byteLength > maxBytes) {
      return json(
        {
          error: "Webhook payload too large",
        },
        413,
      );
    }

    const signature =
      request.headers.get(
        QUIDAX_SIGNATURE_HEADER,
      ) || undefined;

    if (!text(env.QUIDAX_WEBHOOK_SECRET)) {
      return json(
        {
          error:
            "Webhook signature configuration unavailable",
        },
        503,
      );
    }

    if (!signature) {
      return json(
        {
          error:
            "Missing Quidax webhook signature",
        },
        401,
      );
    }

    const signatureValid =
      await verifyQuidaxSignature(
        rawBody,
        signature,
        env,
      );

    if (!signatureValid) {
      return json(
        {
          error:
            "Invalid webhook signature",
        },
        401,
      );
    }

    let payload:
      Record<string, unknown>;

    try {
      payload = object(
        JSON.parse(
          new TextDecoder().decode(rawBody),
        ),
      );
    } catch {
      return json(
        {
          error:
            "Malformed JSON payload",
        },
        400,
      );
    }

    const data = object(payload.data);

    const webhookId =
      text(
        request.headers.get(
          "x-quidax-webhook-id",
        ),
      ) ||
      eventValue(
        payload,
        data,
        [
          "event_id",
          "eventId",
          "id",
          "public_id",
        ],
      );

    if (!webhookId) {
      return json(
        {
          error:
            "Webhook event identifier is required",
        },
        400,
      );
    }

    const envelope =
      normalizeQuidaxEvent(
        payload,
        new Date().toISOString(),
        webhookId,
      );

    if (!envelope) {
      return json(
        {
          error:
            "Unsupported or incomplete Quidax event payload",
        },
        400,
      );
    }

    const dedupe =
      env.WEBHOOK_DEDUPE;

    if (!dedupe) {
      return json(
        {
          error:
            "Webhook deduplication is not configured",
        },
        503,
      );
    }

    const key = eventKey(envelope);

    if (await dedupe.get(key)) {
      return json({
        ok: true,
        duplicate: true,
      });
    }

    await dedupe.put(
      key,
      "received",
      {
        expirationTtl: 86400,
      },
    );

    const forwarded =
      await forwardToSmartPOS(
        envelope,
        webhookId,
        env,
      );

    if (!forwarded.ok) {
      await dedupe.delete(key);
    }

    return forwarded;
  },
};

export {
  verifyQuidaxSignature,
  normalizeQuidaxEvent,
};
