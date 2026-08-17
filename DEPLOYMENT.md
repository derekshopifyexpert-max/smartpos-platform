# SmartPOS Payment Platform — Deployment Guide

This guide covers environment setup, secrets management, provider configuration, and deployment for the SmartPOS crypto payment platform.

## Table of Contents

1. [Local Development](#local-development)
2. [Environment Variables](#environment-variables)
3. [Secrets Management (Vault)](#secrets-management-vault)
4. [Provider Configuration](#provider-configuration)
5. [Database Setup](#database-setup)
6. [Running Services](#running-services)
7. [Monitoring & Observability](#monitoring--observability)
8. [Production Deployment](#production-deployment)

---

## Local Development

### Prerequisites

- Node.js v18+ (ESM support)
- PostgreSQL 12+ (or Docker)
- Redis (or Docker)
- Git

### Quick Start

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

This starts the server on `http://localhost:4000` with auto-reload.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# edit .env with your values
```

### Critical Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/smartpos` |
| `PAYSTACK_SECRET_KEY` | Paystack API key (secret) | `sk_live_xxx` |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signature secret | `whsec_xxx` |
| `RPC_URL` | EVM RPC endpoint (Ethereum/Polygon/BSC) | `https://eth-mainnet.alchemyapi.io/v2/key` |
| `BROADCAST_PRIVATE_KEY` | Private key for signing transactions (testnet only) | `0x...` |
| `EXCHANGE_PROVIDER_API_KEY` | OTC/liquidity provider API key | `your_provider_key` |
| `EXCHANGE_PROVIDER_API_SECRET` | OTC provider secret | `your_provider_secret` |

### Optional / Feature Flags

| Variable | Purpose | Default |
|----------|---------|---------|
| `VAULT_ADDR` | HashiCorp Vault server URL | (not set) |
| `VAULT_TOKEN` | Vault authentication token | (not set) |
| `USE_MOCK_CRYPTO_PROVIDER` | Use mock provider for local testing | `false` |
| `ENABLE_CONFIRMATION_WORKER` | Poll blockchain for confirmations | `true` |
| `ENABLE_RECONCILIATION_WORKER` | Check for stale payments | `true` |
| `CONFIRMATION_POLL_INTERVAL_MS` | Confirmation check frequency | `30000` |
| `RECONCILIATION_POLL_INTERVAL_MS` | Reconciliation check frequency | `60000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `4000` |

---

## Secrets Management (Vault)

### HashiCorp Vault Setup (Optional)

For production, store secrets in HashiCorp Vault instead of `.env`.

1. **Start Vault locally (for testing)**:
   ```bash
   vault server -dev
   export VAULT_ADDR='http://127.0.0.1:8200'
   export VAULT_TOKEN='s.xxxxxxxxxxxxxxxx' # shown in dev output
   ```

2. **Store secrets in KV v2**:
   ```bash
   vault kv put secret/smartpos \
     PAYSTACK_SECRET_KEY="sk_live_xxx" \
     PAYSTACK_WEBHOOK_SECRET="whsec_xxx" \
     RPC_URL="https://eth-mainnet.alchemyapi.io/v2/key" \
     BROADCAST_PRIVATE_KEY="0x..." \
     EXCHANGE_PROVIDER_API_KEY="your_key" \
     EXCHANGE_PROVIDER_API_SECRET="your_secret"
   ```

3. **Point app to Vault**:
   ```bash
   export VAULT_ADDR='https://vault.mycompany.com'
   export VAULT_TOKEN='s.xxxxxxxxxxxxxxxx'
   npm run dev
   ```

   The app will fetch secrets from `secret/data/smartpos` and merge into `process.env`.

### Fallback

If Vault is not configured, the app uses `.env` variables (development only).

---

## Provider Configuration

### Exchange/OTC Provider (Liquidity)

The app uses `ExchangeProvider` database records for liquidity swaps. Configuration requires:

1. **Create provider entry via seed or API**:
   ```bash
   cd backend
   EXCHANGE_PROVIDER_API_KEY="your_key" \
   EXCHANGE_PROVIDER_API_SECRET="your_secret" \
   npx tsx scripts/seed-exchange-provider.ts
   ```

2. **Provider Metadata Mapping**

   The `ExchangeProvider.metadata.endpoints` object maps operation names to API paths:

   ```json
   {
     "baseUrl": "https://api.provider.com",
     "apiKey": "your_key",
     "apiSecret": "your_secret",
     "metadata": {
       "endpoints": {
         "quote": "/v1/quotes",
         "execute": "/v1/execute",
         "status": "/v1/status/{txId}",
         "validateAddress": "/v1/address/validate",
         "sendTransaction": "/v1/transactions/send",
         "getTransaction": "/v1/transactions/{txHash}",
         "getConfirmations": "/v1/transactions/{txHash}/confirmations"
       },
       "authHeader": "Authorization",
       "authScheme": "Bearer"
     }
   }
   ```

3. **Custom Provider Adapter**

   To integrate a new provider (e.g., Coinbase, Binance), create a provider class:

   ```typescript
   // src/providers/custom-provider.ts
   export class CustomProvider implements IOtcProvider {
     async requestQuote(req) { /* call provider quote endpoint */ }
     async executeSwap(req) { /* call provider execute endpoint */ }
     async getStatus(txId) { /* poll status */ }
   }
   ```

   Then register in `ProviderManager.getOtcProvider()`.

### Blockchain / RPC Provider

For Ethereum, Polygon, or BSC transactions:

1. **Set `RPC_URL`** (Alchemy, Infura, or self-hosted):
   ```bash
   export RPC_URL='https://eth-mainnet.alchemyapi.io/v2/your_key'
   ```

2. **Set `BROADCAST_PRIVATE_KEY`** (testnet account only):
   ```bash
   export BROADCAST_PRIVATE_KEY='0xdeadbeef...'
   ```

3. **Supported currencies** (for local broadcast): ETH, MATIC, BNB

   Other currencies are sent via provider's `sendTransaction` endpoint.

---

## Database Setup

### PostgreSQL

#### Docker

```bash
docker run -d \
  --name smartpos-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=smartpos \
  -p 5432:5432 \
  postgres:15
```

#### Connection

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/smartpos"
```

### Prisma Migrations

```bash
# Generate client
npm run prisma:generate

# Apply migrations
npm run prisma:push

# (or) Run pending migrations
npm run prisma:migrate

# View database in UI
npm run prisma:studio
```

---

## Running Services

### Development

```bash
cd backend
npm run dev
```

Runs on `http://localhost:4000` with:
- Hot reload (tsx watch)
- Fastify routes printed to console
- Confirmation worker (polls blockchain every 30s)
- Reconciliation worker (checks stale payments every 60s)

### Production Build

```bash
npm run build
npm run start
```

Outputs optimized code to `dist/`.

### E2E Tests

```bash
# Mock provider (no real payments)
npm run e2e:test

# Real provider (requires provider credentials)
USE_MOCK_CRYPTO_PROVIDER=false npm run e2e:test
```

---

## Monitoring & Observability

### Health Check

```bash
curl http://localhost:4000/health
```

Expected: `{ "status": "ok" }`

### Metrics

```bash
curl http://localhost:4000/api/v1/metrics
```

Returns counts of payments, transactions, settlements, etc.

### Dashboard

```bash
curl http://localhost:4000/api/v1/observability/dashboard
```

Returns JSON with:
- Payment status breakdown
- Conversion success rate
- Blockchain transaction confirmations
- Uptime

### Reconciliation Report

```bash
curl http://localhost:4000/api/v1/reconciliation/report
```

Lists captured payments missing conversions or blockchain transactions.

### Logs

Logs are written via Pino to stdout (colorized in dev, JSON in production):

```bash
# Pretty print (development)
npm run dev 2>&1 | npx pino-pretty

# JSON (production)
npm run start 2>&1 | jq .
```

---

## Production Deployment

### Pre-Flight Checklist

- [ ] Secrets stored in Vault (not `.env`)
- [ ] Database migrations applied (`npm run prisma:push`)
- [ ] RPC endpoints configured (for blockchain confirmation)
- [ ] Exchange provider credentials set
- [ ] Paystack webhook secret configured
- [ ] Email/SMS providers (optional) configured
- [ ] Monitoring & alerting configured

### Docker

#### Build

```bash
docker build -f Dockerfile -t smartpos-backend:latest .
```

#### Run

```bash
docker run -d \
  --name smartpos \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e VAULT_ADDR="https://vault.company.com" \
  -e VAULT_TOKEN="s.xxxxx" \
  smartpos-backend:latest
```

### Kubernetes

Deploy via Helm or kubectl with ConfigMap/Secret for env vars:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smartpos-backend
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: backend
        image: smartpos-backend:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: smartpos-secrets
              key: database-url
        - name: VAULT_ADDR
          value: "https://vault.company.com"
        - name: VAULT_TOKEN
          valueFrom:
            secretKeyRef:
              name: smartpos-secrets
              key: vault-token
```

### Reverse Proxy (Nginx)

```nginx
upstream smartpos {
  server 127.0.0.1:4000;
}

server {
  listen 80;
  server_name api.smartpos.com;

  location / {
    proxy_pass http://smartpos;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /webhooks {
    # High timeout for webhook processing
    proxy_read_timeout 30s;
    proxy_pass http://smartpos;
  }
}
```

### Monitoring & Alerts

Use Prometheus + Grafana to scrape `/api/v1/metrics` periodically:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
- job_name: 'smartpos'
  static_configs:
  - targets: ['localhost:4000']
  metrics_path: '/api/v1/metrics'
```

Set up alerts for:
- High payment failure rate
- Stale conversion records (age > 5 min)
- Blockchain confirmation lag (> 10 min)
- Low exchange provider balance

---

## Security Best Practices

1. **Rotate secrets regularly** (Vault lease renewal):
   ```bash
   vault lease renew smartpos/data/smartpos
   ```

2. **Use testnet keys** for `BROADCAST_PRIVATE_KEY` (never prod keys locally).

3. **Enable CORS** only for trusted origins:
   ```bash
   export CORS_ORIGIN='https://frontend.smartpos.com'
   ```

4. **Rate limit** payment endpoints (already enabled via Fastify plugin).

5. **Audit logs** all settlement/transfer events (use Pino structured logging).

6. **Monitor RPC provider balance** and set low-balance alerts.

---

## Troubleshooting

### `Exchange rate unavailable for quote`
- Ensure exchange rates are seeded in DB (run migrations).
- Or use `USE_MOCK_CRYPTO_PROVIDER=true` for local testing.

### `Vault not configured`
- Use `.env` for development (message is informational).
- Set `VAULT_ADDR` and `VAULT_TOKEN` for production.

### `listen EADDRINUSE: address already in use 0.0.0.0:4000`
- Kill process on port 4000: `lsof -ti :4000 | xargs kill -9`

### Confirmation worker not updating transactions
- Check RPC_URL is valid and responds to `getTransactionReceipt`.
- Ensure `ENABLE_CONFIRMATION_WORKER=true`.

---

## Support

For issues or questions, see:
- API Docs: `http://localhost:4000/docs`
- GitHub Issues: [link-to-repo]
- Slack: #smartpos-engineering
