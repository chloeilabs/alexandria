# Architectural Decisions

Locked decisions with reasoning. Every meaningful tradeoff goes here. Each entry has a date.

---

## 2026-05-22 — Job queue: pg-boss on Postgres (NOT Valkey + BullMQ)

The verified brief specified Valkey + BullMQ. Overruled in favor of `pg-boss` on the same Postgres we already run.

**Reasoning:** One fewer container (Valkey would be a second daemon to manage on a single laptop). Job inserts and entity writes can share a transaction, which matters for things like "mark entity Tier 2 + delete the narrate job + insert a fact-check job" atomically. pg-boss is mature, supports cron schedules, dead-letter, retries, priority queues — everything we need at laptop scale. Throughput is well under what Postgres handles comfortably.

**Reconsider if:** queue throughput becomes a bottleneck (unlikely at our entity rates) or we add a second machine.

---

## 2026-05-22 — Graph: react-force-graph-2d (NOT D3 SVG force)

D3 SVG force-directed graph degrades badly past ~1000 nodes. The corpus has millions; even neighborhood-of-seed views with expansion can exceed SVG's frame budget.

**Reasoning:** `react-force-graph-2d` is Canvas-backed (with WebGL fallback via three.js for 3D), maintains 60fps at our typical neighborhood sizes. We will never render the full corpus; UX is always seed + 1-2 hop expansion, capped around 80 visible nodes.

**Reconsider if:** we want a richer node renderer than Canvas can do (e.g., rich HTML cards inside nodes) — would switch to a custom WebGL pipeline.

---

## 2026-05-22 — Timeline: Canvas renderer, D3 for scales/axes only (NOT D3 SVG)

5500 years × millions of entities in SVG is a frame-budget catastrophe.

**Reasoning:** D3 SVG can do beautiful axes and scales, but the rendering layer needs to be Canvas with level-of-detail aggregation. At zoomed-out views we render civilization bands (grouped by civilizational tag); zoomed in we render individual entities. D3 is still the right tool for scales, ticks, and zoom behavior.

---

## 2026-05-22 — Seed filter: P31 + ≥3 cross-wiki sitelinks (≥1 non-European) + regional augmentation

Filtering Wikidata's ~115M entities down to ~5M historically-relevant ones is the foundational decision; the bias profile of Tier 0 propagates through the whole system.

**Reasoning:** "Has English Wikipedia article" inherits en-wiki bias (en.wiki ~6.8M articles vs yo.wiki ~33K). Pure type-filter (P31) gets ~10M with noise. The chosen approach — P31 type-whitelist AND ≥3 cross-wiki sitelinks AND at least one sitelink in a non-European wiki — uses multi-language coverage as a quality proxy without inheriting the en-wiki bias. Then a follow-up augmentation pass over-samples underrepresented regions (sub-Saharan Africa, MENA, Andean, pre-Columbian, Polynesian) up to per-bucket caps.

---

## 2026-05-22 — Region taxonomy: hybrid (UN subregions + 47 civilizational tags)

Each entity carries two region tags: an algorithmic UN subregion (from P17 country or coordinates) AND zero-or-more curated civilizational tags.

**Reasoning:** Modern regions alone fail for cross-border civilizations (Mongol Khanate, Islamic Caliphates, Roman Empire). Civilizational alone is hard to populate algorithmically. The hybrid lets the ranker filter on either dimension and lets the homepage rotation algorithm enforce "no region appears more than 2×" using whichever dimension makes sense.

The civilizational tag list itself is an editorial artifact. The current closed taxonomy lives in `lib/regions/civilizational-taxonomy.ts`; reopen `OPEN_QUESTIONS.md` Q2 if editorial review changes it.

---

## 2026-05-22 — Tier 2 source: multi-source synthesis (Wikipedia + 1911 Britannica + extras)

A Claude-rewritten Wikipedia article — even in our voice — is still a derivative work; CC BY-SA requires attribution and share-alike. Single-source rewrites also tend to inherit Wikipedia's structure even when the prose changes.

**Reasoning:** Multi-source synthesis (Wikipedia + 1911 Encyclopædia Britannica from Project Gutenberg/Wikisource + Stanford Encyclopedia of Philosophy where applicable + other PD sources) produces genuinely synthesized prose. Costs ~2-3× input tokens but the output is meaningfully ours, not a Wikipedia paraphrase. Each Tier 2 narrative carries a source attribution footer listing all sources used.

---

## 2026-05-22 — Node 24 LTS instead of Node 22 LTS

The brief said Node 22 LTS. We installed Node 24 because it's the current active LTS as of May 2026 (Node 24 went LTS October 2025; Node 22 entered maintenance October 2025). All dependencies work on both.

**Reconsider if:** a specific dependency breaks on Node 24 (none observed so far).

---

## 2026-05-22 — Coordinates: float4 / `real` lat/lon columns, no PostGIS

The brief mentioned PostGIS point. We use plain `real` (float4) columns for latitude and longitude.

**Reasoning:** The map renderer (MapLibre) handles all geographic rendering client-side. The DB only needs to return lat/lon per entity. We do not run spatial joins, bounding-box queries, or radius searches on the server. PostGIS adds a heavy extension and requires a different Docker image; not worth it for our usage.

**Reconsider if:** we add server-side geographic queries (e.g., "all entities within 500 km of this point at this date").

---

## 2026-05-22 — pgvector index: IVFFLAT during seed, HNSW post-seed

HNSW gives better query latency but is slow to build incrementally at scale. IVFFLAT inserts fast but has worse recall.

**Reasoning:** During the bulk seed (millions of inserts), we use IVFFLAT for fast inserts. After seed completes, we run a manual migration that drops IVFFLAT and builds HNSW for production query latency. See the comment in `lib/db/schema.ts` for the exact CREATE INDEX statement to run.

---

## 2026-05-22 — Database host port: 5434

Port 5432 is held by an SSH tunnel; 5433 is also occupied locally. Our Postgres container exposes 5434 → container 5432.

---

## 2026-05-22 — Tailwind v4 OKLCH theme tokens in @theme

Theme colors live in `app/globals.css` under `@theme`, defined in OKLCH. No `tailwind.config.js`. Theme tokens become utility classes automatically (e.g., `--color-accent` → `bg-accent`, `text-accent`).

---

## 2026-05-22 — AI Gateway (Vercel) + Gemini 3.5 Flash, NOT Anthropic SDK

The brief specified Anthropic SDK + Claude models (Haiku 4.5 / Sonnet 4.6 / Opus 4.7). Switched to Vercel AI Gateway + `google/gemini-3.5-flash` as the unified default model. Reasoning:

- **Cost.** Gemini 3.5 Flash: $1.50/M in, $9/M out vs Sonnet 4.6's $3/$15. At 5M Tier 0 → 200K Tier 1 → 50K Tier 2 the savings compound meaningfully — roughly half the bill on Tier 1, similar shape on Tier 2.
- **Context window.** 1M tokens on Flash means multi-source synthesis (Wikipedia + Britannica 1911 + …) for Tier 2 fits comfortably without truncation.
- **One key, many providers.** AI Gateway is the default global provider in `ai`; switching the model is a one-string change in `lib/ai/index.ts`. Future swaps (e.g., to a Gemini Pro for the curated tier, or back to Claude for specific entities) cost almost nothing.

Migration details:
- Removed `@anthropic-ai/sdk` from deps; added `ai@6` and `zod`.
- `lib/claude/` → `lib/ai/` (provider-agnostic naming).
- Prompt modules return `generateText`-shaped args (`maxOutputTokens` not `max_tokens`).
- Fact-check uses `Output.object({ schema: z.object(...) })` instead of forced tool-use.
- Budget tracker continues to estimate per-call USD before the call; pricing constants for Gemini 3.5 Flash fetched from the AI Gateway model listing on 2026-05-22.
- Env var `ANTHROPIC_API_KEY` → `AI_GATEWAY_API_KEY`.

**Reconsider if:** Gemini Flash falls short on the calibration set (the 10 calibration entities — Hannibal, Mansa Musa, Wu Zetian, etc.). Then swap `MODEL_FLASH` in `lib/ai/index.ts` to `google/gemini-3.5-pro` or `anthropic/claude-sonnet-4.5` and re-run calibration. No other code changes required.

---

## 2026-05-22 — Explicit scope deferrals (NOT day-one)

The following are explicitly deferred. Each is mentioned in the brief's roadmap with a target month.

- User accounts, notebooks, annotations (Month 4)
- Personalized "guide" mode (Month 3)
- Audio narration (Month 9)
- Primary-source linkouts to Internet Archive / BnF Gallica (Month 6)
- Community curation (Year 2)
- 3D map (gimmicky, omitted)
- Mobile-first layout (desktop-primary; mobile graceful)
- Multi-language UI (English UI only; entity data multilingual via aliases)

---

## 2026-05-23 — Switched to GitHub remote + Vercel production deployment

The original brief was "local only. No GitHub remote. Ever." Overridden after explicit user request. The repo is now public at github.com/chloeilabs/alexandria; the site is live at alexandria-chloei.vercel.app on the Vercel Hobby tier.

**What changed:**
- Production DB is now Neon (Vercel marketplace integration), not local Docker Postgres.
- Local Docker Postgres on port 5434 is reserved for the bulk Wikidata dump research index (~250K+ entities ingested) — it doesn't ship to Neon.
- `.gitignore` strictly excludes `.env.prod`, `.env.production*`, and the `.vercel/` directory; GitHub push protection caught one near-miss on the Neon password leak; the rule is now defensive.
- The original constraint was correct caution. The decision to ship it publicly was a deliberate change of plan; the security posture got tightened in response, not relaxed.

**Implications:**
- Production has a fundamentally different data footprint than the local dev DB.
- Drizzle migrations must be applied to both. We've done this manually so far via a tsx script reading the migration SQL; a `pnpm db:migrate:prod` script with the right env wiring is on the to-do list.

---

## 2026-05-23 — Embedding provider: Voyage 3 large via AI Gateway

OPEN_QUESTIONS.md flagged this; resolved 2026-05-23.

**Choice:** `voyage/voyage-3-large` through Vercel AI Gateway. 1024-dim cosine-friendly embeddings; matches `entities.embedding vector(1024)` exactly. ~$0.18 per million tokens.

**Why not local bge-large-en-v1.5:** the original recommendation was to save the $180 projected for 5M entities. At our actual curated corpus size (~350 entities) the full embed run cost $0.02, so the cost-saving argument doesn't matter. Voyage's quality and the operational simplicity of "same gateway as the LLM" win.

**Reconsider if:** the bulk Wikidata dump local DB ever needs embeddings on its multi-million Tier 0 stubs. At that point local bge is again the right choice.

---

## 2026-05-23 — Hybrid search: FTS + pgvector via Reciprocal Rank Fusion

Postgres tsvector + GIN handles keyword matching; pgvector HNSW handles semantic neighborhoods. RRF (k=60) combines them.

**Why RRF over weighted score average:** `ts_rank` and cosine similarity live on entirely different scales, and the cosine distribution shifts with corpus size. RRF only consumes the *position* of a hit within each list, so it's robust to all of that. The k=60 default is the constant from the original RRF paper (Cormack et al., 2009).

**Acceptance test verified:** "fall of an empire" returns Babylon / Constantinople / Khmer / Songhai / Roman in the fused result. FTS alone surfaced only keyword matches; vector alone over-indexed on canonical Western empires.

---

## 2026-05-23 — Britannica 1911 hit rate: 22%, not the projected 60%+

`lib/wikisource/index.ts` looks up the 1911 Encyclopædia Britannica via Wikisource. In the 2026-05-23 snapshot, 67 of 297 Tier 2 entities probed (22%) had a matching article.

**Coverage profile:** dense for classical antiquity, European medieval / early-modern, and 19th-century European figures. Sparse for non-Western and 20th-century subjects (expected — the 1911 edition reflects what British scholars covered in 1911).

**Implications:** Multi-source synthesis only kicks in on those 22%. The other 78% still get single-source (Wikipedia) Tier 2 narratives. Both paths are clearly labelled in the entity-page Sources footer.

---

## 2026-05-23 — Vercel Cron for nightly featured rotation

pg-boss is used for the in-pipeline job queue (local). For production scheduled tasks (Vercel serverless can't run a persistent worker), we use Vercel Cron Jobs.

**Wiring:** `vercel.json` declares `crons: [{ path: "/api/cron/refresh-featured", schedule: "0 3 * * *" }]`. Vercel hits the route at 03:00 UTC with `Authorization: Bearer ${CRON_SECRET}`. The route writes a row to `featured_cache`; `getFeaturedEntities` reads cache first, falls back to live compute if cache > 36h old.

**One footgun:** the CRON_SECRET must be set via env without trailing whitespace. The Vercel build fails the deploy if the env value contains leading/trailing whitespace (a leftover newline from a `node -e` invocation cost us one deploy attempt).

---

## 2026-05-23 — Tier 3 source-trim: 6K chars per source

The Tier 3 narrate prompt has a 5,500-token output budget. With two long sources (~12K + ~13K chars combined) Gemini Flash sometimes exhausts the output budget on internal reasoning and returns empty text (`finishReason: "length"`, `text.length: 0`). This is reliable: every entity with two long sources hits the wall.

**Fix:** trim each source to 6,000 chars before passing in. The first ~6K reliably covers the entity's chronology and most-cited facts; the model can synthesize the long-form prose from that without exhausting tokens.

---

## 2026-05-23 — Vercel Speed Insights + Analytics instead of self-hosted

Free on the Hobby plan, no cookies (no GDPR banner), beacon-only (no perf cost). The cheaper "build telemetry into the app" alternative would require either an analytics DB tier on Neon or a third-party SaaS — neither worth the operational overhead at our traffic level.

---

## 2026-05-23 — Production observability surfaces

- **Errors:** `app/error.tsx` for client-side; Vercel runtime logs for server-side. Structured pg error logger in `lib/db/retry.ts` unwraps DrizzleQueryError to surface the underlying SQLSTATE in Vercel's truncated log view.
- **Speed:** Vercel Speed Insights (Core Web Vitals).
- **Usage:** Vercel Analytics.
- **DB health:** `/api/health` endpoint queries `SELECT 1` + entity count + most-recent fact-check timestamp.
- **AI spend:** `pipeline_runs` table tracks every call; `pipeline/audit/coverage-report.ts` reads it.

---

## 2026-05-24 — Anti-Western-bias audit + targeted density push

The May 2026 coverage audit (`pipeline/audit/coverage-report.ts` against Neon) revealed Western-European civs sitting at 12–21 entries each while non-European civs (Bantu, Austronesian, Indus Valley, Mongol successors, Mughal, SE Asian, Southern Indian, Vedic/Mauryan) were at 7–9. Anti-Western-bias is the project's stated spine, so a corrective batch was warranted.

**Action:** `scripts/seed-batch-7.ts` — 66 titles, all non-European, targeted at the audit gaps. 55 returned valid QIDs; the chain produced 14 net-new Tier 2 entries (the remaining 41 had already been seeded earlier). The thinnest civs moved 7→9, 8→12, 9→11 across the matrix.

**Net delta on production:** 362 → 376 entities, with gap civilizations gaining 1–4 entries each. Indian-ocean-trade and Silk-Roads (already the two largest civs) widened their lead, both being explicit anti-Western-default trade networks.

---

## 2026-05-24 — Wikipedia XML matcher: unique-name lookup, not sitelinks (yet)

The bulk Wikipedia matcher (`pipeline/bulk/import-wikipedia-dump.ts`) needs to map Wikipedia article titles → Wikidata QIDs so each entity can have its source text attached. The natural join is `sitelinks.enwiki.title` on the Wikidata entity, but we didn't capture that column during the Wikidata bulk import (`pipeline/bulk/import-wikidata-dump.ts` stores name + aliases + dates + coords, no sitelinks).

The first pragmatic attempt — match by entity name + alias — produced systematic mis-tagging: Wikidata has many entities sharing the same English label (29 places called "Buenavista", 14 "Buenos Aires"es, 9 "Symphony No. 3"s, an "Alexander the Great" tagged type='work' that's separate from the real person Q8409). A first-wins resolution gave "Alexander the Great" Wikipedia article text to a work, not a person.

**Fix:** restrict the lookup map to entity names that are **unique** in the corpus (one entity per lowercased name); drop aliases entirely. This gives 225,385 lookups out of 233,500 entities (96.2% coverage) with vastly fewer false positives. Names of entities still mis-classified in our bulk DB (Albert Einstein as type='place') aren't fixed by this — that's an upstream extractor issue.

**Reconsider when:** the bulk Wikidata ingest is re-run with `sitelinks.enwiki.title` captured into the entities table. That would let the matcher use a clean 1:1 join and recover the ~3.8% recall lost here.

---

## 2026-05-24 — Wikipedia title resolution: sitelink fallback after diacritic-strip

The enrichment + fetch-media pipeline historically passed `entity.name` (the Wikidata English label) directly to Wikipedia's REST + Action APIs. That label is canonical for Wikidata, but it sometimes drifts from the Wikipedia article title: a typo in the label ("TutanKhamun"), a non-English label that survived extraction ("Olmecas" — Spanish), a label using a less-common transliteration ("Nzingha Mbande" vs. Wikipedia's "Nzinga of Ndongo and Matamba"), or a label that's been superseded ("Kingdom of Baluba" → "Luba Empire"). The diacritic-strip fallback added earlier handles "Sunjata Keïta" → "Sundiata Keita" cases but nothing structural.

**Fix:** `lib/wikipedia/index.ts:fetchSummary` and `fetchPlaintext` now accept an optional `{ qid }`. After the literal + diacritic-stripped lookups both miss, they hit `https://www.wikidata.org/wiki/Special:EntityData/{qid}.json` and retry with the `sitelinks.enwiki.title`. Per-session in-memory cache so a repair script doesn't double-fetch. Call sites updated: `summarize.ts`, `narrate.ts`, `fetch-media.ts`.

**Backfill:** `scripts/repair-wikipedia-titles.ts` — finds entities stuck at Tier 0 (no Wikipedia source) or without media, resolves their sitelinks, retries enrichment with the QID hint. `--rename` updates the entity name to the sitelink title when it differs and has no `" ("` (avoids disambiguators like "Tupaia (navigator)" leaking into display names).

**Run results (May 24):** Of 26 stuck candidates, 5 entities promoted from Tier 0 → Tier 1 (TutanKhamun, Olmecas, Fatimid Caliphate, Luba Empire, Nzinga of Ndongo and Matamba). 7 entities gained their first hero image. 13 slugs rebuilt to match the new canonical names. The remaining ~11 stuck entities either resolve to titles with parens that the REST endpoint dislikes (Tupaia (navigator), Imjin War — turned out to be unrelated), or have Wikipedia articles without a hero image (Hinduism, Jainism, Hephthalites).

**Open issue surfaced:** the `media_commons_url_unique` constraint means an image can attach to only one entity. Two pairs of historically-related entities (Kingdom of Lunda + Kingdom of Baluba, and Mahajanapada + a sibling Indus polity) share their lead Commons file. The second insert silently no-ops; the entity stays without media unless someone manually picks a different image.
