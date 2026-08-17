# API Endpoint Examples

## Base URL
```
http://localhost:4000/api/v1
```

---

## 1. List All Payment Provider Accounts

### Request
```bash
curl http://localhost:4000/api/v1/payment-provider-accounts \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Accept: application/json"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "clx5a2k9v0000xxyyzz123abc",
      "name": "paystack-account-1",
      "displayName": "Paystack Account 1",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "ACTIVE",
      "publicKey": "pk_live_abc123def456",
      "isDefault": true,
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "clx5a2k9v0001xxyyzz123def",
      "name": "paystack-account-2",
      "displayName": "Paystack Account 2",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "NOT_CONFIGURED",
      "publicKey": null,
      "isDefault": false,
      "createdAt": "2026-01-15T10:05:00.000Z"
    },
    {
      "id": "clx5a2k9v0002xxyyzz123ghi",
      "name": "paystack-account-usd",
      "displayName": "Paystack USD Account",
      "provider": "PAYSTACK",
      "currency": "USD",
      "status": "NOT_CONFIGURED",
      "publicKey": null,
      "isDefault": false,
      "createdAt": "2026-01-15T10:10:00.000Z"
    }
  ]
}
```

### Response (500 Error)
```json
{
  "success": false,
  "error": "Failed to retrieve payment provider accounts"
}
```

---

## 2. Get Single Payment Provider Account

### Request
```bash
curl http://localhost:4000/api/v1/payment-provider-accounts/clx5a2k9v0000xxyyzz123abc \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Accept: application/json"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "clx5a2k9v0000xxyyzz123abc",
    "name": "paystack-account-1",
    "displayName": "Paystack Account 1",
    "provider": "PAYSTACK",
    "currency": "NGN",
    "status": "ACTIVE",
    "publicKey": "pk_live_abc123def456",
    "isDefault": true,
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

### Response (404 Not Found)
```json
{
  "success": false,
  "error": "Payment provider account not found"
}
```

### Response (500 Error)
```json
{
  "success": false,
  "error": "Failed to retrieve payment provider account"
}
```

---

## 3. Get Accounts by Provider

### Request
```bash
curl http://localhost:4000/api/v1/payment-provider-accounts/by-provider/PAYSTACK \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Accept: application/json"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "clx5a2k9v0000xxyyzz123abc",
      "name": "paystack-account-1",
      "displayName": "Paystack Account 1",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "ACTIVE",
      "publicKey": "pk_live_abc123def456",
      "isDefault": true,
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "clx5a2k9v0001xxyyzz123def",
      "name": "paystack-account-2",
      "displayName": "Paystack Account 2",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "NOT_CONFIGURED",
      "publicKey": null,
      "isDefault": false,
      "createdAt": "2026-01-15T10:05:00.000Z"
    },
    {
      "id": "clx5a2k9v0002xxyyzz123ghi",
      "name": "paystack-account-usd",
      "displayName": "Paystack USD Account",
      "provider": "PAYSTACK",
      "currency": "USD",
      "status": "NOT_CONFIGURED",
      "publicKey": null,
      "isDefault": false,
      "createdAt": "2026-01-15T10:10:00.000Z"
    }
  ]
}
```

### Response (500 Error)
```json
{
  "success": false,
  "error": "Failed to retrieve payment provider accounts"
}
```

---

## Account Status Reference

### ACTIVE
- Account is configured
- Environment variables or Vault contains secretKeyRef
- Ready for payment processing

### NOT_CONFIGURED
- Account exists but credentials not set
- secretKeyRef exists but env var/Vault value is missing
- Cannot be used for payments
- User should set environment variable first

### DISABLED
- Account manually disabled by admin
- Cannot be used for payments
- Can be re-enabled by updating status

### SUSPENDED
- Account suspended due to violation or issue
- Requires admin intervention to resolve
- Cannot be used for payments

---

## Frontend Hook Usage

### Fetch All Accounts
```typescript
import { usePaymentProviderAccounts } from "@/features/payment/hooks/use-payment-provider-accounts";

export function AccountList() {
  const { data: accounts, isLoading, error } = usePaymentProviderAccounts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {accounts?.map((account) => (
        <li key={account.id}>
          {account.displayName} - {account.status}
        </li>
      ))}
    </ul>
  );
}
```

### Fetch Accounts by Provider
```typescript
import { usePaymentProviderAccountsByProvider } from "@/features/payment/hooks/use-payment-provider-accounts";

export function PaystackAccounts() {
  const { data: accounts } = usePaymentProviderAccountsByProvider("PAYSTACK");

  return (
    <div>
      {accounts?.map((account) => (
        <div key={account.id}>{account.displayName}</div>
      ))}
    </div>
  );
}
```

### Fetch Single Account
```typescript
import { usePaymentProviderAccount } from "@/features/payment/hooks/use-payment-provider-accounts";

export function AccountDetail({ accountId }: { accountId: string }) {
  const { data: account } = usePaymentProviderAccount(accountId);

  return (
    <div>
      <h2>{account?.displayName}</h2>
      <p>Provider: {account?.provider}</p>
      <p>Currency: {account?.currency}</p>
      <p>Status: {account?.status}</p>
    </div>
  );
}
```

---

## Important Notes

### Security
- **NO SECRET KEYS in responses** - only account ID and metadata
- **NO ENVIRONMENT VARIABLE NAMES in responses** - only status indicators
- **Backend-only credential resolution** - use `resolveCredentials()` server-side only

### Data Format
- All timestamps are ISO 8601 format (UTC)
- Status is always one of: ACTIVE, NOT_CONFIGURED, DISABLED, SUSPENDED
- Currency is ISO 4217 code (e.g., NGN, USD, GBP)
- Public key may be null for some providers

### Error Handling
- 500 errors indicate server-side issues
- 404 errors indicate account not found
- All errors return consistent error response format
- Check `success` boolean before reading `data`

---

## Testing in cURL

### List all accounts
```bash
curl -s http://localhost:4000/api/v1/payment-provider-accounts | jq
```

### Get Paystack accounts only
```bash
curl -s http://localhost:4000/api/v1/payment-provider-accounts/by-provider/PAYSTACK | jq
```

### Get specific account
```bash
curl -s http://localhost:4000/api/v1/payment-provider-accounts/clx5a2k9v0000xxyyzz123abc | jq
```

---

## Migration from Old System

If migrating from single Paystack account:

1. Create multiple `PaymentProviderAccount` records in database
2. Migrate environment variables to appropriate names:
   - Old: `PAYSTACK_SECRET_KEY` → New: `PAYSTACK_ACCOUNT_1_SECRET_KEY`
3. Update frontend to use `PaymentProviderAccountSelector` component
4. Update payment initialization to require account selection
5. Update payment service to use `resolveCredentials()` with selected account ID

No breaking changes to existing data - gradual migration possible.
