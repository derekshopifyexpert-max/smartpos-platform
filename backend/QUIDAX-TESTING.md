# Quidax Testing

## Required configuration

Use a development or sandbox Quidax account in `backend/.env`. Do not paste credentials into source, frontend environment variables, tests, or logs.

Configure only the verified current account values for `QUIDAX_API_KEY`, `QUIDAX_BASE_URL`, and `QUIDAX_ENVIRONMENT`. Do not add endpoint or authentication variables until they are confirmed in the official contract audit.

## Static checks

From `backend`:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd prisma validate --schema ..\database\schema\schema.prisma
npx.cmd prisma generate --schema ..\database\schema\schema.prisma
```

From `frontend`:

```powershell
npm.cmd run build
```

## Read-only provider checks

After starting the backend and logging into SmartPOS:

- `GET /api/v1/crypto/provider/status`
- `GET /api/v1/crypto/assets`
- `GET /api/v1/crypto/markets`
- `GET /api/v1/crypto/balances`
- `GET /api/v1/exchange/balance/:asset`

Confirm the response is from the configured Quidax account. Do not treat HTTP success as evidence of a completed trade or withdrawal.

## Trading checks

Do not enable quote or order execution until the current Quidax quote/order contract has been verified for the account. Once verified, test in sandbox with a permitted asset and market:

1. Request a quote and verify provider ID, rate, amount, fee, and expiration from Quidax.
2. Confirm an order once, then retry the same SmartPOS operation ID and verify no duplicate provider order is created.
3. Retrieve the provider order and trades; compare requested and executed amounts.
4. Test failure, rejection, timeout, partial fill, and refresh recovery.

## Withdrawal checks

Withdrawal persistence and status handling must be implemented before initiating a real withdrawal. Never test a withdrawal through an unpersisted or untracked path. When implemented, verify the provider withdrawal ID, status transitions, transaction hash, recipient, amount, network, and blockchain confirmations independently.

## Current limitation

The official Quidax reference pages were not machine-readable in the current environment and no Quidax credentials are configured in this workspace. Therefore no live authentication, balance, quote, order, trade, withdrawal, webhook, or blockchain delivery result is claimed here.
