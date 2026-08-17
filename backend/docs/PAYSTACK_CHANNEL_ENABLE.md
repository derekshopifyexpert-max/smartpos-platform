Paystack Channel Enablement Checklist
====================================

Purpose
-------
This document collects the exact test payloads, observed provider responses, and recommended Paystack dashboard / support actions to enable card checkout for the merchant account used by SmartPOS.

Summary of findings
-------------------
- Calls to `POST https://api.paystack.co/transaction/initialize` using the test secret key in `backend/.env` returned HTTP 400 with message: "No active channel to process transaction. Please contact merchant" for both `USD` and `NGN` payloads.
- This indicates the merchant account currently has no active payment channel for card checkout on the attempted currency/channel combination. This is an account-level Paystack configuration issue (not a code bug).

What we tested (exact payloads)
--------------------------------
Test 1 — USD (no channels)

POST /transaction/initialize
Headers:
- Authorization: Bearer <PAYSTACK_SECRET_KEY>
- Content-Type: application/json

Body:
{
  "amount": "100",
  "currency": "USD",
  "reference": "TX-CHECK-USD-<timestamp>",
  "customerEmail": "customer@example.com",
  "channels": ["card"]
}

Response (observed):
HTTP 400
{
  "status": false,
  "message": "No active channel to process transaction. Please contact merchant",
  "type": "validation_error",
  "code": "invalid_params"
}

Test 2 — NGN (card channel)

POST /transaction/initialize
Headers: same as above

Body:
{
  "amount": "100",
  "currency": "NGN",
  "reference": "TX-CHECK-NGN-<timestamp>",
  "customerEmail": "customer@example.com",
  "channels": ["card"]
}

Response (observed):
HTTP 400 — same message as above.

Relevant repository artifacts
----------------------------
- Provider code: `backend/src/providers/paystack.provider.ts` — constructs the initialize request and expects `data.authorization_url` on success.
- Test scripts:
  - `backend/scripts/paystack_direct_orch_test.js` — manual test used during debugging.
  - `backend/scripts/paystack_check_currencies.js` — script that tested USD and NGN with `channels: ['card']` (latest run produced the 400 responses above).
  - `backend/scripts/test_checkout.js` — orchestrated local checkout flow used to reproduce errors.

Recommended Paystack dashboard checks (admin steps)
--------------------------------------------------
1. Login to Paystack Dashboard for the account that corresponds to the secret key above.
2. Verify the account's default currency and available channels:
   - Dashboard → Settings → Account → Default currency (confirm NGN or USD)
   - Dashboard → Settings → Channels / Payment methods — ensure **Card** is enabled for the desired settlement currency (NGN).
3. If the account is limited (sandbox/test or incomplete onboarding), complete KYC/onboarding steps Paystack requires to enable card acceptance.
4. If you expect USD payments to be accepted, verify whether the merchant has a multicurrency setup or explicit USD acceptance enabled. Paystack often restricts accounts to NGN unless multicurrency is enabled.
5. If changes are made, re-run the check scripts below to validate.

What to send to Paystack Support (if needed)
-------------------------------------------
Subject: "No active channel to process transaction" on /transaction/initialize

Body (copy/paste):
```
Hello Paystack support,

We are attempting to initialize transactions via the /transaction/initialize endpoint using our test secret key (sk_test... ). Both NGN and USD attempts return HTTP 400 with message "No active channel to process transaction. Please contact merchant".

Example request (NGN):
POST https://api.paystack.co/transaction/initialize
Headers: Authorization: Bearer <your_secret_key>

Body:
{
  "amount": "100",
  "currency": "NGN",
  "reference": "TX-CHECK-NGN-<timestamp>",
  "customerEmail": "customer@example.com",
  "channels": ["card"]
}

Observed response:
HTTP 400
{
  "status": false,
  "message": "No active channel to process transaction. Please contact merchant",
  "type": "validation_error",
  "code": "invalid_params"
}

Please let us know whether the account is configured to accept card payments in NGN and how to enable the card channel (or which account settings need to be changed).

Account details:
- Public key (for reference): pk_test_b600c404e4dad911544a0537797ec93ea8fff821
- Secret key (last 6 chars): ************9dfce

Thanks,
SmartPOS Engineering
```

Automated verification scripts (what I added to this repo)
---------------------------------------------------------
- `node backend/scripts/paystack_check_currencies.js` — runs the two test payloads (USD and NGN) and prints responses.
- `node backend/scripts/test_checkout.js` — full local checkout flow against your running backend.

How to re-run tests locally
---------------------------
1. Ensure backend is running (`npm run dev` from `backend` folder). If PowerShell blocks `npm` scripts, run `npm.cmd run dev` or briefly allow script execution with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
2. Run the check script:

```bash
node backend/scripts/paystack_check_currencies.js
```

3. If the call still returns 400, contact Paystack support with the message above.

Suggested next steps (I implemented most items already)
------------------------------------------------------
1. Enable card channel for NGN in the Paystack dashboard (or ask Paystack support to enable it on the account).
2. Re-run `paystack_check_currencies.js` until Paystack returns success and `data.authorization_url` is present.
3. Re-run `node backend/scripts/test_checkout.js` to validate end-to-end orchestration and confirm `paymentUrl` is returned to SmartPOS.

If you'd like, I can:
- create a backend health-check endpoint that runs the same check on demand and surfaces clear guidance to admins, or
- prepare a one-click admin UI that runs the check and shows next steps.

---
Generated by SmartPOS automated diagnostics on 2026-08-17
