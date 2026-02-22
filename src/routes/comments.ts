import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAgentAuth } from '../middleware/auth.js';
import * as commentService from '../services/commentService.js';

const router = Router();

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
});

router.post(
  '/:marketId',
  requireAgentAuth,
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = (req as any).agent;
      const marketId = String(req.params.marketId);
      const { content } = req.body;

      const comment = await commentService.createComment(marketId, agent.id, content);

      res.status(201).json({
        message: 'Comment posted successfully',
        comment,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:marketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const marketId = String(req.params.marketId);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 100);
    const offset = parseInt(String(req.query.offset ?? '0'));

    const result = await commentService.getCommentsByMarket(marketId, { limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:commentId', requireAgentAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = (req as any).agent;
    const commentId = String(req.params.commentId);

    await commentService.deleteComment(commentId, agent.id);

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
