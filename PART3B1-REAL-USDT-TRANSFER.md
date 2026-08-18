# Part 3B.1 — Real USDT Transfer Engine

## Supported network

This implementation targets a single real EVM network first, with configuration-driven expansion in mind.

- Network: ETHEREUM
- Chain ID: configured by `BLOCKCHAIN_CHAIN_ID` (default 1)
- Native asset: ETH
- USDT token contract: configured by `BLOCKCHAIN_USDT_CONTRACT_ADDRESS`
- USDT decimals: configured by `BLOCKCHAIN_USDT_DECIMALS` (default 6)
- Confirmation threshold: configured by `BLOCKCHAIN_CONFIRMATIONS_REQUIRED` (default 6)

The design is centralized in the blockchain service. Additional networks can be added later by expanding the supported config map without rewriting the settlement flow.

## RPC and signer requirements

The backend requires:

- `BLOCKCHAIN_RPC_URL` or `RPC_URL`
- `BLOCKCHAIN_CHAIN_ID`
- `BROADCAST_PRIVATE_KEY`
- `BLOCKCHAIN_USDT_CONTRACT_ADDRESS`

The signer is SmartPOS-controlled custody only. This implementation uses a server-side ethers signer for development/staging compatibility and keeps the contract signing boundary isolated so an HSM or custody adapter can replace it later.

## Settlement behavior

The real engine does the following:

1. Validates the merchant-owned destination wallet.
2. Validates the asset/network match.
3. Validates the configured RPC network matches the expected chain ID.
4. Validates the configured USDT contract symbol and decimals.
5. Checks the signer USDT balance before broadcast.
6. Checks the signer native balance for gas.
7. Estimates gas using the token contract transfer call.
8. Broadcasts the real ERC-20 transfer.
9. Persists the provider-returned transaction hash.
10. Waits for receipt confirmation and records the result.

## Failure modes

The engine rejects if:

- the RPC chain ID mismatches
- the destination wallet is not owned by the merchant
- the wallet network or asset mismatches the request
- USDT balance is insufficient
- native gas balance is insufficient
- gas estimation fails
- the token contract is invalid or is not USDT
- the provider broadcast fails
- the transaction receipt indicates failure

## Important constraints

- No fake hash generation is permitted.
- No mock blockchain success path is permitted.
- No internal database balance is treated as proof of blockchain funds.
- Production custody should use institutional custody, not a local private key.

## Testnet and production guidance

- Local/staging: a configured private key is acceptable for testing.
- Production: use institutional custody or a dedicated signing service.
- Never commit real private keys or API secrets to source control.
