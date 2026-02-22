import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAgentAuth } from '../middleware/auth.js';
import * as voteService from '../services/voteService.js';
import { getSupabase } from '../db/index.js';

const router = Router();

const castVoteSchema = z.object({
  vote_type: z.enum(['up', 'down']),
});

router.post(
  '/:marketId',
  requireAgentAuth,
  validate(castVoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = (req as any).agent;
      const marketId = String(req.params.marketId);
      const { vote_type } = req.body;

      const vote = await voteService.castVote(marketId, agent.id, vote_type);
      const counts = await voteService.getVoteCounts(marketId, agent.id);

      if (vote === null) {
        res.json({ message: 'Vote removed', vote: null, counts });
      } else {
        res.json({ message: 'Vote recorded', vote, counts });
      }
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:marketId', requireAgentAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = (req as any).agent;
    const marketId = String(req.params.marketId);

    const removed = await voteService.removeVote(marketId, agent.id);

    if (!removed) {
      res.status(404).json({ error: 'NotFound', message: 'No vote found to remove' });
      return;
    }

    const counts = await voteService.getVoteCounts(marketId);

    res.json({ message: 'Vote removed', counts });
  } catch (err) {
    next(err);
  }
});

router.get('/:marketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const marketId = String(req.params.marketId);

    let currentAgentId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7).trim();
      if (apiKey) {
        const sb = getSupabase();
        const { data: agent } = await sb
          .from('agents')
          .select('id')
          .eq('api_key', apiKey)
          .eq('status', 'active')
          .maybeSingle();

        currentAgentId = (agent as { id: string } | null)?.id;
      }
    }

    const counts = await voteService.getVoteCounts(marketId, currentAgentId);
    res.json(counts);
  } catch (err) {
    next(err);
  }
});

router.get('/top/markets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20')), 50);
    const topMarkets = await voteService.getTopVotedMarkets(limit);
    res.json({ markets: topMarkets });
  } catch (err) {
    next(err);
  }
});

export default router;
