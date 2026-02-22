import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { getMarketById } from './marketService.js';
import type { Vote, VoteCounts, VoteType } from '../types/index.js';

export async function castVote(marketId: string, agentId: string, voteType: VoteType): Promise<Vote | null> {
  const sb = getSupabase();

  const market = await getMarketById(marketId);
  if (!market) {
    throw new AppError(404, 'Market not found', 'MARKET_NOT_FOUND');
  }

  const { data: existing } = await sb
    .from('votes')
    .select('*')
    .eq('market_id', marketId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (existing) {
    if ((existing as Vote).vote_type === voteType) {
      await sb.from('votes').delete().eq('id', (existing as Vote).id);
      return null; // toggled off
    }

    await sb
      .from('votes')
      .update({ vote_type: voteType, created_at: new Date().toISOString() })
      .eq('id', (existing as Vote).id);

    const { data: updated } = await sb
      .from('votes')
      .select('*')
      .eq('id', (existing as Vote).id)
      .single();

    return updated as Vote;
  }

  const id = uuidv4();
  const { error } = await sb.from('votes').insert({
    id,
    market_id: marketId,
    agent_id: agentId,
    vote_type: voteType,
  });

  if (error) throw new AppError(500, `Failed to cast vote: ${error.message}`);

  const { data: vote } = await sb
    .from('votes')
    .select('*')
    .eq('id', id)
    .single();

  return vote as Vote;
}

export async function removeVote(marketId: string, agentId: string): Promise<boolean> {
  const sb = getSupabase();

  const { data: existing } = await sb
    .from('votes')
    .select('id')
    .eq('market_id', marketId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (!existing) return false;

  await sb.from('votes').delete().eq('id', existing.id);
  return true;
}

export async function getVoteCounts(marketId: string, currentAgentId?: string): Promise<VoteCounts> {
  const sb = getSupabase();

  const { count: upvotes } = await sb
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('market_id', marketId)
    .eq('vote_type', 'up');

  const { count: downvotes } = await sb
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('market_id', marketId)
    .eq('vote_type', 'down');

  let userVote: VoteType | undefined = undefined;
  if (currentAgentId) {
    const { data: vote } = await sb
      .from('votes')
      .select('vote_type')
      .eq('market_id', marketId)
      .eq('agent_id', currentAgentId)
      .maybeSingle();

    userVote = (vote as { vote_type: VoteType } | null)?.vote_type;
  }

  const up = upvotes ?? 0;
  const down = downvotes ?? 0;

  return {
    upvotes: up,
    downvotes: down,
    score: up - down,
    user_vote: userVote,
  };
}

export async function getAgentVote(marketId: string, agentId: string): Promise<Vote | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('votes')
    .select('*')
    .eq('market_id', marketId)
    .eq('agent_id', agentId)
    .maybeSingle();

  return (data as Vote) ?? null;
}

export async function getVotesByAgent(agentId: string): Promise<Vote[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('votes')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, `Failed to fetch votes by agent: ${error.message}`);

  return data as Vote[];
}

export async function getTopVotedMarkets(limit = 20): Promise<{ market_id: string; score: number }[]> {
  const sb = getSupabase();

  const { data: allVotes, error } = await sb
    .from('votes')
    .select('market_id, vote_type');

  if (error) throw new AppError(500, `Failed to fetch top voted markets: ${error.message}`);

  const scoreMap = new Map<string, number>();
  for (const v of (allVotes ?? []) as { market_id: string; vote_type: string }[]) {
    const delta = v.vote_type === 'up' ? 1 : -1;
    scoreMap.set(v.market_id, (scoreMap.get(v.market_id) ?? 0) + delta);
  }

  return [...scoreMap.entries()]
    .map(([market_id, score]) => ({ market_id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
