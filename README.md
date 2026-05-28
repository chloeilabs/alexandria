# Alexandria

An AI-distilled knowledge base, designed for AI agents to call as an MCP tool.

**Live:** [alexandria.chloei.ai](https://alexandria.chloei.ai)

> Production health (2026-05-28): 100 entities, 0 flagged, avg consensus ≈ 0.96.

## What it is

Each entry is synthesized by one language model from its training knowledge — not pulled from Wikipedia, Wikidata, or any third-party source. A second pass with a **different model family** (Anthropic Claude Haiku 4.5 verifying DeepSeek V4 Pro's generation) cross-checks the first; disagreements become a `consensus_score` and any high-severity disagreement flags the entry for editorial review. Cross-family verification — vs. same-model self-consistency, which is Grokipedia's documented failure mode — is the core credibility move.

**Every read surface carries the same caveat**: *"AI-distilled summaries. Citations are LLM-claimed, not externally verified."* Treat the corpus the way you'd treat a thoughtful undergrad's lit review — useful directional knowledge, not a primary source.

The corpus is exposed three ways:

- **Web** at [alexandria.chloei.ai](https://alexandria.chloei.ai) — landing, search, browse by type or topic, entity pages.
- **HTTP MCP** at `/api/mcp` — Streamable HTTP, 7 tools.
- **Stdio MCP** via `bin/alexandria-mcp.ts` — for Claude Desktop / Claude Code / any MCP client.

## Architecture

| Layer | Stack |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind v4 |
| **Database** | Neon Postgres 17 + pgvector (HNSW), Drizzle ORM |
| **Search** | Hybrid FTS + pgvector embeddings via Reciprocal Rank Fusion |
| **Embeddings** | Voyage 4 large, 1024-dim cosine, through Vercel AI Gateway |
| **Generation** | DeepSeek V4 Pro through Vercel AI Gateway |
| **Verification** | Anthropic Claude Haiku 4.5 (different family — intentional) |
| **MCP server** | `mcp-handler` on `/api/[transport]` + stdio bin (bundled via `pnpm mcp:build`) |

## The 7 MCP tools

| Tool | Purpose |
|---|---|
| `search_entities` | Hybrid FTS + vector search, ranked entity stubs |
| `get_entity` | Full content for one entity |
| `get_related` | Entities linked by typed relationships |
| `list_by_type` | Filter by person, place, event, concept, work, organization, species, or artifact |
| `list_by_topic` | All entities tagged with a topic slug |
| `list_by_date_range` | Entries with `key_dates` falling inside a year window |
| `get_citations` | LLM-claimed citation list for one entity |

Every tool response is wrapped in the LLM-claimed caveat string — it's not optional.

## Local setup

```bash
# 1. Install
pnpm install

# 2. Local Postgres (Docker)
docker compose up -d

# 3. Apply schema
psql postgres://library:changeme@localhost:5434/library -f scripts/init-db.sql
pnpm db:migrate

# 4. Configure env
cp .env.example .env.local
# Fill in AI_GATEWAY_API_KEY, ADMIN_TOKEN, CRON_SECRET. DATABASE_URL can be
# omitted to use the local Docker DB.

# 5. Seed + generate
pnpm pipeline:seed                     # loads data/seeds.csv into seed_topics
pnpm pipeline:generate --limit 5       # generates against pending seeds

# 6. Run the site
pnpm dev                               # http://localhost:3000

# 7. Smoke test the MCP server (against the running dev server)
pnpm mcp:smoke
```

## Targeting production from a local shell

`lib/env.ts` only loads `.env.local` and `.env`. To run scripts against Neon:

```bash
set -a
source .env.prod
set +a
pnpm pipeline:generate --limit 25
```

## Connect Claude Desktop

First build a single-file bundle (no tsx dependency):

```bash
pnpm mcp:build   # emits dist/alexandria-mcp.mjs (~25 KB)
```

Then add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "alexandria": {
      "command": "node",
      "args": ["/abs/path/to/alexandria/dist/alexandria-mcp.mjs"],
      "cwd": "/abs/path/to/alexandria"
    }
  }
}
```

The bin loads `.env.local` from `cwd`, then connects to Neon (if
`DATABASE_URL` is set there) or local Docker.

## Costs

Per-entity end-to-end (generate + verify + embed): **about $0.013** on the current cross-family combo (DeepSeek V4 Pro + Claude Haiku 4.5 + Voyage 4 large). That's a 55% reduction vs. the previous same-model Gemini × Gemini configuration, and the consensus_score now reflects cross-family agreement rather than sampling variance. Budget caps are enforced in `pipeline/budget.ts` against actual spend logged in the `generation_runs` table:

```
MONTHLY_BUDGET_USD=100   # master cap
DAILY_BUDGET_USD=5       # 24h window
BURN_PER_HOUR_USD=0.50   # default; can override to flatten with daily for bulk seeding
```

A `BudgetExceeded` exception from a script is the safety net working as designed.

## License & credit

MIT. Built with [Claude Code](https://claude.com/claude-code). All entries are LLM-distilled and carry the caveat to that effect at every surface.
