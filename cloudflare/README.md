# Quidax Webhook Worker

The Worker source is [`quidax-webhook-worker.ts`](quidax-webhook-worker.ts). It is intentionally a single native Cloudflare Worker file and has no database or Quidax API client.

## Current signature status

The repository does not contain a verified Quidax signature header, algorithm, or encoding. The Worker therefore fails closed unless all of these values are explicitly configured:

- `QUIDAX_WEBHOOK_SECRET`
- `QUIDAX_SIGNATURE_TYPE`
- `QUIDAX_SIGNATURE_HEADER`
- `QUIDAX_SIGNATURE_ENCODING`

Only `HMAC-SHA256` is implemented, and only when `QUIDAX_SIGNATURE_TYPE=HMAC-SHA256` is explicitly selected from the Quidax dashboard. If Quidax uses another configured signature type, the Worker returns `503` and forwards nothing until the matching Web Crypto implementation is added from the official contract.

## Required Worker variables and binding

- `QUIDAX_WEBHOOK_SECRET`: Cloudflare secret containing the Quidax webhook secret.
- `QUIDAX_SIGNATURE_TYPE`: exact configured Quidax signature type.
- `QUIDAX_SIGNATURE_HEADER`: exact configured request header name.
- `QUIDAX_SIGNATURE_ENCODING`: explicit `hex` or `base64` encoding.
- `SMARTPOS_BACKEND_WEBHOOK_URL`: `https://<smartpos-host>/api/v1/webhooks/quidax`.
- `SMARTPOS_WEBHOOK_SECRET`: separate Cloudflare secret shared only with SmartPOS backend.
- `MAX_WEBHOOK_BODY_BYTES`: optional, defaults to `262144`.
- `INTERNAL_TIMEOUT_MS`: optional, defaults to `10000`.
- `WORKER_ENVIRONMENT`: optional deployment label.
- `WEBHOOK_DEDUPE`: required KV namespace binding.

The Worker does not expose any of these values through health responses or logs.

## Wrangler setup

Use the repository's Cloudflare account and environment configuration. Do not commit a `wrangler.toml` containing secrets.

```sh
npx wrangler secret put QUIDAX_WEBHOOK_SECRET
npx wrangler secret put SMARTPOS_WEBHOOK_SECRET
npx wrangler secret put SMARTPOS_BACKEND_WEBHOOK_URL
npx wrangler secret put QUIDAX_SIGNATURE_TYPE
npx wrangler secret put QUIDAX_SIGNATURE_HEADER
npx wrangler secret put QUIDAX_SIGNATURE_ENCODING
npx wrangler deploy cloudflare/quidax-webhook-worker.ts
```

The KV binding must be named `WEBHOOK_DEDUPE` in the Cloudflare Worker deployment configuration. Configure separate namespaces for staging and production.

## Backend

Set the separate `SMARTPOS_WEBHOOK_SECRET` in `backend/.env`. The backend endpoint is:

`POST /api/v1/webhooks/quidax`

The backend authenticates the Worker, requires `provider=quidax`, validates the event identifier, and persists a unique `ProviderWebhookEvent`. It does not update balances, orders, withdrawals, blockchain transactions, or settlement state from this ingress.

## Safety behavior

- Raw request bytes are signature-verified before JSON parsing.
- Missing or unsupported signature configuration returns `503`.
- Invalid signatures return `401`.
- Oversized payloads return `413`.
- Duplicate KV events return `200` without forwarding.
- Backend failure removes the KV marker and returns a non-2xx response so Quidax can retry.
- No Worker path creates financial records, balances, hashes, confirmations, or settlement state.

No Worker URL or live signed Quidax webhook is claimed until deployment and the Quidax dashboard configuration are completed.