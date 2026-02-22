import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAgentAuth } from '../middleware/auth.js';
import * as marketService from '../services/marketService.js';
import * as agentService from '../services/agentService.js';
import { fetchOnChainMarketData, verifyMarketOnChain } from '../services/pnpService.js';
import { PNP_TOKEN_MINT } from '../types/index.js';
import type { MarketWithOnChain } from '../types/index.js';

const router = Router();

const listMarketSchema = z.object({
  market_address: z
    .string()
    .min(32, 'Invalid Solana market address')
    .max(44, 'Invalid Solana market address'),
  question: z.string().min(5, 'Question must be at least 5 characters').max(500),
  description: z.string().max(2000).optional(),
  category: z
    .enum(['crypto', 'sports', 'politics', 'ai', 'culture', 'science', 'gaming', 'other'])
    .optional(),
  market_type: z.enum(['v2_amm', 'p2p']),
  oracle_type: z.enum(['pnp', 'custom']),
  custom_oracle_address: z.string().min(32).max(44).optional(),
  initial_liquidity: z.string().min(1, 'initial_liquidity is required'),
  end_time: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid ISO 8601 date'),
  tags: z.array(z.string().max(32)).max(10).optional(),
  image_url: z.string().url().optional(),
});

router.post('/list', requireAgentAuth, validate(listMarketSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = (req as any).agent;
    const data = req.body;

    const verification = await verifyMarketOnChain(data.market_address, PNP_TOKEN_MINT);
    if (!verification.valid) {
      res.status(400).json({
        error: 'OnChainVerificationFailed',
        message: verification.reason,
      });
      return;
    }

    const market = await marketService.listMarketOnArena(data, agent);

    res.status(201).json({
      message: 'Market listed on PNP Arena successfully',
      market,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (key: string): string | undefined => {
      const val = req.query[key];
      return val ? String(val) : undefined;
    };

    const filters: marketService.MarketFilters = {
      status: q('status'),
      category: q('category'),
      agent_id: q('agent_id'),
      oracle_type: q('oracle_type'),
      market_type: q('market_type'),
      search: q('search'),
      sort_by: (q('sort_by') as any) || 'listed_at',
      sort_order: (q('sort_order') as any) || 'desc',
      limit: Math.min(parseInt(q('limit') ?? '50'), 100),
      offset: parseInt(q('offset') ?? '0'),
    };

    const result = await marketService.listMarkets(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const market = await marketService.getMarketByAddress(String(req.params.address));

    if (!market) {
      res.status(404).json({ error: 'NotFound', message: 'Market not listed on arena' });
      return;
    }

    const onChain = await fetchOnChainMarketData(market.market_address);
    const agent = await agentService.getAgentById(market.agent_id);

    const enriched: MarketWithOnChain = {
      ...market,
      on_chain: onChain ?? undefined,
      agent: agent ?? undefined,
    };

    res.json({ market: enriched });
  } catch (err) {
    next(err);
  }
});

router.get('/:address/price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const onChain = await fetchOnChainMarketData(String(req.params.address));

    if (!onChain) {
      res.status(404).json({ error: 'NotFound', message: 'Market not found on-chain' });
      return;
    }

    if (!onChain.pricing) {
      res.status(400).json({ error: 'NoPricing', message: 'Pricing data not available (may be a P2P market)' });
      return;
    }

    res.json({ pricing: onChain.pricing });
  } catch (err) {
    next(err);
  }
});

router.get('/agent/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = String(req.params.agentId);
    const agent = await agentService.getAgentById(agentId);
    if (!agent) {
      res.status(404).json({ error: 'NotFound', message: 'Agent not found' });
      return;
    }

    const markets = await marketService.getMarketsByAgent(agentId);
    res.json({ agent, markets });
  } catch (err) {
    next(err);
  }
});

export default router;
