# pnp-solana-toolkit

A comprehensive TypeScript script to fetch all on-chain data about a Solana prediction market using the PNP SDK.

## Features

The script fetches the following data from the Solana blockchain:

### Basic Information
- Market address and ID
- Question
- Market version

### Status
- Resolved status
- Resolvable status
- Force resolve flag
- Winning token ID
- Has ended status

### Timing
- Creation time
- End time
- Current status

### Participants
- Creator address
- Creator fee treasury

### Token Information
- Collateral token mint
- YES token mint
- NO token mint

### Supply & Liquidity
- Initial liquidity
- Current market reserves
- YES token supply minted
- NO token supply minted

### Pricing (V2 Markets)
- YES/NO token prices
- Multipliers (potential payout ratios)
- UI-friendly supply values

### User Balances (if wallet connected)
- Collateral balance
- YES token balance
- NO token balance

### Settlement Criteria (if available)
- Category
- Reasoning
- Resolution sources
- Settlement criteria

### Metadata (if available)
- Market volume
- Image
- Initial liquidity

## Usage

### Basic Usage (Read-only)

```bash
# Set RPC URL
export RPC_URL="https://api.mainnet-beta.solana.com"

# Run the script with a market address
npx tsx market_info.ts <MARKET_ADDRESS>
```

### With Wallet (to fetch balances)

```bash
# Set RPC URL and private key
export RPC_URL="https://api.mainnet-beta.solana.com"
export PRIVATE_KEY="your_base58_private_key"

# Run the script
npx tsx market_info.ts <MARKET_ADDRESS>
```

### Example

```bash
export RPC_URL="https://api.mainnet-beta.solana.com"
npx tsx market_info.ts 3LsfeB3RhQKJc2eHdEcb9XQzkF6eP9BFa6HTD6vvug9j
```

## Output

The script provides two types of output:

1. **Console Output**: Formatted, human-readable display of all market data
2. **JSON File**: Complete data saved to `market_data.json` for programmatic use

### Example Console Output

```
================================================================================
MARKET DATA SUMMARY
================================================================================

BASIC INFORMATION
Market Address: 3LsfeB3RhQKJc2eHdEcb9XQzkF6eP9BFa6HTD6vvug9j
Market ID: 12345
Question: Will Bitcoin reach $100K by end of 2025?
Version: 2

STATUS
Resolved: NO
Resolvable: YES
Force Resolve: NO
Winning Token: none
Has Ended: NO

PRICING
YES Price: 65.50%
NO Price: 34.50%
YES Multiplier: 1.53x
NO Multiplier: 2.90x
...
```

## Environment Variables

- `RPC_URL` (required): Solana RPC endpoint
  - Mainnet: `https://api.mainnet-beta.solana.com`
  - Devnet: `https://api.devnet.solana.com`
  
- `PRIVATE_KEY` (optional): Base58-encoded private key
  - Only needed if you want to fetch your token balances
  - Script works in read-only mode without it

## Dependencies

- `pnp-sdk`: PNP protocol SDK for Solana
- `@solana/web3.js`: Solana web3 library

## Programmatic Usage

You can also import and use the function in your own code:

```typescript
import { fetchAllMarketData, MarketData } from './market_info';

const data: MarketData = await fetchAllMarketData(
  'MARKET_ADDRESS',
  'https://api.mainnet-beta.solana.com',
  'optional_private_key'
);

console.log(data.question);
console.log(data.pricing?.yesPrice);
```

## Error Handling

The script gracefully handles missing data:
- If pricing data is unavailable (V3/P2P markets), it continues without it
- If user balances can't be fetched (no wallet), it skips that section
- If settlement criteria or metadata aren't available, it continues

## Notes

- The script works on both mainnet and devnet
- Some features (like pricing) may only be available for V2 (AMM) markets
- Settlement criteria and metadata require external proxy server availability
