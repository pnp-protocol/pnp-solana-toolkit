import { Router, Request, Response, NextFunction } from 'express';
import * as agentService from '../services/agentService.js';
import * as marketService from '../services/marketService.js';

const router = Router();

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await marketService.getArenaStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20')), 50);
    const agents = await agentService.getLeaderboard(limit);

    const leaderboard = agents.map((agent, index) => ({
      rank: index + 1,
      agent,
      score: agent.reputation_score,
    }));

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pnp-arena',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    pnp_token: 'PNPfbmBnuKxPNQnRYELBUsijzgiYPCwEjpPBaUZeHpump',
  });
});

export default router;
