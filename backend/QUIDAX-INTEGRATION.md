# Quidax Integration

SmartPOS uses the server-side Quidax adapter for the active crypto exchange path. Browser code calls SmartPOS routes only; Quidax credentials and authorization headers remain on the backend.

## Configuration

Set the following in `backend/.env` using values from the current Quidax account documentation:

- `QUIDAX_API_KEY`
- `QUIDAX_BASE_URL`
- `QUIDAX_ENVIRONMENT=sandbox` or `production`
- `QUIDAX_TIMEOUT_MS`

`QUIDAX_API_SECRET` is retained as an optional configuration slot only. The adapter does not send or require it unless the verified Quidax authentication contract for the account requires it.

Authentication header and scheme are intentionally required configuration. The adapter does not guess whether the current Quidax account uses a bearer, API-key, or another documented header.

Do not place credentials in frontend environment variables, source files, database records, logs, or documentation.

## Current boundary

`ExchangeService.getExchangeProvider()` selects `QuidaxProviderAdapter` and fails closed when Quidax configuration is missing. It no longer falls back to a generic database provider or mock provider for the active exchange order path.

The adapter normalizes balances, orders, trades, and withdrawals into SmartPOS types. Missing provider fields are rejected or marked unavailable; the adapter does not generate prices, IDs, fees, balances, transaction hashes, or confirmations.

## Capabilities

The adapter surface exists for balance, asset, market, order, trade, withdrawal-fee, and withdrawal operations, but each operation currently fails with `QUIDAX_CONTRACT_NOT_VERIFIED`. No endpoint mapping or response parser is enabled until the official contract is captured and tested. Quote execution is also disabled.

The authenticated health endpoint is `GET /api/v1/crypto/provider/status`. It returns only provider name, configured environment, connection state, safe account identifier, and a safe error message.

Withdrawal initiation is not proof of delivery. Provider withdrawal status, transaction hash, and blockchain confirmation must be recorded separately before SmartPOS can report settlement.

## Verification status

The official Quidax reference pages were not machine-readable in the current environment, and no Quidax credentials are configured in the repository. Therefore live authentication, balances, trading, withdrawals, webhooks, and blockchain delivery remain unverified. See `QUIDAX-CONTRACT-AUDIT.md` for the operation matrix and required evidence.
