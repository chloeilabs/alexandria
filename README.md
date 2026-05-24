# Alexandria

A living digital encyclopedia of human civilization — Wikipedia meets Google Earth meets a museum tour. Comprehensive across all eras and regions, with curated long-form prose at the top tier and structured Wikidata coverage at the base.

**Live:** [alexandria-chloei.vercel.app](https://alexandria-chloei.vercel.app)

> 347 entities at launch, 340 at Tier 2, 10 at Tier 3 (hand-curated). All Tier 2 entries are fact-checked against their sources; the flagged-claims surface is visible on every entry.

## What it tries to do differently

Most encyclopedias of human history default to the West. Wikipedia is denser in English; English is densest on European subjects; the long tail of non-European history is underrepresented even when the underlying scholarship is rich.

Alexandria explicitly resists that default at every layer:

- The seed filter rewards entries with sitelinks in **non-European Wikipedias** (Arabic, Chinese, Hindi, Swahili, Yoruba, etc.).
- The homepage rotation never lets one civilization dominate (no region above 2× appearance).
- Civilizational tags are **curated**, not imposed from a UN subregion map — Mongol Khanate and Islamic Caliphates aren't trapped inside a single modern country.
- The calibration set the prose was tuned against runs from Hannibal to Mansa Musa to Wu Zetian to Tupac Amaru II to Murasaki Shikibu — not just the Greco-Roman canon.

The 10 Tier 3 anchors are the explicit answer to "what should an encyclopedia of human history look like if you don't start in Europe."

## Architecture

| Layer | Stack |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind v4 |
| **Database** | Neon Postgres 17 + pgvector (HNSW index) |
| **Search** | Hybrid FTS + pgvector embeddings via Reciprocal Rank Fusion |
| **Embeddings** | Voyage 3 large, 1024-dim cosine, through Vercel AI Gateway |
| **Generation** | Google Gemini 3.5 Flash through Vercel AI Gateway |
| **Maps** | MapLibre GL 5 with 8 hand-authored historical empire overlays |
| **Timeline** | Canvas + D3 scales + level-of-detail aggregation |
| **Graph** | react-force-graph-2d (Canvas/WebGL) |
| **Threads** | Curated editorial paths through 5-7 entities |
| **Deployment** | Vercel (Hobby tier covers everything) |
| **Observability** | Vercel Speed Insights + Analytics |
| **Daily refresh** | Vercel Cron writes featured-rotation cache at 03:00 UTC |

## The four quality tiers

Every entity sits at one of four tiers. The pipeline upgrades entries based on inbound-link centrality and editorial attention.

- **Tier 0** — Stub from the Wikidata dump (name, dates, type, coordinates, relationships). Stubs surface only through other entries; they never appear on the homepage or above the search fold.
- **Tier 1** — 150-300 word summary, rewritten from Wikipedia's lead through `lib/ai/prompts/summarize.ts`.
- **Tier 2** — 800-1500 word narrative, synthesized across Wikipedia and (where available) the 1911 Encyclopædia Britannica via `lib/ai/prompts/narrate.ts`. Fact-checked separately by `pipeline/workers/fact-check.ts`; flagged claims published with the entry.
- **Tier 3** — Hand-picked imagery, longer-form prose (2,500-3,500 words), no algorithmic caps. The 10 anchors are: Hannibal, Mansa Musa, Wu Zetian, Hatshepsut, Songhai Empire, Saladin, Murasaki Shikibu, Akbar, Túpac Amaru II, Bronze Age Collapse.

## Setup (local dev)

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + pgvector
docker compose up -d postgres

# 3. Create your local env file
cp .env.example .env.local
# Fill in AI_GATEWAY_API_KEY
# Get one at https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys

# 4. Generate + apply schema
pnpm db:generate
pnpm db:migrate

# 5. Seed a curated batch (no API spend; just structure)
pnpm tsx scripts/seed-curated.ts

# 6. Enrich the seed to Tier 1+ (uses AI Gateway; ~$0.40 for ~80 entities)
pnpm tsx scripts/enrich-all.ts
pnpm tsx scripts/narrate-all.ts

# 7. Dev server
pnpm dev
```

The site is at `http://localhost:3000`.

Drizzle Studio (ad-hoc DB browser) at `pnpm db:studio`.

## Production deploy

Project is wired up to deploy to Vercel on push to `main`:

1. Push commits to `github.com/chloeilabs/alexandria`
2. Vercel auto-builds and ships
3. Neon Postgres is the production DB; auto-connected via Vercel Postgres marketplace integration
4. Vercel Cron triggers `/api/cron/refresh-featured` daily at 03:00 UTC

Required env vars (set in Vercel project):

- `DATABASE_URL` — Neon connection string
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key
- `CRON_SECRET` — random 64-hex string for cron route auth
- `WIKIMEDIA_USER_AGENT` — optional, identifies us to Wikimedia APIs

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint (Next.js flat config) |
| `pnpm smoke` | End-to-end smoke test against production (19 surfaces) |
| `pnpm db:generate` | Generate a new Drizzle migration |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm pipeline:wikidata` | Stream Wikidata JSON dump (use `--stdin` for curl-pipe) |
| `pnpm pipeline:audit` | Coverage report (entities-per-region-per-era) |
| `pnpm tsx scripts/seed-curated.ts` | Seed the initial ~60 entities |
| `pnpm tsx scripts/seed-batch-{N}.ts` | Targeted seed batches |
| `pnpm tsx scripts/enrich-all.ts` | Tier 0 → Tier 1 (summarise) |
| `pnpm tsx scripts/narrate-all.ts` | Tier 1 → Tier 2 (narrate) |
| `pnpm tsx scripts/narrate-britannica-rerun.ts` | Re-narrate with Britannica multi-source |
| `pnpm tsx scripts/tier3-curate.ts` | Promote 5 anchors to Tier 3 |
| `pnpm tsx scripts/tag-all.ts` | Civilizational tag assignment |
| `pnpm tsx scripts/embed-all.ts` | Voyage 3 large embeddings → pgvector |
| `pnpm tsx scripts/fetch-media.ts` | Pull hero imagery from Commons |
| `pnpm tsx scripts/fact-check-all.ts` | Fact-check Tier 2 narratives |
| `pnpm tsx scripts/fix-flagged-entities.ts` | Re-narrate the worst-flagged entries |
| `pnpm tsx scripts/probe-britannica-coverage.ts` | Persist Britannica articles to `sources` |
| `pnpm tsx scripts/rebuild-slugs.ts` | Promote unique-base slugs |
| `pnpm tsx pipeline/audit/coverage-report.ts` | Regional / era / civilization audit |

## Budget discipline

The pipeline never silently runs over budget. `pipeline/budget.ts` enforces a hard `DAILY_BUDGET_USD` cap (default 20):

1. Before each AI Gateway call, estimate cost via the model's pricing constants.
2. Query today's cumulative spend from `pipeline_runs`.
3. If `current + estimated > cap`, throw `BudgetExceeded` — the script logs and stops.

Voyage embeddings cost ~$0.18 / million tokens; full corpus at 347 entities = $0.02. Gemini Flash for narration costs ~$1.50/M input + $9/M output; the full Tier 2 corpus was rewritten for under $5 total.

## Sources + licensing

- Wikipedia article text adapted under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution on every entry.
- 1911 Encyclopædia Britannica content is public domain in the United States; pulled via Wikisource.
- Imagery from Wikimedia Commons, per-image attribution + license shown on each entry.

## Documentation

- [DECISIONS.md](./DECISIONS.md) — every meaningful architectural trade-off and the reasoning
- [VERIFICATION.md](./VERIFICATION.md) — acceptance criteria + how each is verified
- The [/about page](https://alexandria-chloei.vercel.app/about) — public-facing version, same content angled for readers
