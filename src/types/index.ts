// ─── Agent Types ────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  wallet_address: string;
  api_key: string;
  avatar_url: string | null;
  markets_created: number;
  markets_resolved: number;
  total_liquidity_provided: number; // in raw $PNP units
  reputation_score: number;         // 0-1000
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  description: string;
  wallet_address: string;
  avatar_url: string | null;
  markets_created: number;
  markets_resolved: number;
  total_liquidity_provided: number;
  reputation_score: number;
  status: string;
  created_at: string;
}

// ─── Market Types ───────────────────────────────────────────────────────────

export type MarketType = 'v2_amm' | 'p2p';
export type OracleType = 'pnp' | 'custom';
export type MarketStatus = 'active' | 'ended' | 'resolved' | 'delisted';

export interface ArenaMarket {
  id: string;
  market_address: string;       // on-chain Solana address
  agent_id: string;             // which agent listed it
  question: string;
  description: string | null;
  category: string | null;      // e.g. "crypto", "sports", "politics", "ai", "culture"
  market_type: MarketType;
  oracle_type: OracleType;
  custom_oracle_address: string | null;
  collateral_mint: string;      // should always be $PNP
  initial_liquidity: string;    // raw units as string (bigint safe)
  end_time: string;             // ISO 8601
  status: MarketStatus;
  tags: string;                 // JSON array stored as string
  image_url: string | null;
  listed_at: string;
  updated_at: string;
}

// ─── On-chain enrichment (fetched live, not stored) ─────────────────────────

export interface MarketOnChainData {
  resolved: boolean;
  resolvable: boolean;
  winning_token_id: string;
  yes_token_mint: string;
  no_token_mint: string;
  market_reserves: string;
  yes_token_supply_minted: string;
  no_token_supply_minted: string;
  creation_time: string;
  pricing?: {
    yes_price: number;
    no_price: number;
    yes_multiplier: number;
    no_multiplier: number;
  };
}

export interface MarketWithOnChain extends ArenaMarket {
  on_chain?: MarketOnChainData;
  agent?: AgentPublic;
}

// ─── API Request/Response Types ─────────────────────────────────────────────

export interface RegisterAgentRequest {
  name: string;
  description: string;
  wallet_address: string;
  avatar_url?: string;
}

export interface RegisterAgentResponse {
  agent: AgentPublic;
  api_key: string;       // only returned once at registration
  message: string;
}

export interface ListMarketRequest {
  market_address: string;
  question: string;
  description?: string;
  category?: string;
  market_type: MarketType;
  oracle_type: OracleType;
  custom_oracle_address?: string;
  initial_liquidity: string;
  end_time: string;       // ISO 8601
  tags?: string[];
  image_url?: string;
}

export interface LeaderboardEntry {
  rank: number;
  agent: AgentPublic;
  score: number;
}

// ─── Comment Types ──────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  market_id: string;
  agent_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAgent extends Comment {
  agent?: AgentPublic;
}

export interface CreateCommentRequest {
  content: string;
}

// ─── Vote Types ─────────────────────────────────────────────────────────────

export type VoteType = 'up' | 'down';

export interface Vote {
  id: string;
  market_id: string;
  agent_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface VoteCounts {
  upvotes: number;
  downvotes: number;
  score: number;        // upvotes - downvotes
  user_vote?: VoteType; // if authenticated, what the user voted
}

export interface CastVoteRequest {
  vote_type: VoteType;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const PNP_TOKEN_MINT = 'UVcu7kbVKW6Rs5PKzuwVSbm8ukvrWByS3hBXqHapump';
export const PNP_TOKEN_DECIMALS = 6;
