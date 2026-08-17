# Part 1: Multi-Account Paystack Infrastructure

This document describes the infrastructure for supporting multiple Paystack accounts in SmartPOS.

## Overview

The system now supports multiple payment provider accounts (primarily Paystack) with the following capabilities:

- **Multiple Account Storage**: Store multiple Paystack credentials in the database
- **Safe Frontend Access**: Frontend can fetch account metadata without exposing secret keys
- **Account Selection UI**: Users can select which Paystack account to use for a payment
- **Credential Resolution**: Backend resolves credentials from environment variables or Vault
- **Status Tracking**: Each account tracks its configuration status (ACTIVE, NOT_CONFIGURED, etc.)

## Architecture

### Database Model

The `PaymentProviderAccount` model stores account metadata:

```prisma
model PaymentProviderAccount {
  id              String   @id @default(cuid())
  name            String   @unique              // e.g., "paystack-account-1"
  displayName     String                        // e.g., "Paystack Account 1"
  provider        String                        // e.g., "PAYSTACK"
  currency        String                        // e.g., "NGN"
  status          PaymentProviderAccountStatus  // ACTIVE, NOT_CONFIGURED, etc.
  secretKeyRef    String?                       // e.g., "PAYSTACK_ACCOUNT_1_SECRET_KEY"
  publicKey       String?
  metadata        Json?
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
}
```

### Service Layer

**`PaymentProviderAccountService`** provides the following methods:

- `listAccounts()` - Returns all accounts with safe metadata (no secrets)
- `getAccount(id)` - Fetch a single account
- `getAccountsByProvider(provider)` - Filter accounts by provider type
- `getDefaultAccount()` - Get the default account
- `resolveCredentials(id)` - Resolve secret key from env or Vault
- `isConfigured(id)` - Check if account has required credentials
- `upsertAccount(data)` - Create or update account (admin operation)

### Backend Routes

Safe endpoints exposed at `/api/v1/payment-provider-accounts`:

```
GET    /api/v1/payment-provider-accounts              # List all accounts
GET    /api/v1/payment-provider-accounts/:id          # Get single account
GET    /api/v1/payment-provider-accounts/by-provider/:provider  # Filter by provider
```

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid123",
      "name": "paystack-account-1",
      "displayName": "Paystack Account 1",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "ACTIVE",
      "configured": true,
      "isDefault": true,
      "createdAt": "2026-01-15T10:00:00Z"
    },
    {
      "id": "cuid456",
      "name": "paystack-account-2",
      "displayName": "Paystack Account 2",
      "provider": "PAYSTACK",
      "currency": "NGN",
      "status": "NOT_CONFIGURED",
      "configured": false,
      "isDefault": false,
      "createdAt": "2026-01-15T10:05:00Z"
    }
  ]
}
```

**Note:** Secret keys are NEVER exposed in responses, only metadata.

### Frontend Components

**`usePaymentProviderAccounts` Hook:**
```typescript
const { data: accounts, isLoading, error } = usePaymentProviderAccounts();
```

**`PaymentProviderAccountSelector` Component:**
- Displays available accounts with configuration status
- Allows user to select an account
- Shows warnings for unconfigured accounts
- Integrates with react-hook-form

## Setup Instructions

### 1. Initialize Database

```bash
cd backend
npm run prisma:push
```

This creates the `PaymentProviderAccount` table.

### 2. Seed Test Accounts

```bash
npx ts-node scripts/seed-payment-provider-accounts.ts
```

This creates example accounts:
- `paystack-account-1` (NGN, isDefault=true)
- `paystack-account-2` (NGN)
- `paystack-account-usd` (USD, for future use)

### 3. Add Environment Variables

Update `.env` or configure in Vault:

```env
# Paystack Account 1
PAYSTACK_ACCOUNT_1_SECRET_KEY=sk_live_your_key_1
PAYSTACK_ACCOUNT_1_PUBLIC_KEY=pk_live_your_key_1

# Paystack Account 2
PAYSTACK_ACCOUNT_2_SECRET_KEY=sk_live_your_key_2
PAYSTACK_ACCOUNT_2_PUBLIC_KEY=pk_live_your_key_2

# Additional accounts via database only (no env vars needed)
```

### 4. Verify Configuration

Check that accounts are marked as `ACTIVE`:

```bash
curl http://localhost:4000/api/v1/payment-provider-accounts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response should show `"status": "ACTIVE"` for configured accounts.

## Frontend Integration

### Example: Add Account Selector to Payment Form

```typescript
import { PaymentProviderAccountSelector } from "@/features/payment/components/payment-provider-account-selector";

export function NewPaymentForm() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  return (
    <form>
      {/* Other form fields */}
      
      <PaymentProviderAccountSelector
        provider="PAYSTACK"
        selectedAccountId={selectedAccountId}
        onAccountSelect={setSelectedAccountId}
      />
      
      {/* Continue button */}
      <button
        disabled={!selectedAccountId}
        onClick={() => initializePayment(selectedAccountId)}
      >
        Proceed to Payment
      </button>
    </form>
  );
}
```

### Example: Hook Usage

```typescript
import { usePaymentProviderAccountsByProvider } from "@/features/payment/hooks/use-payment-provider-accounts";

export function AccountListComponent() {
  const { data: accounts, isLoading } = usePaymentProviderAccountsByProvider("PAYSTACK");

  if (isLoading) return <div>Loading accounts...</div>;

  return (
    <div>
      {accounts?.map((account) => (
        <div key={account.id}>
          <h3>{account.displayName}</h3>
          <p>Status: {account.status}</p>
          <p>Currency: {account.currency}</p>
        </div>
      ))}
    </div>
  );
}
```

## Security Considerations

### ✅ What's Secure

- **No secrets exposed to frontend** - only account ID and metadata
- **Backend resolves credentials** - frontend never handles API keys
- **Vault integration** - optional support for HashiCorp Vault
- **Status checks** - prevent payment with unconfigured accounts
- **Audit trail** - createdAt/updatedAt timestamps track changes

### ⚠️ Important Restrictions

- **Do not store secrets in database** - use env vars or Vault only
- **Do not expose `secretKeyRef` to frontend** - only backend reads this
- **Do not hardcode account names** - use database for flexibility
- **Do not bypass account selection** - always validate selectedAccountId

## Testing

### Unit Test Example

```typescript
describe("PaymentProviderAccountService", () => {
  it("should list accounts without exposing secrets", async () => {
    const accounts = await service.listAccounts();
    expect(accounts[0].secretKeyRef).toBeUndefined();
    expect(accounts[0].id).toBeDefined();
  });

  it("should resolve credentials from env", async () => {
    process.env.PAYSTACK_ACCOUNT_1_SECRET_KEY = "sk_test_123";
    const credentials = await service.resolveCredentials("account-1-id");
    expect(credentials.secretKey).toBe("sk_test_123");
  });
});
```

## Future Extensions (Part 2+)

- [ ] Wire selectedAccountId through payment flow
- [ ] Support multiple currencies per provider
- [ ] Add account balance endpoint
- [ ] Implement account switching during payment
- [ ] Add payment distribution across accounts
- [ ] Implement Flutterwave/other providers with same pattern

## Troubleshooting

### Accounts show `NOT_CONFIGURED`

**Cause:** Environment variables not set
**Solution:** Add `PAYSTACK_ACCOUNT_*_SECRET_KEY` to `.env` or Vault

### "Account not found" error

**Cause:** Account ID doesn't exist in database
**Solution:** Run seed script or manually insert via database

### Frontend can't fetch accounts

**Cause:** API endpoint not registered
**Solution:** Verify `paymentProviderAccountRoutes` is imported and registered in `routes/index.ts`

### TypeScript errors with PaymentProviderAccount

**Cause:** Prisma types not generated
**Solution:** Run `npm run prisma:generate`

## Files Modified/Created

**Backend:**
- `src/services/payment-provider-account.service.ts` - Service for managing accounts
- `src/routes/payment-provider-account.routes.ts` - API endpoints
- `src/routes/index.ts` - Route registration (MODIFIED)
- `scripts/seed-payment-provider-accounts.ts` - Seed script
- `database/schema/schema.prisma` - Database schema (MODIFIED)
- `.env.example` - Environment variables (MODIFIED)

**Frontend:**
- `features/payment/hooks/use-payment-provider-accounts.ts` - React query hook
- `features/payment/components/payment-provider-account-selector.tsx` - UI component
- `components/ui/radio-group.tsx` - Radio button component

## Next Steps

1. Run `npm run prisma:push` to apply schema
2. Seed test accounts with the seed script
3. Add environment variables to `.env`
4. Integrate `PaymentProviderAccountSelector` into payment forms
5. Verify endpoints respond with account metadata
6. Test account selection before payment initialization

---

**Status:** Part 1 Complete - Infrastructure ready for account selection
**Part 2:** Wire account selection through payment flow (coming next)
