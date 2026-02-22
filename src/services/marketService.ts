import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { PNP_TOKEN_MINT } from '../types/index.js';
import { incrementAgentMarkets } from './agentService.js';
import type { ArenaMarket, ListMarketRequest, Agent } from '../types/index.js';

export async function listMarketOnArena(data: ListMarketRequest, agent: Agent): Promise<ArenaMarket> {
  const sb = getSupabase();

  const { data: existing } = await sb
    .from('markets')
    .select('id')
    .eq('market_address', data.market_address)
    .maybeSingle();

  if (existing) {
    throw new AppError(409, `Market ${data.market_address} is already listed on the arena`, 'MARKET_EXISTS');
  }

  const collateralMint = PNP_TOKEN_MINT;

  const endDate = new Date(data.end_time);
  if (isNaN(endDate.getTime())) {
    throw new AppError(400, 'Invalid end_time format. Use ISO 8601.', 'INVALID_END_TIME');
  }
  if (endDate.getTime() < Date.now()) {
    throw new AppError(400, 'end_time must be in the future', 'END_TIME_PAST');
  }

  if (data.oracle_type === 'custom' && !data.custom_oracle_address) {
    throw new AppError(400, 'custom_oracle_address is required for custom oracle markets', 'MISSING_ORACLE');
  }

  const id = uuidv4();
  const tags = JSON.stringify(data.tags ?? []);

  const { error } = await sb.from('markets').insert({
    id,
    market_address: data.market_address,
    agent_id: agent.id,
    question: data.question,
    description: data.description ?? null,
    category: data.category ?? null,
    market_type: data.market_type,
    oracle_type: data.oracle_type,
    custom_oracle_address: data.custom_oracle_address ?? null,
    collateral_mint: collateralMint,
    initial_liquidity: data.initial_liquidity,
    end_time: endDate.toISOString(),
    tags,
    image_url: data.image_url ?? null,
  });

  if (error) throw new AppError(500, `Failed to list market: ${error.message}`);

  await incrementAgentMarkets(agent.id, data.initial_liquidity);

  const { data: market, error: fetchErr } = await sb
    .from('markets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !market) throw new AppError(500, 'Failed to fetch newly listed market');

  return market as ArenaMarket;
}

export async function getMarketByAddress(address: string): Promise<ArenaMarket | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('markets')
    .select('*')
    .eq('market_address', address)
    .maybeSingle();

  return (data as ArenaMarket) ?? null;
}

export async function getMarketById(id: string): Promise<ArenaMarket | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('markets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return (data as ArenaMarket) ?? null;
}

export interface MarketFilters {
  status?: string;
  category?: string;
  agent_id?: string;
  oracle_type?: string;
  market_type?: string;
  search?: string;
  sort_by?: 'listed_at' | 'end_time' | 'initial_liquidity';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export async function listMarkets(filters: MarketFilters = {}): Promise<{ markets: ArenaMarket[]; total: number }> {
  const sb = getSupabase();

  let countQuery = sb.from('markets').select('*', { count: 'exact', head: true });
  let dataQuery = sb.from('markets').select('*');

  if (filters.status) {
    countQuery = countQuery.eq('status', filters.status);
    dataQuery = dataQuery.eq('status', filters.status);
  }
  if (filters.category) {
    countQuery = countQuery.eq('category', filters.category);
    dataQuery = dataQuery.eq('category', filters.category);
  }
  if (filters.agent_id) {
    countQuery = countQuery.eq('agent_id', filters.agent_id);
    dataQuery = dataQuery.eq('agent_id', filters.agent_id);
  }
  if (filters.oracle_type) {
    countQuery = countQuery.eq('oracle_type', filters.oracle_type);
    dataQuery = dataQuery.eq('oracle_type', filters.oracle_type);
  }
  if (filters.market_type) {
    countQuery = countQuery.eq('market_type', filters.market_type);
    dataQuery = dataQuery.eq('market_type', filters.market_type);
  }
  if (filters.search) {
    countQuery = countQuery.ilike('question', `%${filters.search}%`);
    dataQuery = dataQuery.ilike('question', `%${filters.search}%`);
  }

  const { count } = await countQuery;

  const sortBy = filters.sort_by ?? 'listed_at';
  const sortOrder = filters.sort_order ?? 'desc';
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const { data: rows, error } = await dataQuery
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) throw new AppError(500, `Failed to list markets: ${error.message}`);

  return { markets: rows as ArenaMarket[], total: count ?? 0 };
}

export async function getMarketsByAgent(agentId: string): Promise<ArenaMarket[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('markets')
    .select('*')
    .eq('agent_id', agentId)
    .order('listed_at', { ascending: false });

  if (error) throw new AppError(500, `Failed to fetch markets by agent: ${error.message}`);

  return data as ArenaMarket[];
}

export async function updateMarketStatus(marketAddress: string, status: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('markets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('market_address', marketAddress);
}

export async function getArenaStats(): Promise<{
  total_agents: number;
  total_markets: number;
  active_markets: number;
  total_liquidity: number;
  categories: string[];
}> {
  const sb = getSupabase();

  const { count: totalAgents } = await sb
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: totalMarkets } = await sb
    .from('markets')
    .select('*', { count: 'exact', head: true });

  const { count: activeMarkets } = await sb
    .from('markets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { data: liquidityRow } = await sb
    .from('agents')
    .select('total_liquidity_provided');

  const totalLiquidity = (liquidityRow ?? []).reduce(
    (sum: number, r: any) => sum + (r.total_liquidity_provided || 0),
    0,
  );

  const { data: catRows } = await sb
    .from('markets')
    .select('category')
    .not('category', 'is', null);

  const categories = [...new Set((catRows ?? []).map((r: any) => r.category as string))];

  return {
    total_agents: totalAgents ?? 0,
    total_markets: totalMarkets ?? 0,
    active_markets: activeMarkets ?? 0,
    total_liquidity: totalLiquidity,
    categories,
  };
}
