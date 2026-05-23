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

## 2026-05-22 — Region taxonomy: hybrid (UN subregions + ~40 civilizational tags)

Each entity carries two region tags: an algorithmic UN subregion (from P17 country or coordinates) AND zero-or-more curated civilizational tags.

**Reasoning:** Modern regions alone fail for cross-border civilizations (Mongol Khanate, Islamic Caliphates, Roman Empire). Civilizational alone is hard to populate algorithmically. The hybrid lets the ranker filter on either dimension and lets the homepage rotation algorithm enforce "no region appears more than 2×" using whichever dimension makes sense.

The civilizational tag list itself is an editorial artifact — see `OPEN_QUESTIONS.md` for the draft taxonomy that needs review before bulk tagging.

---

## 2026-05-22 — Tier 2 source: multi-source synthesis (Wikipedia + 1911 Britannica + extras)

A Claude-rewritten Wikipedia article — even in our voice — is still a derivative work; CC BY-SA requires attribution and share-alike. Single-source rewrites also tend to inherit Wikipedia's structure even when the prose changes.

**Reasoning:** Multi-source synthesis (Wikipedia + 1911 Encyclopædia Britannica from Project Gutenberg/Wikisource + Stanford Encyclopedia of Philosophy where applicable + other PD sources) produces genuinely synthesized prose. Costs ~2-3× input tokens but the output is meaningfully ours, not a Wikipedia paraphrase. Each Tier 2 narrative carries a source attribution footer listing all sources used.

---

## 2026-05-22 — Node 24 LTS instead of Node 22 LTS

The brief said Node 22 LTS. We installed Node 24 because it's the current active LTS as of May 2026 (Node 24 went LTS October 2025; Node 22 entered maintenance October 2025). All dependencies work on both.

**Reconsider if:** a specific dependency breaks on Node 24 (none observed so far).

---

## 2026-05-22 — Coordinates: float8 lat/lon columns, no PostGIS

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
- GitHub remote / CI / PR workflows (local-only forever)
