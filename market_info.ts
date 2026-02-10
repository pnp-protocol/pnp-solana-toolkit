import { PNPClient } from 'pnp-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Comprehensive script to fetch all on-chain data about a Solana prediction market
 * 
 * Usage: npx tsx market_info.ts <MARKET_ADDRESS>
 */

// Hardcoded RPC URL for Solana mainnet
const RPC_URL = 'https://api.mainnet-beta.solana.com';

interface MarketData {
    // Basic Market Info
    marketAddress: string;
    marketId: string;
    question: string;
    version: number;

    // Status
    resolved: boolean;
    resolvable: boolean;
    forceResolve: boolean;
    winningTokenId: string;

    // Timing
    creationTime: string;
    endTime: string;
    hasEnded: boolean;

    // Participants
    creator: string;
    creatorFeeTreasury: string;

    // Token Information
    collateralToken: string;
    yesTokenMint: string;
    noTokenMint: string;

    // Supply & Liquidity
    initialLiquidity: string;
    marketReserves: string;
    yesTokenSupplyMinted: string;
    noTokenSupplyMinted: string;

    // Pricing (if available)
    pricing?: {
        yesPrice: number;
        noPrice: number;
        yesMultiplier: number;
        noMultiplier: number;
        marketReservesUI: number;
        yesTokenSupplyUI: number;
        noTokenSupplyUI: number;
    };

    // User Balances (if wallet connected)
    balances?: {
        collateral: {
            account: string;
            amount: string;
            uiAmount: string;
        };
        yes: {
            account: string;
            amount: string;
            uiAmount: string;
        };
        no: {
            account: string;
            amount: string;
            uiAmount: string;
        };
    };

    // Settlement Criteria (if available)
    settlementCriteria?: {
        category: string;
        reasoning: string;
        resolvable: boolean;
        resolutionSources: string[];
        settlementCriteria: string;
        suggestedImprovements: string;
    };

    // Market Metadata (if available)
    metadata?: {
        marketVolume: number;
        image: string | null;
        initialLiquidity: number;
    };
}

async function fetchAllMarketData(marketAddress: string): Promise<MarketData> {
    console.log(`\nFetching on-chain data for market: ${marketAddress}\n`);

    // Initialize client (read-only, no signer needed)
    const client = new PNPClient(RPC_URL);

    const marketPubkey = new PublicKey(marketAddress);

    // 1. Fetch basic market account data
    console.log('Fetching market account data...');
    const { account: marketAccount } = await client.fetchMarket(marketPubkey);

    // 2. Fetch detailed market info (includes derived data)
    console.log('Fetching detailed market info...');
    let marketInfo = null;
    // Note: trading module requires a signer, skip for read-only mode

    // 3. Fetch pricing data (V2 markets)
    console.log('Fetching market pricing...');
    let pricingData;
    try {
        pricingData = await client.getMarketPriceV2(marketPubkey);
    } catch (error) {
        console.log('WARNING: Pricing data not available (might be V3/P2P market)');
        pricingData = null;
    }


    // 4. Skip user balances (requires wallet/signer)
    console.log('Skipping user balances (read-only mode)...');
    let balances: any = null;


    // 5. Fetch settlement criteria (from proxy server)
    console.log('Fetching settlement criteria...');
    let settlementCriteria;
    try {
        settlementCriteria = await client.getSettlementCriteria(marketAddress);
    } catch (error) {
        console.log('WARNING: Settlement criteria not available');
        settlementCriteria = null;
    }

    // 6. Fetch market metadata (volume, image, etc.)
    console.log('Fetching market metadata...');
    let metadata;
    try {
        metadata = await client.getMarketMeta(marketAddress);
    } catch (error) {
        console.log('WARNING: Market metadata not available');
        metadata = null;
    }

    // Convert timestamps to readable format
    const endTime = BigInt(marketAccount.end_time.toString());
    const creationTime = BigInt(marketAccount.creation_time.toString());
    const endTimeDate = new Date(Number(endTime) * 1000);
    const creationTimeDate = new Date(Number(creationTime) * 1000);
    const hasEnded = Date.now() / 1000 >= Number(endTime);

    // Compile all data
    const data: MarketData = {
        // Basic Info
        marketAddress,
        marketId: marketAccount.id.toString(),
        question: marketAccount.question,
        version: marketAccount.version,

        // Status
        resolved: marketAccount.resolved,
        resolvable: marketAccount.resolvable,
        forceResolve: marketAccount.force_resolve,
        winningTokenId: formatWinningToken(marketAccount.winning_token_id),

        // Timing
        creationTime: creationTimeDate.toISOString(),
        endTime: endTimeDate.toISOString(),
        hasEnded,

        // Participants
        creator: marketAccount.creator.toString(),
        creatorFeeTreasury: marketAccount.creator_fee_treasury.toString(),

        // Token Information
        collateralToken: marketAccount.collateral_token.toString(),
        yesTokenMint: marketAccount.yes_token_mint.toString(),
        noTokenMint: marketAccount.no_token_mint.toString(),

        // Supply & Liquidity
        initialLiquidity: marketAccount.initial_liquidity.toString(),
        marketReserves: marketAccount.market_reserves.toString(),
        yesTokenSupplyMinted: marketAccount.yes_token_supply_minted.toString(),
        noTokenSupplyMinted: marketAccount.no_token_supply_minted.toString(),
    };

    // Add pricing data if available
    if (pricingData) {
        data.pricing = {
            yesPrice: pricingData.yesPrice,
            noPrice: pricingData.noPrice,
            yesMultiplier: pricingData.yesMultiplier,
            noMultiplier: pricingData.noMultiplier,
            marketReservesUI: pricingData.marketReserves,
            yesTokenSupplyUI: pricingData.yesTokenSupply,
            noTokenSupplyUI: pricingData.noTokenSupply,
        };
    }

    // Add user balances if available
    if (balances) {
        data.balances = {
            collateral: {
                account: balances.collateral.account.toBase58(),
                amount: balances.collateral.amount.toString(),
                uiAmount: balances.collateral.uiAmountString,
            },
            yes: {
                account: balances.yes.account.toBase58(),
                amount: balances.yes.amount.toString(),
                uiAmount: balances.yes.uiAmountString,
            },
            no: {
                account: balances.no.account.toBase58(),
                amount: balances.no.amount.toString(),
                uiAmount: balances.no.uiAmountString,
            },
        };
    }

    // Add settlement criteria if available
    if (settlementCriteria) {
        data.settlementCriteria = {
            category: settlementCriteria.category,
            reasoning: settlementCriteria.reasoning,
            resolvable: settlementCriteria.resolvable,
            resolutionSources: settlementCriteria.resolution_sources,
            settlementCriteria: settlementCriteria.settlement_criteria,
            suggestedImprovements: settlementCriteria.suggested_improvements,
        };
    }

    // Add metadata if available
    if (metadata) {
        data.metadata = {
            marketVolume: metadata.market_volume,
            image: metadata.image,
            initialLiquidity: metadata.initial_liquidity,
        };
    }

    return data;
}

function formatWinningToken(winningTokenId: any): string {
    if (winningTokenId === null || winningTokenId === undefined) {
        return 'none';
    }

    if (typeof winningTokenId === 'object') {
        if ('yes' in winningTokenId) return 'yes';
        if ('no' in winningTokenId) return 'no';
        if ('none' in winningTokenId) return 'none';
    }

    if (typeof winningTokenId === 'number') {
        if (winningTokenId === 0) return 'none';
        if (winningTokenId === 1) return 'yes';
        if (winningTokenId === 2) return 'no';
    }

    return String(winningTokenId);
}

function displayMarketData(data: MarketData) {
    console.log('\n' + '='.repeat(80));
    console.log('MARKET DATA SUMMARY');
    console.log('='.repeat(80));

    console.log('\nBASIC INFORMATION');
    console.log(`Market Address: ${data.marketAddress}`);
    console.log(`Market ID: ${data.marketId}`);
    console.log(`Question: ${data.question}`);
    console.log(`Version: ${data.version}`);

    console.log('\nSTATUS');
    console.log(`Resolved: ${data.resolved ? 'YES' : 'NO'}`);
    console.log(`Resolvable: ${data.resolvable ? 'YES' : 'NO'}`);
    console.log(`Force Resolve: ${data.forceResolve ? 'YES' : 'NO'}`);
    console.log(`Winning Token: ${data.winningTokenId}`);
    console.log(`Has Ended: ${data.hasEnded ? 'YES' : 'NO'}`);

    console.log('\nTIMING');
    console.log(`Created: ${data.creationTime}`);
    console.log(`End Time: ${data.endTime}`);

    console.log('\nPARTICIPANTS');
    console.log(`Creator: ${data.creator}`);
    console.log(`Creator Fee Treasury: ${data.creatorFeeTreasury}`);

    console.log('\nTOKEN INFORMATION');
    console.log(`Collateral Token: ${data.collateralToken}`);
    console.log(`YES Token Mint: ${data.yesTokenMint}`);
    console.log(`NO Token Mint: ${data.noTokenMint}`);

    console.log('\nSUPPLY & LIQUIDITY');
    console.log(`Initial Liquidity: ${data.initialLiquidity}`);
    console.log(`Market Reserves: ${data.marketReserves}`);
    console.log(`YES Token Supply: ${data.yesTokenSupplyMinted}`);
    console.log(`NO Token Supply: ${data.noTokenSupplyMinted}`);

    if (data.pricing) {
        console.log('\nPRICING');
        console.log(`YES Price: ${(data.pricing.yesPrice * 100).toFixed(2)}%`);
        console.log(`NO Price: ${(data.pricing.noPrice * 100).toFixed(2)}%`);
        console.log(`YES Multiplier: ${data.pricing.yesMultiplier.toFixed(2)}x`);
        console.log(`NO Multiplier: ${data.pricing.noMultiplier.toFixed(2)}x`);
        console.log(`Market Reserves (UI): ${data.pricing.marketReservesUI}`);
        console.log(`YES Supply (UI): ${data.pricing.yesTokenSupplyUI}`);
        console.log(`NO Supply (UI): ${data.pricing.noTokenSupplyUI}`);
    }

    if (data.balances) {
        console.log('\nYOUR BALANCES');
        console.log(`Collateral: ${data.balances.collateral.uiAmount}`);
        console.log(`YES Tokens: ${data.balances.yes.uiAmount}`);
        console.log(`NO Tokens: ${data.balances.no.uiAmount}`);
    }

    if (data.metadata) {
        console.log('\nMETADATA');
        console.log(`Market Volume: ${data.metadata.marketVolume}`);
        console.log(`Image: ${data.metadata.image || 'N/A'}`);
    }

    if (data.settlementCriteria) {
        console.log('\nSETTLEMENT CRITERIA');
        console.log(`Category: ${data.settlementCriteria.category}`);
        console.log(`Resolvable: ${data.settlementCriteria.resolvable ? 'YES' : 'NO'}`);
        console.log(`Reasoning: ${data.settlementCriteria.reasoning}`);
        console.log(`Settlement Criteria: ${data.settlementCriteria.settlementCriteria}`);
        console.log(`Resolution Sources: ${data.settlementCriteria.resolutionSources.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('ERROR: Market address required');
        console.log('\nUsage: npx tsx market_info.ts <MARKET_ADDRESS>');
        console.log('\nExample: npx tsx market_info.ts 4v3Fco3DdvV6yZscmvCFtViqa2XYeSNGM8W3aFiLBAwi');
        process.exit(1);
    }

    const marketAddress = args[0];

    console.log(`Using RPC: ${RPC_URL}`);

    try {
        const data = await fetchAllMarketData(marketAddress);

        // Display formatted output
        displayMarketData(data);

    } catch (error: any) {
        console.error('\nERROR fetching market data:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run the main function
main().catch(console.error);

export { fetchAllMarketData, MarketData };
