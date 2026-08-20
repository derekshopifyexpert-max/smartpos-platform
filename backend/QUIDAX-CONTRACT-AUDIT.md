# Quidax Contract Audit

Date: 2026-08-19
Provider: Quidax
Status: NOT VERIFIED

This audit is intentionally conservative. The available documentation source was not machine-readable in this environment, and no Quidax credentials or account-specific API contract were available. No endpoint, authentication header, request body, response field, webhook signature, rate limit, or network capability below is treated as verified.

## Contract matrix

| Operation | Verified endpoint | Auth | Request | Response | Error | Status |
|---|---|---|---|---|---|---|
| Provider health/status | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Supported assets | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Markets | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Quotes/market pricing | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Provider balances | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| BUY order | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| SELL order | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Order status | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Order fills/trades | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Withdrawal | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Withdrawal status | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Transaction hash retrieval | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Webhooks | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Supported networks | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |
| Network-specific withdrawal requirements | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | BLOCKED |

## Authentication

The adapter does not guess whether Quidax requires an API-key header, bearer token, secret, signature, or another mechanism. No provider request is enabled until the official account contract confirms the exact method. Credentials remain backend-only.

## Current implementation behavior

- `ExchangeService` selects only the Quidax adapter for the active exchange path.
- The adapter throws `QUIDAX_CONTRACT_NOT_VERIFIED` for balances, assets, markets, quotes, orders, fills, withdrawal fees, withdrawals, and withdrawal status.
- The legacy internal exchange-to-SmartPOS blockchain settlement method is disabled.
- No fake balance, quote, order, fee, withdrawal ID, transaction hash, or confirmation is generated.
- Existing legacy Paystack, Stripe, Transak, and generic provider modules remain in the repository only for compatibility and historical code; they are not selected by the active exchange provider boundary.

## Required evidence before enabling operations

Obtain the current Quidax official API reference or account integration pack containing exact method/path, auth, request, response, errors, pagination, sandbox/production, idempotency, network, withdrawal, and webhook details. Then add focused contract tests using captured safe fixtures and enable one operation at a time.
