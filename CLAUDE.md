# Alexandria — agent guide

An AI-distilled knowledge base, designed for AI agents to call as an MCP
tool. Every entry is synthesized by a language model from its own training
knowledge, cross-checked against itself by a verifier pass, and surfaced
through an MCP server. There is no Wikipedia, Wikidata, or third-party
source behind it. Live at https://alexandria.chloei.ai. PR history on
GitHub is the source of truth for past decisions — read recent merged PRs
when you need context.

## Hard rules (non-negotiable)

- **The "LLM-claimed, not externally verified" caveat must surface at every
  read surface.** It's enforced in three places: `components/entity/
  ProvenanceBadge.tsx` (above the narrative), `components/entity/
  ClaimedCitations.tsx` (above any citation list), and
  `lib/mcp/citation-wrap.ts` (in every MCP tool response payload). Never
  remove or bypass these — the editorial integrity of the project depends
  on them.
- **Never commit secrets.** `.env`, `.env.local`, `.env.prod`, `.env*.local`
  are all gitignored. `AI_GATEWAY_API_KEY`, `DATABASE_URL`, `ADMIN_TOKEN`,
  `CRON_SECRET` are the sensitive ones. GitHub push protection has caught
  near-misses before.
- **AI budget cap is enforced.** `pipeline/budget.ts:checkBudget()` runs
  three windows — monthly / daily / hourly — before every Gateway call,
  reading actual spend from `generation_runs`. Defaults: `$100/mo →
  $3.33/day → $0.33/hr`, overridable per env var. Production currently
  runs `MONTHLY_BUDGET_USD=100`, `DAILY_BUDGET_USD=5`,
  `BURN_PER_HOUR_USD` unset → `$0.50/hr` default. For bulk seeding, set
  `BURN_PER_HOUR_USD=5` inline to converge with daily.
  `BudgetExceeded` thrown from a script is the safety net working —
  don't bypass it.
- **`CRON_SECRET` and `ADMIN_TOKEN` must have no trailing whitespace.**
  Vercel rejects env values with trailing whitespace at build time. When
  adding via shell, use `printf "%s"` not `echo`.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 |
| DB | Postgres 17 + pgvector (HNSW), Drizzle ORM (postgres-js client) |
| AI | Vercel AI Gateway → `google/gemini-3.5-flash` for generation + verification; Voyage 4 large for embeddings (1024-dim) |
| MCP | `mcp-handler` on `/api/[transport]` (HTTP) + `bin/alexandria-mcp.ts` (stdio) |
| Search | Hybrid FTS + pgvector via Reciprocal Rank Fusion (k=60) |
| Deploy | Vercel; Neon Postgres (marketplace integration) |

Node 24, pnpm 10.

## Repo layout

```
app/              Next.js routes: /, /search, /browse, /topic/[slug],
                  /entity/[slug], /quality, /about, /admin,
                  /api/health, /api/[transport] (MCP), /api/cron/refresh-featured,
                  /api/admin/*
bin/              alexandria-mcp.ts (stdio MCP entry for Claude Desktop)
components/       admin/, browse/, entity/, featured/, layout/, nav/,
                  quality/, search/, topic/, theme/
data/             seeds.csv (curated entity list, pipeline:seed reads this)
drizzle/migrations/ 0000_complex_quentin_quire.sql, 0001_indexes.sql
lib/
  ai/             index.ts (model ids + cost helpers), gateway.ts (SDK wrappers)
  db/             schema.ts, retry.ts, index.ts, queries/{entity,featured,quality,search,topic}.ts
  mcp/            server.ts (7-tool registration), citation-wrap.ts (caveat enforcer)
  env.ts          dotenv loader (only reads .env.local + .env)
middleware.ts     bearer-token gate for /admin + /api/admin/*
pipeline/
  budget.ts       3-window budget check
  generate.ts     orchestrator: generate → verify → embed → insert
  index.ts        loop runner used by scripts/generate-batch.ts
  prompts/        generate.ts (the editorial prompt) + verify.ts
scripts/
  seed-from-csv.ts     load data/seeds.csv into seed_topics
  generate-batch.ts    run pipeline against pending seed_topics
  smoke-mcp.ts         HTTP smoke test of all 7 MCP tools
  smoke-site.ts        production end-to-end smoke
  init-db.sql          extensions + role search_path
  sync-prod-to-local.sh  bring local Docker DB into parity with Neon (rare)
```

## Database topology

Two Postgres instances. Don't confuse them.

| | Neon (production) | Local Docker (`localhost:5434`) |
|---|---|---|
| Purpose | The live, AI-generated 53-entity corpus | Optional local sandbox for pipeline iteration |
| Reached via | `DATABASE_URL` env var (from `.env.prod`) | Default fallback when `DATABASE_URL` is unset (see `lib/db/index.ts`) |
| Schema | Same 9-table Drizzle schema | Same |
| Lifecycle | Source of truth for the live site | Throwaway; rebuild via migrations whenever |

## The 9-table schema

`entities` (canonical row) · `entity_aliases` · `entity_relationships` ·
`entity_claimed_citations` · `entity_topics` · `seed_topics` (curation
queue) · `generation_runs` (cost + token log) · `review_queue` (flagged
entities, severity ≥ medium) · `featured_rotation` (daily homepage set).

## Pipeline flow

1. **Seed**: editorial names land in `data/seeds.csv` → `pnpm pipeline:seed`
   inserts into `seed_topics`.
2. **Generate**: `generate-batch.ts` pulls pending seeds; for each:
   1. `checkBudget` against `generation_runs` aggregate
   2. `generateStructured` with the editorial prompt (model: Gemini 3.5 Flash)
   3. `generateStructured` again on a verifier prompt (same model, fresh context)
   4. `consensusScoreFrom(disagreements)` — 1.0 minus weighted severity
   5. `embed` the canonical + short + summary (Voyage 4 large)
   6. `sanitizeForPostgres` strips NULL bytes the model sometimes emits
   7. Insert into `entities` inside a transaction, plus aliases / topics /
      citations / relationships rows
   8. High-severity disagreement → `status = 'flagged'` + row in `review_queue`
3. **Surface**: web app + MCP server read from the same Postgres.
   Featured rotation is a tiny daily cron that picks 3–8 entities for
   the homepage.

Costs (current settings, Gemini 3.5 Flash + Voyage 4 large): about
**$0.025–$0.10 per entity** end-to-end depending on narrative length.

## The 7 MCP tools

| Tool | Purpose |
|---|---|
| `search_entities` | Hybrid FTS + vector RRF, ranked entity stubs |
| `get_entity` | Full content for one entity by slug |
| `get_related` | Entities linked by `entity_relationships` |
| `list_by_type` | Filter by `person`/`place`/`event`/`concept`/`work`/`organization`/`species`/`artifact` |
| `list_by_topic` | All entities tagged with a topic slug |
| `list_by_date_range` | Anchored on `key_dates[].year` |
| `get_citations` | LLM-claimed citation list for one entity |

Every response goes through `lib/mcp/citation-wrap.ts` which prepends the
"AI-distilled summaries. Citations are LLM-claimed, not externally
verified." caveat string.

## Env loading quirk (you'll hit this)

`lib/env.ts` only reads `.env.local` and `.env`. Production env vars live
in `.env.prod` (gitignored). When running any TS script against Neon
from a local shell:

```bash
set -a
source .env.prod
set +a
pnpm tsx <script>
```

`AI_GATEWAY_API_KEY` lives in `.env.prod` too. Without sourcing, scripts
hit local Docker (the `lib/db/index.ts` fallback) and the AI SDK fails
auth.

## AI Gateway auth gotcha

Vercel AI Gateway accepts two auth modes — `AI_GATEWAY_API_KEY` and
`VERCEL_OIDC_TOKEN`. The AI SDK prefers `AI_GATEWAY_API_KEY` when both
are set. If a freshly-issued API key was created with restricted scope
(model-list only, no inference), you'll see a 401 with `"Authentication
failed. Check that your Vercel credential is valid and has access to AI
Gateway."` — not the clearer "no inference scope" error.

Workarounds:
- Issue a new key from the dashboard with full scope, then
  `vercel env add AI_GATEWAY_API_KEY <env>` for each scope.
- Or `unset AI_GATEWAY_API_KEY` so the SDK falls back to
  `VERCEL_OIDC_TOKEN` (project-scoped, full inference).

## Postgres client compat

Neon runs Postgres 17. Homebrew/macports `pg_dump`/`psql` are often v14
and refuse to connect with `server version mismatch`. Run them through
the Docker image:

```bash
docker run --rm -e PGURL="$DATABASE_URL_UNPOOLED" postgres:17 \
  bash -c 'pg_dump "$PGURL" --no-owner --no-acl --schema=public'
```

## Pre-commit / pre-push checks

```bash
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm site:smoke   # production smoke (after deploy)
pnpm mcp:smoke    # MCP HTTP smoke against http://localhost:3000
```

CI runs typecheck + lint on every push and PR.

## Git + deploy workflow

- Default branch: `main`. Direct pushes deploy to production via Vercel.
- Conventional commit prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`.
- The Claude Code auto-mode classifier blocks `git push origin main` and
  prod-side destructive ops by default; explicit per-session
  authorization is required (e.g. user says "push to main").
- Branch protection on `main` allows admin merge — use
  `gh pr merge --admin --merge` after PR review.

## Operational surfaces

- `/api/health` — DB roundtrip, entity counts by status, last
  generation_run, build SHA. 200 if ok, 503 if degraded.
- `/api/cron/refresh-featured` — daily at 03:00 UTC (Vercel Cron).
  Validates `Authorization: Bearer ${CRON_SECRET}`. Picks 3–8 entities
  by recency + consensus into `featured_rotation`.
- `/api/admin/*` and `/admin/*` — bearer-gated via `middleware.ts`
  against `ADMIN_TOKEN`. Read-only review surface for flagged entities.
- `/api/[transport]` — MCP server over Streamable HTTP. Reachable as
  `https://alexandria.chloei.ai/api/mcp`.

## Common gotchas

- **postgres-js array binding**: `sql\`x = ANY(${arr}::uuid[])\`` binds
  the JS array as a composite record, not a uuid[]. Use Drizzle's
  `inArray(col, arr)` instead (see `lib/db/queries/featured.ts`).
- **AI SDK v6 model ids**: plain string model ids no longer auto-route
  through the gateway. Wrap with `gateway(modelId)` from `@ai-sdk/gateway`
  (already in `lib/ai/gateway.ts`).
- **Model NULL bytes**: Gemini occasionally emits `\x00` in place of
  accented characters. `pipeline/generate.ts:sanitizeForPostgres()`
  strips them before insert.
- **pgbouncer**: postgres-js is configured with `prepare: false` (see
  `lib/db/index.ts`). Don't switch to prepared statements.
- **Neon cold-start**: `lib/db/retry.ts` wraps queries with retry. Use
  `withRetry()` for any new route handler that hits the DB.

## When you're not sure

Pick the change that preserves the LLM-claimed caveat at every read
surface, respects the budget cap, and keeps secrets out of git. When
that's not enough, read the merged PRs on GitHub. When that's not
enough, ask.
