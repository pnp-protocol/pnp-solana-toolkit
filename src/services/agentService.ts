import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getSupabase } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Agent, AgentPublic, RegisterAgentRequest } from '../types/index.js';

function generateApiKey(): string {
  return `pnp_${crypto.randomBytes(32).toString('hex')}`;
}

function toPublic(agent: Agent): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    wallet_address: agent.wallet_address,
    avatar_url: agent.avatar_url,
    markets_created: agent.markets_created,
    markets_resolved: agent.markets_resolved,
    total_liquidity_provided: agent.total_liquidity_provided,
    reputation_score: agent.reputation_score,
    status: agent.status,
    created_at: agent.created_at,
  };
}

export async function registerAgent(data: RegisterAgentRequest): Promise<{ agent: AgentPublic; api_key: string }> {
  const sb = getSupabase();

  const { data: existingName } = await sb
    .from('agents')
    .select('id')
    .eq('name', data.name)
    .maybeSingle();

  if (existingName) {
    throw new AppError(409, `Agent name "${data.name}" is already taken`, 'NAME_TAKEN');
  }

  const { data: existingWallet } = await sb
    .from('agents')
    .select('id')
    .eq('wallet_address', data.wallet_address)
    .maybeSingle();

  if (existingWallet) {
    throw new AppError(409, `Wallet ${data.wallet_address} is already registered`, 'WALLET_TAKEN');
  }

  const id = uuidv4();
  const apiKey = generateApiKey();

  const { error } = await sb.from('agents').insert({
    id,
    name: data.name,
    description: data.description,
    wallet_address: data.wallet_address,
    api_key: apiKey,
    avatar_url: data.avatar_url ?? null,
  });

  if (error) throw new AppError(500, `Failed to register agent: ${error.message}`);

  const { data: agent, error: fetchErr } = await sb
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !agent) throw new AppError(500, 'Failed to fetch newly created agent');

  return { agent: toPublic(agent as Agent), api_key: apiKey };
}

export async function verifyAgent(apiKey: string): Promise<AgentPublic | null> {
  const sb = getSupabase();
  const { data: agent } = await sb
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .maybeSingle();

  return agent ? toPublic(agent as Agent) : null;
}

export async function getAgentById(id: string): Promise<AgentPublic | null> {
  const sb = getSupabase();
  const { data: agent } = await sb
    .from('agents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return agent ? toPublic(agent as Agent) : null;
}

export async function getAgentByWallet(wallet: string): Promise<AgentPublic | null> {
  const sb = getSupabase();
  const { data: agent } = await sb
    .from('agents')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();

  return agent ? toPublic(agent as Agent) : null;
}

export async function listAgents(opts: { status?: string; limit?: number; offset?: number } = {}): Promise<{ agents: AgentPublic[]; total: number }> {
  const sb = getSupabase();
  const { status = 'active', limit = 50, offset = 0 } = opts;

  const { count } = await sb
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);

  const { data: rows, error } = await sb
    .from('agents')
    .select('*')
    .eq('status', status)
    .order('reputation_score', { ascending: false })
    .order('markets_created', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new AppError(500, `Failed to list agents: ${error.message}`);

  return { agents: (rows as Agent[]).map(toPublic), total: count ?? 0 };
}

export async function incrementAgentMarkets(agentId: string, liquidityRaw: string): Promise<void> {
  const sb = getSupabase();
  const liquidity = parseFloat(liquidityRaw) || 0;

  const { data: agent } = await sb
    .from('agents')
    .select('markets_created, total_liquidity_provided')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  await sb
    .from('agents')
    .update({
      markets_created: agent.markets_created + 1,
      total_liquidity_provided: agent.total_liquidity_provided + liquidity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
}

/**
 * Add or subtract reputation points. Applied only after successful actions.
 * Score is clamped to a minimum of 0.
 */
export async function addReputation(agentId: string, delta: number): Promise<void> {
  const sb = getSupabase();
  const { data: agent } = await sb
    .from('agents')
    .select('reputation_score')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  const newScore = Math.max(0, agent.reputation_score + delta);
  await sb
    .from('agents')
    .update({
      reputation_score: newScore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
}

export async function incrementResolvedMarkets(agentId: string): Promise<void> {
  const sb = getSupabase();

  const { data: agent } = await sb
    .from('agents')
    .select('markets_resolved, reputation_score')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  await sb
    .from('agents')
    .update({
      markets_resolved: agent.markets_resolved + 1,
      reputation_score: Math.min(agent.reputation_score + 5, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
}

export async function getLeaderboard(limit = 20): Promise<AgentPublic[]> {
  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from('agents')
    .select('*')
    .eq('status', 'active')
    .order('reputation_score', { ascending: false })
    .order('markets_created', { ascending: false })
    .order('total_liquidity_provided', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(500, `Failed to fetch leaderboard: ${error.message}`);

  return (rows as Agent[]).map(toPublic);
}
