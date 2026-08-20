# Quidax Contract Audit

Date: 2026-08-20
Provider: Quidax
Status: Exchange API verified from official docs; Ramp card quote not configured

## Base URL

The official exchange API server is:

`https://openapi.quidax.io/exchange-open-api/api/v1`

A request to the base path alone may return 404 because it is only a URL prefix. Resources must be appended.

## Exchange API authentication

Official exchange API examples use:

```http
Authorization: Bearer <QUIDAX_API_KEY>
Accept: application/json
Content-Type: application/json
```

The API key remains server-side.

## Contract matrix

| Operation | Verified endpoint | Auth | Request | Response | Status |
|---|---|---|---|---|---|
| Markets | `GET /markets` | Bearer API key | None | `{ status, message, data[] }` market objects with `id`, `base_unit`, `quote_unit`, `trading_rules` | Verified |
| Market tickers | `GET /markets/tickers` | Bearer API key | None | `{ status, message, data }` keyed ticker objects | Verified |
| User wallets/balances | `GET /users/me/wallets` | Bearer API key | None | `{ status, message, data[] }` wallet objects with `currency`, `balance`, `locked`, networks | Verified |
| BUY order | `POST /users/me/orders` | Bearer API key | `market`, `side`, `ord_type`, `price` for limit orders, `volume` | Order object with `id`, market, side, volume, status, trades, timestamps | Verified |
| SELL order | `POST /users/me/orders` | Bearer API key | Same order schema with `side=sell` | Order object | Verified |
| Order status | `GET /users/me/orders/{order_id}` | Bearer API key | None | Order object, including executed volume/status/trades where available | Verified |
| Withdrawal fee | `GET /users/me/fee_rule?currency={currency}&amount={amount}&network={network}` | Bearer API key | Query parameters | `{ data: { fee, type } }` | Verified |
| Withdrawal | `POST /users/me/withdraws` | Bearer API key | `currency`, `amount`, `fund_uid`, `reference`, optional `network`, notes | Withdrawal with `id`, `status`, `amount`, `fee`, `txId` | Verified |
| Withdrawal status | `GET /users/me/withdraws/{withdrawal_id}` | Bearer API key | None | Withdrawal object | Verified |
| Transaction hash | `txId` in withdrawal response/details | Bearer API key | None | May be null while processing | Verified field; blockchain confirmation remains separate |
| Webhooks | Configured callback URL and event-specific payloads | Separate webhook signing secret | Raw signed JSON | Event payload | Documentation verified; live event not tested |
| Supported networks | Asset/network metadata and documented network fields | Bearer API key | Asset-specific | Wallet/network data | Validate per asset |

## Card-to-crypto quote limitation

The official documentation places fiat purchase quotes under the separate Ramp Merchant API:

`https://ramp-be.quidax.io/api/v1/merchants/`

The documented BUY quote uses `POST /purchase_quotes/buy` and the `x-private-key` header. This is not the exchange API endpoint and is not authorized merely by assuming the exchange API key is the Ramp private key.

Therefore the current SmartPOS configuration can support verified exchange API reads/orders/withdrawals, but the card-to-crypto Ramp quote/order flow remains blocked until the separate Ramp merchant credential and account capability are provided and configured.

## Current implementation

- `QuidaxClient` sends the documented Bearer API-key header.
- `QuidaxProviderAdapter` implements documented exchange paths for markets, wallets, orders, order details, withdrawal fees, and withdrawals.
- Fiat purchase quotes remain explicitly unavailable until the Ramp Merchant API credential is configured.
- No fallback to Paystack, Stripe, Transak, or a mock provider exists in the active Quidax path.
- No transaction is marked completed merely because an order request is accepted.
- Webhook processing remains an authenticated/idempotent receipt path; final state requires backend/provider reconciliation.

## Official sources

- https://docs.quidax.io/reference/create-a-sell-or-buy-order.md
- https://docs.quidax.io/reference/get-an-order-details.md
- https://docs.quidax.io/reference/get-all-orders.md
- https://docs.quidax.io/reference/fetch-user-wallets.md
- https://docs.quidax.io/reference/create-withdrawal.md
- https://docs.quidax.io/reference/get-crypto-withdrawal-fees.md
- https://docs.quidax.io/reference/purchase-quotes.md
- https://docs.quidax.io/docs/security.md
- https://docs.quidax.io/docs/introduction.md
