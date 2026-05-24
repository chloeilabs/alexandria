# Alexandria — agent guide

A living digital encyclopedia of human civilization. Tier 0 (Wikidata stub) → Tier 3 (hand-curated). Live at https://alexandria-chloei.vercel.app. Source of truth for project decisions is `DECISIONS.md`; for what's verified-working is `VERIFICATION.md`; for unresolved questions is `OPEN_QUESTIONS.md`. Read those first when you need history.

## Hard rules (non-negotiable)

- **Anti-Western-bias is a hard requirement** at every layer — seed filter, homepage rotation, civilizational tags, calibration set. If you're adding content, querying, or ranking, ask whether the change would skew the corpus back toward the West. The audit at `pipeline/audit/coverage-report.ts` is the diagnostic.
- **Never commit secrets.** `.env`, `.env.local`, `.env*.local`, `.env.prod`, `.env.production`, `.env.production.local` are all gitignored — keep it that way. GitHub push protection has caught one near-miss already. `AI_GATEWAY_API_KEY`, `DATABASE_URL`, `CRON_SECRET` are the sensitive ones.
- **Daily AI budget cap: $20.** Enforced by `pipeline/budget.ts:checkBudget()` before every Gateway call. If a script throws `BudgetExceeded`, that's the safety net working — don't bypass it.
- **`CRON_SECRET` must have no trailing whitespace.** Vercel rejects env values with trailing whitespace at build time. When adding via shell, use `printf "%s"` not `echo`.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 |
| DB | Postgres 17 + pgvector (HNSW), Drizzle ORM (postgres-js client) |
| AI | Vercel AI Gateway → `google/gemini-3.5-flash` (`MODEL_FLASH`); Voyage 3 large for embeddings (1024-dim) |
| Search | Hybrid FTS + pgvector via Reciprocal Rank Fusion (k=60) |
| Maps | MapLibre GL 5, hand-authored historical empire overlays |
| Deploy | Vercel (Hobby tier covers everything); Neon Postgres (Vercel marketplace integration) |

Node 24, pnpm 10.

## Repo layout

```
app/              Next.js routes (entity, civilization, era, thread, search, about, api/*)
components/       React components, grouped by surface (entity/, nav/, search/, map/)
lib/              db/ (schema + queries + retry), ai/ (prompts + gateway), wikipedia/, format/
pipeline/         budget.ts, workers/ (summarize, narrate, fact-check), bulk/ (Wikidata + Wikipedia stream parsers), audit/
scripts/          one-shot CLI runners: seed-batch-N, enrich-all, narrate-all, tag-all, embed-all, fetch-media, fact-check-all, fix-flagged-entities, smoke-test, tier3/, repair-wikipedia-titles
drizzle/          generated migrations (0000–0005)
docker-compose.yml  local Postgres + pgvector on port 5434
```

## Database topology

Two databases. Don't confuse them.

| | Neon (production) | Local Docker (`localhost:5434`) |
|---|---|---|
| Purpose | The live, curated 376-entity site | Bulk research index from the Wikidata dump |
| Reached via | `DATABASE_URL` env var (from Vercel marketplace integration in prod; `.env.prod` locally) | Default fallback when `DATABASE_URL` is unset (see `lib/db/index.ts:7-9`) |
| Size | ~376 entities, ~50MB | ~242K entities and growing (bulk ingest still running multi-day), ~1GB |
| Schema | Same Drizzle schema | Same Drizzle schema |
| Never | Don't ship bulk entities directly to Neon — they're Tier 0 stubs that degrade UX | Don't run user-facing queries against this; it's a research index |

The bridge from bulk → Neon is `scripts/promote-from-bulk.ts` — picks specific QIDs, copies them, then the full enrich chain promotes to Tier 1+.

## Env loading quirk (you'll hit this)

`lib/env.ts` only reads `.env.local` and `.env`. Production env vars live in `.env.prod` (gitignored). When running any TS script against Neon from a local shell:

```bash
DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.prod | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"') pnpm tsx <script>
```

Without that prefix, scripts hit local Docker (the fallback in `lib/db/index.ts`).

`AI_GATEWAY_API_KEY` lives in `.env.prod` too. The `[ai] AI_GATEWAY_API_KEY is not set` warning is misleading — it's printed by the AI module before env loading completes, but the calls still succeed because the env var is present.

## The four tiers

- **Tier 0** — Wikidata stub: name, dates, type, coords, relationships. Surface only through inbound links; never on the homepage or above search fold.
- **Tier 1** — 150-300 word summary from Wikipedia lead via `lib/ai/prompts/summarize.ts`.
- **Tier 2** — 800-1500 word narrative from Wikipedia + (where available) 1911 Britannica via `lib/ai/prompts/narrate.ts`. Fact-checked separately by `pipeline/workers/fact-check.ts`; flagged claims published with the entry.
- **Tier 3** — Hand-picked imagery, 2,500-3,500 word prose, no algorithmic caps. The 10 anchors: Hannibal, Mansa Musa, Wu Zetian, Hatshepsut, Songhai Empire, Saladin, Murasaki Shikibu, Akbar, Tupac Amaru II, Bronze Age Collapse. Mansa Musa is also hand-edited (the editorial benchmark).

Tier 3 hand-edits use scholarly sources beyond what the auto-checker sees, so fact-check rows for hand-edited Tier 3 are deliberately not maintained — delete the row if you re-fact-check by accident.

## Standard enrichment chain

Run order, all from project root:

```bash
pnpm tsx scripts/enrich-all.ts        # Tier 0 → 1   (Wikipedia REST)
pnpm tsx scripts/narrate-all.ts       # Tier 1 → 2   (multi-source narrate)
pnpm tsx scripts/tag-all.ts           # civilization + era tagging
pnpm tsx scripts/embed-all.ts         # Voyage 3 large → pgvector
pnpm tsx scripts/fetch-media.ts       # Commons hero image
pnpm tsx scripts/fact-check-all.ts    # ground claims against sources
pnpm tsx scripts/rebuild-slugs.ts     # promote unique slugs (foo-q123 → foo)
```

`enrich-all` and `narrate-all` cost ~$0.005 and ~$0.02 per entity. Always remember the `DATABASE_URL=…` prefix when targeting Neon.

## Pre-commit / pre-push checks

```bash
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm smoke        # end-to-end production smoke (19 surfaces, ~7s, exits 1 on fail)
```

CI runs typecheck + lint on every push and PR. Build succeeds on Vercel ≠ CI succeeds, because Vercel doesn't run lint. Run both locally before pushing.

## Git + deploy workflow

- Default branch: `main`. Direct pushes deploy to production via Vercel.
- Commit messages: conventional (`feat`, `fix`, `docs`, `chore`, `refactor`). End with the `Co-Authored-By` footer.
- Vercel auto-builds on every push. New SHA appears in `/api/health` `build.commit_sha` ~90–120s after push.
- Pre-PR-workflow: we still push direct to main. If you want a PR for a risky change, push to a feature branch — Vercel will preview it.

The Claude Code auto-mode classifier blocks `git push origin main` by default; the user has to explicitly authorize each push session ("Push everything is good"). Don't try to work around this — it's the only soft enforcement on direct-to-main.

## Operational surfaces

- `/api/health` — DB roundtrip, entity count, tier breakdown, fact-check coverage, featured-cache age, build SHA. Returns 200 if ok, 503 if degraded.
- `/api/cron/refresh-featured` — daily at 03:00 UTC (Vercel Cron). Validates `Authorization: Bearer ${CRON_SECRET}`. Refreshes the homepage featured-set cache.
- Vercel Speed Insights + Analytics — wired in `app/layout.tsx`. Free on Hobby.

## Documentation pointers

- `DECISIONS.md` — every architectural trade-off with the reasoning. Read before making structurally significant changes.
- `VERIFICATION.md` — acceptance criteria + how each is verified.
- `OPEN_QUESTIONS.md` — unresolved design questions.
- `README.md` — public-facing project intro + script index.
- `/about` page — public-facing colophon.

## Common gotchas

- Wikidata labels diverge from Wikipedia article titles in many cases (typos, non-English fallback labels). `lib/wikipedia/index.ts` has a sitelink fallback when called with `{ qid }`; the repair script `scripts/repair-wikipedia-titles.ts` backfills stuck entities.
- `media.commons_url` has a unique index — two entities pointing to the same Commons file means only the first gets the row. Documented in DECISIONS.
- pgbouncer compatibility: postgres-js client is configured with `prepare: false` (see `lib/db/index.ts`). Don't switch to prepared statements.
- Neon cold-start: `lib/db/retry.ts` wraps queries with retry. Use `withRetry()` for any new route handler that depends on the DB.

## When you're not sure

Pick the change that preserves the anti-Western-bias commitment, respects the budget cap, and keeps secrets out of git. When that's not enough, read `DECISIONS.md` for prior reasoning. When that's not enough, ask.
