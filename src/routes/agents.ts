import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAgentAuth } from '../middleware/auth.js';
import * as agentService from '../services/agentService.js';

const router = Router();

const registerSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(64, 'Name must be at most 64 characters')
    .regex(/^[a-zA-Z0-9_\-. ]+$/, 'Name can only contain letters, numbers, underscores, hyphens, dots, and spaces'),
  description: z.string().min(1).max(500).default(''),
  wallet_address: z
    .string()
    .min(32, 'Invalid Solana wallet address')
    .max(44, 'Invalid Solana wallet address'),
  avatar_url: z.string().url().optional(),
});

const verifySchema = z.object({
  api_key: z.string().min(1, 'api_key is required'),
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentService.registerAgent(req.body);

    res.status(201).json({
      message: 'Agent registered successfully. Save your API key -- it will not be shown again.',
      agent: result.agent,
      api_key: result.api_key,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify', validate(verifySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentService.verifyAgent(req.body.api_key);

    if (!agent) {
      res.status(401).json({ error: 'InvalidKey', message: 'API key is invalid or agent is not active' });
      return;
    }

    res.json({ valid: true, agent });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAgentAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = (req as any).agent;
    const public_ = await agentService.getAgentById(agent.id);
    res.json({ agent: public_ });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentService.getAgentById(String(req.params.id));

    if (!agent) {
      res.status(404).json({ error: 'NotFound', message: 'Agent not found' });
      return;
    }

    res.json({ agent });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 100);
    const offset = parseInt(String(req.query.offset ?? '0'));
    const status = String(req.query.status ?? 'active');

    const result = await agentService.listAgents({ status, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
