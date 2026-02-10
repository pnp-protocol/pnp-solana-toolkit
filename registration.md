---
name: pnp-markets-solana
description: Create, trade, and settle permissionless prediction markets on Solana Mainnet using $PNP token as collateral.
compatibility: Requires Node.js 18+, network access (Solana RPC), and a funded Solana wallet with SOL for transaction fees
metadata:
  author: pnp-protocol
  version: 1.0.0
---

# PNP Markets (Solana)

Create and manage prediction markets on Solana Mainnet using **$PNP** token as collateral.

## Installation

```bash
npx skills add pnp-protocol/solana-skill
```

## Collateral Token

**$PNP**: `PNPfbmBnuKxPNQnRYELBUsijzgiYPCwEjpPBaUZeHpump` (6 decimals)

## Core Functions

### 1. Create Market

Create a prediction market using $PNP token as collateral.

```typescript
import { PNPClient } from 'pnp-sdk';
import { PublicKey } from '@solana/web3.js';

const PNP_MINT = new PublicKey('PNPfbmBnuKxPNQnRYELBUsijzgiYPCwEjpPBaUZeHpump');

const secretKey = PNPClient.parseSecretKey(process.env.PRIVATE_KEY);
const client = new PNPClient(process.env.RPC_URL, secretKey);

const result = await client.market.createMarket({
  question: 'Will Bitcoin reach $200K by end of 2026?',
  initialLiquidity: 1_000_000n,
  endTime: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
  baseMint: PNP_MINT,
});

console.log('Market Address:', result.market.toBase58());
```

Returns: `{ signature: string, market: PublicKey }`

### 2. Trade

Buy or sell YES/NO outcome tokens on existing markets.

```typescript
// Buy tokens
const result = await client.trading.buyTokensUsdc({
  market: marketPubkey,
  buyYesToken: true,   // true = YES, false = NO
  amountUsdc: 10,      // Amount in PNP token units
});

// Sell tokens
const sellResult = await client.trading.sellTokensUsdc({
  market: marketPubkey,
  sellYesToken: true,
  tokenAmount: 5_000_000_000_000_000_000n,  // Raw units (18 decimals)
});
```

### 3. Redeem

Claim winnings after market settlement.

```typescript
const { account: market } = await client.fetchMarket(marketPubkey);

if (!market.resolved) {
  throw new Error('Market not settled yet');
}

const result = await client.redeemPosition(marketPubkey);
console.log('Redemption Transaction:', result.signature);
```

### 4. Get Market Info

Fetch all on-chain data about a market (read-only, no wallet needed).

```typescript
const client = new PNPClient('https://api.mainnet-beta.solana.com');

const { account } = await client.fetchMarket(marketPubkey);
const priceData = await client.getMarketPriceV2(marketPubkey);
const criteria = await client.getSettlementCriteria(marketAddress);
const meta = await client.getMarketMeta(marketAddress);
```

## Environment Setup

```
PRIVATE_KEY="your_base58_private_key_here"
RPC_URL="https://api.mainnet-beta.solana.com"
```

## Resources

- PNP SDK Documentation: https://docs.pnp.exchange/pnp-sdk
- Solana Explorer: https://solscan.io
- Network: Solana Mainnet Beta