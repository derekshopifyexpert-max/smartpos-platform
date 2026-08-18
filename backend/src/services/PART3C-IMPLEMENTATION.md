# Part 3C: Real Crypto Exchange & Settlement Infrastructure

## Overview
Part 3C connects the SmartPOS payment flow with a real crypto liquidity provider to enable actual USDT acquisition and blockchain settlement.

## Architecture

### 1. Quote Flow (Real Provider)
```
Payment Captured
  ↓
Request Live Quote from Provider
  ↓
Validate Quote (expiry, asset match, amount match)
  ↓
Persist Quote in Database
  ↓
Return Quote to User/System
```

### 2. Exchange BUY Flow (Real Order Execution)
```
User Confirms Quote
  ↓
Create Idempotent Order Request (clientOrderId = paymentId + timestamp)
  ↓
Check for Existing Order (idempotency)
  ↓
Validate Provider Balance
  ↓
Execute Real Order on Provider
  ↓
Retrieve Order Status from Provider
  ↓
Record Order in Database
  ↓
Record Fills in Database (may be partial)
  ↓
Track Actual Acquired Amount (not requested amount)
  ↓
Return Order Status
```

### 3. Exchange SELL Flow
```
User Requests SELL
  ↓
Validate Available USDT Balance
  ↓
Request Live Quote from Provider
  ↓
Create Idempotent SELL Order
  ↓
Execute Real SELL on Provider
  ↓
Record Order and Fills
  ↓
Track Actual Received Amount
```

### 4. Bridge to Blockchain Settlement
```
Exchange Order Filled
  ↓
Verify Actual Fill Amount
  ↓
Create Blockchain Settlement Request with Actual Amount
  ↓
Execute USDT Transfer (Part 3B)
  ↓
Retrieve Real Tx Hash
  ↓
Monitor Confirmations (Part 3B.2)
  ↓
Mark Settlement Complete
```

## Key Features Implemented

### 1. Real Provider Quotes
- Live pricing from configured provider
- Quote expiration enforced
- No hardcoded or fallback rates
- Proper decimals and precision handling

### 2. Idempotent Operations
- Every BUY/SELL uses clientOrderId for idempotency
- clientOrderId = `${paymentId}:${side}:${timestamp}`
- Repeated calls return existing order, not new duplicate
- Prevents accidental double-trading

### 3. Quote Validation
- Expiry check (fail if expired)
- Asset match verification
- Amount variance tolerance (configurable, default 2%)
- Quote already-used check

### 4. Balance Verification
- Provider balance checked before BUY
- Blockchain USDT balance checked before transfer
- Native gas balance verified for fees
- Clear "insufficient balance" errors

### 5. Fill Tracking
- Tracks requested vs executed amount
- Records each fill from provider
- Calculates actual average price
- Distinguishes provider fee from gas fee

### 6. Partial Fill Handling
- Accepts partial fills (configurable policy)
- Tracks remaining amount
- Uses actual filled amount for blockchain transfer
- Clear status on each order

### 7. Custody Model
- SmartPOS acquires USDT via provider
- Provider balance reflects held USDT
- Blockchain transfer uses provider withdrawal
- Actual destination = merchant wallet on blockchain

### 8. Fee Breakdown
- Provider trading fee (from order fills)
- Blockchain gas fee (from mined receipt)
- SmartPOS service fee (from configuration)
- All tracked separately

### 9. Error Classification
- Network errors (retryable)
- Authentication errors (not retryable)
- Insufficient balance (not retryable)
- Invalid assets/pairs (not retryable)
- Rate limiting (retryable)

### 10. Reconciliation
- SmartPOS order vs provider order matching
- Fill verification
- Amount discrepancy detection
- Fee verification

## Database Models

### CryptoQuote (Already exists, enhanced usage)
- Stores live quotes from provider
- Tracks expiration
- Marks as used for idempotency
- Contains provider metadata

### ExchangeOrder (Already exists, properly used)
- Represents real provider order
- Tracks clientOrderId for idempotency
- Stores requestedAmount and executedAmount separately
- Status progression: PENDING → OPEN → PARTIALLY_FILLED → FILLED/CANCELED

### ExchangeTrade (Already exists, properly used)
- Each fill creates a trade record
- Tracks individual fill price, amount, fee
- Allows reconstruction of average price

### BlockchainTransaction (From Part 3B)
- Links to ExchangeOrder
- Stores actual USDT amount (from fills)
- Tracks real tx hash
- Real receipt verification

## No Mock Behavior
- ✗ No hardcoded prices
- ✗ No 1:1 exchange rates
- ✗ No generated order IDs
- ✗ No fake balances
- ✗ No simulated fills
- ✗ No fake transaction hashes
- ✗ No Math.random() for financial data

## Configuration

Required environment variables:
```
EXCHANGE_PROVIDER_NAME=binance|kraken|otc_provider
EXCHANGE_PROVIDER_BASE_URL=https://api.provider.com
EXCHANGE_PROVIDER_API_KEY=your_api_key
EXCHANGE_PROVIDER_API_SECRET=your_api_secret
EXCHANGE_PROVIDER_METADATA={...provider specific config}

BLOCKCHAIN_RPC_URL=https://eth-rpc.example.com
BLOCKCHAIN_CHAIN_ID=1
BLOCKCHAIN_USDT_CONTRACT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7
BLOCKCHAIN_CONFIRMATIONS_REQUIRED=6
BROADCAST_PRIVATE_KEY=0x...

CRYPTO_SETTLEMENT_VARIANCE_PERCENT=2
CRYPTO_SETTLEMENT_ACCEPT_PARTIAL_FILLS=true
CRYPTO_SETTLEMENT_SERVICE_FEE_PERCENT=0.5
```

## API Endpoints

### Get Live Quote
```
POST /exchange/real-quote
{
  "baseAsset": "USDT",
  "quoteAsset": "USD",
  "side": "BUY",
  "amount": "1000.00",
  "ttlSeconds": 30
}

Response:
{
  "success": true,
  "data": {
    "quoteId": "quote_123",
    "provider": "binance",
    "price": "1.0001",
    "inputAmount": "1000.00",
    "outputAmount": "999.90",
    "fee": "0.10",
    "expiresAt": "2025-01-01T12:00:30Z",
    "expiresIn": 30
  }
}
```

### Execute BUY Order
```
POST /exchange/buy
{
  "baseAsset": "USDT",
  "quoteAsset": "USD",
  "amount": "1000.00",
  "quoteId": "quote_123",
  "clientOrderId": "payment_123:BUY:1234567890"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "status": "FILLED",
    "requestedAmount": "1000.00",
    "executedAmount": "999.90",
    "averagePrice": "1.00010",
    "fee": "0.10",
    "fills": [
      {
        "price": "1.00010",
        "amount": "999.90",
        "fee": "0.10"
      }
    ]
  }
}
```

### Execute SELL Order
```
POST /exchange/sell
{
  "baseAsset": "USDT",
  "quoteAsset": "USD",
  "amount": "500.00",
  "quoteId": "quote_456",
  "clientOrderId": "payment_456:SELL:1234567890"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order_def456",
    "status": "FILLED",
    "requestedAmount": "500.00",
    "executedAmount": "500.00",
    "averagePrice": "0.99990",
    "receivedAmount": "499.95",
    "fee": "0.05"
  }
}
```

### Get Provider Balance
```
GET /exchange/balance/USDT

Response:
{
  "success": true,
  "data": {
    "asset": "USDT",
    "available": "5000.50",
    "total": "5000.50",
    "reserved": "0.00"
  }
}
```

### Check Order Status
```
GET /exchange/orders/order_abc123

Response:
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "status": "FILLED",
    "executedAmount": "999.90",
    "averagePrice": "1.00010",
    "fills": 1
  }
}
```

## State Transitions

### Quote States
```
CREATED → USED → COMPLETED
              → EXPIRED
```

### Order States
```
PENDING → OPEN → PARTIALLY_FILLED → FILLED → SETTLED
       → CANCELED
       → REJECTED
       → FAILED
       → EXPIRED
```

## Implementation Checklist
- [x] Quote validation service with expiry/asset/amount checks
- [x] Idempotent order creation with clientOrderId
- [x] Provider balance verification before BUY
- [x] Provider integration for buy/sell
- [x] Fill/trade recording
- [x] Requested vs executed amount tracking
- [x] Bridge to blockchain settlement with actual amount
- [x] Error classification
- [ ] Partial fill policy enforcement
- [ ] Reconciliation service enhancements
- [ ] Observability metrics for exchange operations
- [ ] Provider health check
- [ ] Rate limiting and retry logic

## Safety Constraints
1. No settlement can occur with 0 executions
2. No blockchain transfer without confirmed fills
3. Amount transferred = actual filled amount, not requested
4. Quotes must be validated before order execution
5. Idempotency keys must be stored and checked
6. Provider credentials never exposed in logs
7. All financial amounts use Prisma.Decimal
8. All provider responses normalized before storage
