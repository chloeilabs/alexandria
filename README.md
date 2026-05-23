# The Library of Alexandria, Reborn

A living digital encyclopedia of human civilization — comprehensive, narrative, and visually navigable. Built locally, for one developer, with a continuously-running ingestion pipeline that grows the corpus daily.

> _Wikipedia meets Google Earth meets a museum tour, with the soul of Cosmos and the rigor of a graduate seminar._

## Local-only project

This repository **lives only on this laptop**. There is no GitHub remote and there never will be. Commits are local for history; the worktree is the canonical copy.

### Backup recommendation (your responsibility)

Pick at least one of:

- **Time Machine** — set it up on an external SSD and let it run. Easiest. Covers everything.
- **External drive snapshots** — periodically `rsync` the project directory to an external disk (`media-cache/` and `dumps/` can be excluded; they're regenerable).
- **iCloud / Dropbox / OneDrive** — move the project under a synced folder. Be careful: large `dumps/` and `media-cache/` directories will hammer your bandwidth and quota; exclude them.

Whatever you choose, **back up `drizzle/migrations/`, all source files, `DECISIONS.md`, and the Postgres data volume**. The Postgres volume is named `library-of-alexandria-pgdata` — back it up with `docker run --rm -v library-of-alexandria-pgdata:/data -v $(pwd):/backup alpine tar czf /backup/pgdata-backup.tar.gz /data` from time to time.

You do not need to back up `node_modules/`, `.next/`, `dumps/`, or `media-cache/` — they're regenerable.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + pgvector
docker compose up -d postgres

# 3. Create your local env file
cp .env.example .env.local
# Then fill in ANTHROPIC_API_KEY in .env.local

# 4. Generate and apply the initial schema
pnpm db:generate
pnpm db:migrate

# 5. Run the dev server
pnpm dev

# 6. In another terminal, run the pipeline
pnpm pipeline
```

The site is at `http://localhost:3000`. Drizzle Studio (ad-hoc DB browser) at `pnpm db:studio`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript strict check across the project |
| `pnpm lint` | ESLint (Next.js flat config) |
| `pnpm pipeline` | Boot the continuous ingestion + enrichment pipeline |
| `pnpm pipeline:wikidata` | One-time Wikidata JSON dump streaming import |
| `pnpm pipeline:wikipedia` | One-time Wikipedia XML dump streaming import |
| `pnpm pipeline:tags` | Batch civilizational-tag assignment |
| `pnpm pipeline:audit` | Coverage report (entities-per-region-per-era) |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema directly (dev convenience; skips migration files) |
| `pnpm db:studio` | Open Drizzle Studio for ad-hoc DB browsing |

## Architecture

See `DECISIONS.md` for the locked architectural choices and the reasoning behind each. See `OPEN_QUESTIONS.md` for items that need editorial input.

High level:

- **Frontend**: Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (`new-york`), Motion v12
- **Maps**: MapLibre GL 5 + `@openhistoricalmap/maplibre-gl-dates` for time-aware vector tiles
- **Graph**: `react-force-graph-2d` (Canvas/WebGL — never renders the full corpus)
- **Timeline**: Canvas-based with D3 scales + level-of-detail aggregation
- **Database**: Postgres 17 with pgvector for embeddings, `pg-boss` for the job queue (same DB)
- **AI**: Anthropic SDK — Haiku 4.5 for Tier 1 summaries, Sonnet 4.6 for Tier 2 multi-source narratives, Opus 4.7 for the curated tier
- **Ingestion**: Streaming parsers for Wikidata JSON and Wikipedia XML bz2 dumps; matched by Wikidata QID

## Quality tiers

Every entity sits at one of four tiers. The pipeline upgrades entities continuously.

- **Tier 0** — Stub from Wikidata dump (name, dates, type, coordinates, relationships)
- **Tier 1** — Summary (150-300 words, Haiku-rewritten Wikipedia lead)
- **Tier 2** — Full narrative (800-1500 words, Sonnet-synthesized from Wikipedia + 1911 Britannica + other PD sources)
- **Tier 3** — Editorially curated (Tier 2 + hand-picked imagery + custom map overlays + reviewed prose)

## What this isn't (yet)

Day-one is the corpus and the core navigation surfaces. Not day-one: user accounts, notebooks, audio narration, mobile-first UI, multi-language UI, personalized "guide" mode, primary-source linkouts, community curation. See the brief and `DECISIONS.md` for the deferral list.
