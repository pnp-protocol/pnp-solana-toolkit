import { PNPClient } from 'pnp-sdk';
import { PublicKey } from '@solana/web3.js';
import type { MarketOnChainData } from '../types/index.js';

let client: PNPClient | null = null;

function getClient(): PNPClient {
  if (!client) {
    const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    client = new PNPClient(rpcUrl);
    console.log(`[pnp] Read-only PNP client initialized (RPC: ${rpcUrl})`);
  }
  return client;
}

/**
 * Fetch live on-chain data for a market.
 * Returns null if the market doesn't exist on-chain.
 */
export async function fetchOnChainMarketData(marketAddress: string): Promise<MarketOnChainData | null> {
  try {
    const pnp = getClient();
    const pubkey = new PublicKey(marketAddress);

    const { account } = await pnp.fetchMarket(pubkey);

    // Try to get pricing (only works for V2 AMM markets)
    let pricing: MarketOnChainData['pricing'] = undefined;
    try {
      const priceData = await pnp.getMarketPriceV2(pubkey);
      pricing = {
        yes_price: priceData.yesPrice,
        no_price: priceData.noPrice,
        yes_multiplier: priceData.yesMultiplier,
        no_multiplier: priceData.noMultiplier,
      };
    } catch {
      // Pricing not available (V3/P2P market)
    }

    // Format winning token
    let winningTokenId = 'none';
    if (account.winning_token_id != null) {
      if (typeof account.winning_token_id === 'object') {
        if ('yes' in (account.winning_token_id as any)) winningTokenId = 'yes';
        else if ('no' in (account.winning_token_id as any)) winningTokenId = 'no';
      } else if (typeof account.winning_token_id === 'number') {
        winningTokenId = account.winning_token_id === 1 ? 'yes' : account.winning_token_id === 2 ? 'no' : 'none';
      } else {
        winningTokenId = String(account.winning_token_id);
      }
    }

    const endTime = BigInt(account.end_time.toString());
    const creationTime = BigInt(account.creation_time.toString());

    return {
      resolved: account.resolved,
      resolvable: account.resolvable,
      winning_token_id: winningTokenId,
      yes_token_mint: account.yes_token_mint.toString(),
      no_token_mint: account.no_token_mint.toString(),
      market_reserves: account.market_reserves.toString(),
      yes_token_supply_minted: account.yes_token_supply_minted.toString(),
      no_token_supply_minted: account.no_token_supply_minted.toString(),
      creation_time: new Date(Number(creationTime) * 1000).toISOString(),
      pricing,
    };
  } catch (err) {
    console.error(`[pnp] Failed to fetch on-chain data for ${marketAddress}:`, (err as Error).message);
    return null;
  }
}

/**
 * Verify that a market address exists on-chain and uses $PNP collateral.
 */
export async function verifyMarketOnChain(
  marketAddress: string,
  expectedCollateral: string,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const pnp = getClient();
    const pubkey = new PublicKey(marketAddress);
    const { account } = await pnp.fetchMarket(pubkey);

    const onChainCollateral = account.collateral_token.toString();

    if (onChainCollateral !== expectedCollateral) {
      return {
        valid: false,
        reason: `Market uses collateral ${onChainCollateral}, expected ${expectedCollateral} ($PNP)`,
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: `Market not found on-chain: ${(err as Error).message}`,
    };
  }
}
