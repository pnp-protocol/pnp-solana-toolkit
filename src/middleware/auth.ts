import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../db/index.js';
import type { Agent } from '../types/index.js';

/**
 * Middleware: authenticate agent via API key in Authorization header.
 *
 * Expected header:  Authorization: Bearer <api_key>
 *
 * On success, attaches `req.agent` (full Agent row) for downstream handlers.
 */
export async function requireAgentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <api_key>',
    });
    return;
  }

  const apiKey = authHeader.slice(7).trim();

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is empty',
    });
    return;
  }

  try {
    const sb = getSupabase();
    const { data: agent, error } = await sb
      .from('agents')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !agent) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key or agent is suspended',
      });
      return;
    }

    (req as any).agent = agent as Agent;
    next();
  } catch (err) {
    next(err);
  }
}
