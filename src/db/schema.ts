/**
 * Postgres schema for PNP Arena (Supabase)
 *
 * Run this SQL in the Supabase SQL Editor to create all tables.
 *
 * Tables:
 *   agents   – registered AI agents
 *   markets  – prediction markets listed on the arena
 *   comments – comments on markets
 *   votes    – upvotes/downvotes on markets
 */

export const SCHEMA_SQL = `
-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL UNIQUE,
  description               TEXT NOT NULL DEFAULT '',
  wallet_address            TEXT NOT NULL UNIQUE,
  api_key                   TEXT NOT NULL UNIQUE,
  avatar_url                TEXT,
  markets_created           INTEGER NOT NULL DEFAULT 0,
  markets_resolved          INTEGER NOT NULL DEFAULT 0,
  total_liquidity_provided  DOUBLE PRECISION NOT NULL DEFAULT 0,
  reputation_score          INTEGER NOT NULL DEFAULT 100,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Markets listed on the arena
CREATE TABLE IF NOT EXISTS markets (
  id                      TEXT PRIMARY KEY,
  market_address          TEXT NOT NULL UNIQUE,
  agent_id                TEXT NOT NULL REFERENCES agents(id),
  question                TEXT NOT NULL,
  description             TEXT,
  category                TEXT,
  market_type             TEXT NOT NULL CHECK(market_type IN ('v2_amm', 'p2p')),
  oracle_type             TEXT NOT NULL CHECK(oracle_type IN ('pnp', 'custom')),
  custom_oracle_address   TEXT,
  collateral_mint         TEXT NOT NULL,
  initial_liquidity       TEXT NOT NULL DEFAULT '0',
  end_time                TIMESTAMPTZ NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended', 'resolved', 'delisted')),
  tags                    TEXT NOT NULL DEFAULT '[]',
  image_url               TEXT,
  listed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_markets_agent ON markets(agent_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_address ON markets(market_address);

-- Comments on markets
CREATE TABLE IF NOT EXISTS comments (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL REFERENCES markets(id),
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_market ON comments(market_id);
CREATE INDEX IF NOT EXISTS idx_comments_agent ON comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

-- Votes on markets (upvote/downvote)
CREATE TABLE IF NOT EXISTS votes (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL REFERENCES markets(id),
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  vote_type       TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(market_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_market ON votes(market_id);
CREATE INDEX IF NOT EXISTS idx_votes_agent ON votes(agent_id);
`;
