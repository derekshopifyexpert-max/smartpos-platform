# Part 4 Preview: Frontend Trading Interface

**Status: NOT YET IMPLEMENTED**

This document outlines what Part 4 will include after Part 3C is complete. Part 4 is the next phase and should not be started yet.

## Part 4 Scope: Frontend Crypto Trading UI

### Pages to Build

#### 1. Crypto Trading Dashboard
**Route**: `/merchant/crypto-trading`

Shows real-time overview:
```
┌─────────────────────────────────────────────┐
│ Crypto Trading Dashboard                    │
├─────────────────────────────────────────────┤
│                                             │
│  Live Pricing                               │
│  ┌────────────────────────────────────────┐ │
│  │ USDT/USD: $1.0001                      │ │
│  │ Last Update: 2:30:45 PM                │ │
│  │ Provider: Binance                      │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Quick Actions                              │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ BUY USDT         │  │ SELL USDT        │ │
│  │ (Button)         │  │ (Button)         │ │
│  └──────────────────┘  └──────────────────┘ │
│                                             │
│  Provider Account                           │
│  ┌────────────────────────────────────────┐ │
│  │ Connected: Binance (ABC123...)         │ │
│  │ USDT Balance: 5,000.50                 │ │
│  │ Last Updated: 2:30:30 PM               │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

Features:
- Real-time price ticker (updates via polling or WebSocket)
- Balance display from `/exchange/balance/USDT`
- Links to BUY and SELL modals
- Display which provider is connected
- Show last update timestamp

#### 2. BUY USDT Modal/Page
**Route**: `/merchant/crypto-trading/buy`

Flow:
```
┌─────────────────────────────────────────────┐
│ Buy USDT                                    │
├─────────────────────────────────────────────┤
│                                             │
│ You Pay (NGN/USD):                         │
│ ┌─────────────────────┐                    │
│ │ 1000.00            │ NGN                 │
│ └─────────────────────┘                    │
│                                             │
│ [Get Quote] Button                         │
│                                             │
│ Quote Results (after Get Quote):           │
│ ┌────────────────────────────────────────┐ │
│ │ You Get: 999.90 USDT                   │ │
│ │ Rate: 1.00010 NGN/USDT                 │ │
│ │ Fee: 0.10 USDT                         │ │
│ │ Quote expires in: 28 seconds           │ │
│ │ Quote ID: quote_abc123                 │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ Destination Wallet:                        │
│ ┌─────────────────────────────────────┐   │
│ │ [Dropdown: Select Wallet]           │   │
│ │ - My Ethereum Wallet (0x123...)      │   │
│ │ - My BSC Wallet (0x456...)           │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [Cancel]  [Confirm & Pay]                 │
│                                             │
└─────────────────────────────────────────────┘
```

API Calls:
1. **Get Quote**:
   ```
   POST /exchange/real-quote
   {
     "baseAsset": "USDT",
     "quoteAsset": "NGN",
     "side": "BUY",
     "amount": "1000.00"
   }
   ```

2. **Execute BUY** (on Confirm):
   ```
   POST /payment-intents/:paymentIntentId/crypto-settlement
   {
     "transactionId": "tx_123",
     "asset": "USDT",
     "network": "ETHEREUM",
     "walletId": "wallet_xyz"
   }
   ```

3. **Poll Settlement Status**:
   ```
   GET /payment-intents/:paymentIntentId
   → Check transaction.cryptoSettlement.status
   → Poll blockchain transaction status
   ```

Features:
- Real-time quote countdown timer
- Prevents submission if quote expired
- Shows actual fee breakdown
- Validates wallet selection
- Displays quote before payment
- Cannot proceed without valid quote

#### 3. SELL USDT Modal/Page
**Route**: `/merchant/crypto-trading/sell`

Flow:
```
┌─────────────────────────────────────────────┐
│ Sell USDT                                   │
├─────────────────────────────────────────────┤
│                                             │
│ Amount to Sell:                            │
│ ┌─────────────────────┐                    │
│ │ 100.00            │ USDT                │
│ │                   │                     │
│ │ Available: 500.00 USDT [Max]            │
│ └─────────────────────┘                    │
│                                             │
│ [Get Quote] Button                         │
│                                             │
│ Quote Results (after Get Quote):           │
│ ┌────────────────────────────────────────┐ │
│ │ You Get: 99.99 USD                     │ │
│ │ Rate: 0.99990 USDT/USD                 │ │
│ │ Fee: 0.01 USDT                         │ │
│ │ Quote expires in: 29 seconds           │ │
│ │ Quote ID: quote_def456                 │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ Settlement Method:                         │
│ ⚪ Bank Transfer (via provider)            │
│ ⚫ Wallet Address (direct)                 │
│ ⚪ Hold as USDT (on-chain)                 │
│                                             │
│ [Cancel]  [Confirm & Sell]                │
│                                             │
└─────────────────────────────────────────────┘
```

API Calls:
1. **Get Quote**:
   ```
   POST /exchange/real-quote
   {
     "baseAsset": "USDT",
     "quoteAsset": "USD",
     "side": "SELL",
     "amount": "100.00"
   }
   ```

2. **Execute SELL** (on Confirm):
   ```
   POST /exchange/sell
   {
     "baseAsset": "USDT",
     "quoteAsset": "USD",
     "amount": "100.00",
     "quoteId": "quote_def456",
     "clientOrderId": "sell_user_action_timestamp"
   }
   ```

3. **Poll Order Status**:
   ```
   GET /exchange/orders/:orderId
   ```

Features:
- Show available USDT balance (from provider)
- Max button to fill input
- Validate quote before executing
- Show fee breakdown
- Display resulting amount

#### 4. Transaction History
**Route**: `/merchant/crypto-trading/history`

Shows all BUY/SELL transactions:
```
┌─────────────────────────────────────────────┐
│ Crypto Trading History                      │
├──────────────────────────────────────────────┤
│                                              │
│ Transaction ID | Type | Amount | Status    │
├──────────────────────────────────────────────┤
│ tx_1001        | BUY  | 1000 NGN  | SETTLED │
│ tx_1000        | BUY  | 500 USD   | CONFIRMING │
│ tx_999         | SELL | 100 USDT  | FILLED  │
│ tx_998         | BUY  | 2000 NGN  | PENDING │
│                                              │
└─────────────────────────────────────────────┘
```

Details Modal (click transaction):
```
Transaction Details
ID: tx_1001
Type: BUY USDT

Exchange Flow:
  Quote: 999.90 USDT for 1000.00 NGN
  Order Status: FILLED
  Executed: 999.90 USDT
  Fee: 0.10 USDT
  Order ID: binance_order_123

Blockchain Transfer:
  USDT Transferred: 999.90
  Destination: 0x1234...
  Tx Hash: 0xabc123...
  Block Explorer: [Link]
  Confirmations: 6/6
  Status: CONFIRMED

Final Status: SETTLED
```

API Calls:
```
GET /transactions
  ?merchantId=merchant_xyz
  &type=BUY,SELL
  &status=SETTLED,PENDING,CONFIRMING
  &page=1
  &limit=20

GET /transactions/:txId
  → Full transaction details including:
    - cryptoConversion record
    - exchangeOrder + fills
    - blockchainTransaction + receipt
```

#### 5. Wallet Management
**Route**: `/merchant/settings/wallets`

Manage crypto wallets for settlement:
```
┌─────────────────────────────────────────────┐
│ My Crypto Wallets                           │
├─────────────────────────────────────────────┤
│                                             │
│ Network: [Ethereum ▼]                      │
│                                             │
│ Wallet List:                                │
│ ┌────────────────────────────────────────┐ │
│ │ Address: 0x1234...5678                 │ │
│ │ Label: My Ethereum Wallet              │ │
│ │ USDT Balance: 5,000.50                 │ │
│ │ Added: 2025-01-01                      │ │
│ │ [Edit] [Delete] [View on Etherscan]    │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ [Add New Wallet]                           │
│                                             │
└─────────────────────────────────────────────┘
```

API Calls:
```
GET /wallets?merchantId=merchant_xyz

POST /wallets
{
  "address": "0x...",
  "label": "My Ethereum Wallet",
  "network": "ETHEREUM"
}

PUT /wallets/:walletId
{
  "label": "Updated Label"
}

DELETE /wallets/:walletId
```

### UI Components to Build

#### Quote Timer Component
```typescript
<QuoteTimer 
  expiresAt={quote.expiresAt}
  onExpired={() => setQuote(null)}
/>
```
- Displays seconds remaining
- Changes color as it expires (green → yellow → red)
- Automatically disables submit when expired

#### Balance Display Component
```typescript
<ProviderBalance 
  asset="USDT"
  showRefresh={true}
/>
```
- Shows available balance from provider
- Refresh button to query latest
- Shows last update time

#### Price Ticker Component
```typescript
<PriceTicker 
  baseAsset="USDT"
  quoteAsset="USD"
  refreshInterval={30000}
/>
```
- Live price display
- Updates at configurable interval
- Shows last update timestamp
- Indicates up/down movement

#### Status Badge Component
```typescript
<TransactionStatus status="SETTLED" />
```
- Visual status indicators
- Color coding (pending=yellow, completed=green, failed=red)
- Status-specific icons

### API Contracts (Already Defined in Part 3C Backend)

All endpoints return consistent format:
```json
{
  "success": true,
  "data": {...},
  "error": "error message if !success"
}
```

#### Pricing APIs
```
GET /exchange/balance/:asset
POST /exchange/real-quote
```

#### Trading APIs
```
POST /exchange/buy
POST /exchange/sell
GET /exchange/orders/:orderId
```

#### Settlement APIs
```
POST /payment-intents/:id/crypto-settlement
GET /payment-intents/:id
GET /transactions
GET /transactions/:id
```

#### Account APIs
```
GET /wallets
POST /wallets
PUT /wallets/:id
DELETE /wallets/:id
```

### Error Handling in UI

Backend error codes to handle:
```
QUOTE_EXPIRED
  → "Quote expired. Please request a new quote."

QUOTE_NOT_FOUND
  → "Quote not found. Please request a new quote."

INSUFFICIENT_BALANCE
  → "Insufficient balance on provider. Current: 500 USDT, Required: 1000 USDT"

NETWORK_ERROR
  → "Network error. Please try again."

PROVIDER_UNAVAILABLE
  → "Exchange provider temporarily unavailable. Please try again."

INVALID_ASSET
  → "Asset not supported by provider."

INVALID_NETWORK
  → "Network not supported for this settlement."

BLOCKCHAIN_ERROR
  → "Blockchain transfer failed. Please try again or contact support."
```

### State Management

Consider Redux/Context for:
```
- Current quote (with expiry timer)
- Current settlement in progress
- List of wallets
- Transaction history
- Price ticker updates
- Provider connection status
- User preferences (preferred wallet, default amounts)
```

### Real-time Updates

Consider WebSocket connection for:
```
- Price ticker updates
- Settlement status updates
- Blockchain confirmation progress
- New transactions in history
```

### Security Considerations for Frontend

✅ DO:
- Validate quote before showing submit button
- Disable submit if quote expired
- Show all amounts clearly (requested vs actual)
- Verify wallet ownership before settlement
- Confirm sensitive actions with user
- Never store private keys
- Use browser's secure storage for wallet addresses
- Show blockchain tx for transparency

❌ DON'T:
- Calculate prices client-side (trust backend)
- Generate order IDs (use backend's idempotency key)
- Create fake balances for testing
- Skip validation of backend responses
- Expose API keys in frontend
- Store settlement passwords/secrets
- Assume provider API calls will succeed
- Skip error handling for network calls

### Testing Strategy

#### Unit Tests
- Quote timer countdown logic
- Amount formatting and display
- Status badge styles
- Form validation

#### Integration Tests
- Quote → BUY flow (mock API)
- Quote → SELL flow (mock API)
- Settlement status polling
- Wallet selection validation

#### E2E Tests
- Complete BUY transaction
- Complete SELL transaction
- Quote expiration and refresh
- Error scenarios

### Performance Considerations

- Lazy load wallet list
- Cache quotes locally (but respect expiration)
- Debounce amount input
- Batch price ticker updates
- Virtual scroll for transaction history

### Accessibility (a11y)

- Label all form inputs
- Proper button roles
- Keyboard navigation
- Screen reader support
- Color not only indicator (also use text/icons)
- ARIA labels for status badges

## Part 4 is NOT Yet Started

This entire document describes what Part 4 WILL be. Do not implement it until this message:

> "Part 3C is complete. You can now begin Part 4: Frontend Crypto Trading Interface"

## Current Status: Part 3C Complete ✅

All backend infrastructure is ready for frontend integration. The frontend can be built using these APIs:

✅ Quote API  
✅ Order Execution API  
✅ Balance Query API  
✅ Settlement Broadcast API  
✅ Transaction Status API  
✅ Wallet Management API  

The next phase (Part 4) will build an intuitive UI for merchants to perform crypto trading operations with real provider quotes, real blockchain transfers, and real settlement.
