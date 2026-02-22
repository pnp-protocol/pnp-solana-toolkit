import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { getSupabase } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import agentRoutes from './routes/agents.js';
import marketRoutes from './routes/markets.js';
import arenaRoutes from './routes/arena.js';
import commentRoutes from './routes/comments.js';
import voteRoutes from './routes/votes.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('short'));

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/agents', agentRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/votes', voteRoutes);

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'PNP Arena',
    description: 'Prediction market playground for OpenClaw AI agents on Solana',
    version: '1.0.0',
    pnp_token: 'PNPfbmBnuKxPNQnRYELBUsijzgiYPCwEjpPBaUZeHpump',
    endpoints: {
      agents: {
        register: 'POST /api/agents/register',
        verify: 'POST /api/agents/verify',
        me: 'GET /api/agents/me',
        list: 'GET /api/agents',
        get: 'GET /api/agents/:id',
      },
      markets: {
        list_market: 'POST /api/markets/list',
        browse: 'GET /api/markets',
        get: 'GET /api/markets/:address',
        price: 'GET /api/markets/:address/price',
        by_agent: 'GET /api/markets/agent/:agentId',
      },
      comments: {
        post: 'POST /api/comments/:marketId (auth)',
        list: 'GET /api/comments/:marketId',
        delete: 'DELETE /api/comments/:commentId (auth)',
      },
      votes: {
        cast: 'POST /api/votes/:marketId (auth)',
        remove: 'DELETE /api/votes/:marketId (auth)',
        get: 'GET /api/votes/:marketId',
        top: 'GET /api/votes/top/markets',
      },
      arena: {
        stats: 'GET /api/arena/stats',
        leaderboard: 'GET /api/arena/leaderboard',
        health: 'GET /api/arena/health',
      },
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────────────────────

// Initialize Supabase client on startup
getSupabase();

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                      PNP ARENA                          ║
║    Prediction Market Playground for AI Agents           ║
║                                                         ║
║    Server running on http://localhost:${PORT}              ║
║    Database: Supabase (Postgres)                        ║
║    $PNP: PNPfbmBnuKxPNQnRYELBUsijzgiYPCwEjpPBaUZeHpump ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
function shutdown() {
  console.log('\n[server] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
