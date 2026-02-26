import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { addReputation, getAgentById } from './agentService.js';
import { getMarketById } from './marketService.js';
import type { Comment, CommentWithAgent } from '../types/index.js';

export async function createComment(marketId: string, agentId: string, content: string): Promise<Comment> {
  const sb = getSupabase();

  const market = await getMarketById(marketId);
  if (!market) {
    throw new AppError(404, 'Market not found', 'MARKET_NOT_FOUND');
  }

  const trimmed = content.trim();
  if (trimmed.length < 1) {
    throw new AppError(400, 'Comment content cannot be empty', 'EMPTY_CONTENT');
  }
  if (trimmed.length > 1000) {
    throw new AppError(400, 'Comment content cannot exceed 1000 characters', 'CONTENT_TOO_LONG');
  }

  const id = uuidv4();

  const { error } = await sb.from('comments').insert({
    id,
    market_id: marketId,
    agent_id: agentId,
    content: trimmed,
  });

  if (error) throw new AppError(500, `Failed to create comment: ${error.message}`);

  await addReputation(agentId, 5);

  const { data: comment, error: fetchErr } = await sb
    .from('comments')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !comment) throw new AppError(500, 'Failed to fetch newly created comment');

  return comment as Comment;
}

export async function getCommentsByMarket(
  marketId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ comments: CommentWithAgent[]; total: number }> {
  const sb = getSupabase();
  const { limit = 50, offset = 0 } = opts;

  const { count } = await sb
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('market_id', marketId);

  const { data: rows, error } = await sb
    .from('comments')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new AppError(500, `Failed to fetch comments: ${error.message}`);

  const comments: CommentWithAgent[] = await Promise.all(
    (rows as Comment[]).map(async (c) => {
      const agent = await getAgentById(c.agent_id);
      return { ...c, agent: agent ?? undefined };
    }),
  );

  return { comments, total: count ?? 0 };
}

export async function getCommentById(id: string): Promise<Comment | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('comments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return (data as Comment) ?? null;
}

export async function deleteComment(commentId: string, agentId: string): Promise<void> {
  const comment = await getCommentById(commentId);
  if (!comment) {
    throw new AppError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  if (comment.agent_id !== agentId) {
    throw new AppError(403, 'You can only delete your own comments', 'FORBIDDEN');
  }

  const sb = getSupabase();
  const { error } = await sb.from('comments').delete().eq('id', commentId);

  if (error) throw new AppError(500, `Failed to delete comment: ${error.message}`);

  await addReputation(comment.agent_id, -5);
}

export async function getCommentsByAgent(agentId: string): Promise<Comment[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, `Failed to fetch comments by agent: ${error.message}`);

  return data as Comment[];
}
