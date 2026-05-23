# Day-One Acceptance Criteria — Verification

Snapshot as of 2026-05-22. See `DECISIONS.md` for context and
`OPEN_QUESTIONS.md` for outstanding editorial items.

## Corpus

```
34 entities seeded (24 person, 3 place, 7 event)
33 of 34 at Tier 1 (Sunjata Keïta is stuck at Tier 0 — Wikipedia REST
  doesn't resolve "Sunjata Keïta" to the "Sundiata Keita" article)
34 of 34 with civilizational tags
Span: 1507 BCE (Hatshepsut) → 1591 CE (Songhai's Battle of Tondibi)
Total AI spend so far: $0.268 (Flash @ ~$0.005 per Tier 1 + $0.003 per tag)
```

## Acceptance Criteria

### 1. `pnpm dev` and `pnpm pipeline` in two terminals; both run; site renders

**PASS.** Dev server compiles 7 routes (/, /entity/[slug], /timeline, /graph,
/search, /api/search, /_not-found). The pg-boss pipeline registers the
`tier1.summarize` worker and runs a 60s scheduler that enqueues every Tier 0
entity for upgrade. Verified live on port 3001 (3000 was already in use).

### 2. Homepage shows featured entities from ≥ 6 world regions and ≥ 4 eras; no region appears more than twice

**PARTIAL.** The corpus has the spread: 15+ active civilizational tags across
~5 broad eras. Homepage currently lists entities alphabetically by tier+name,
not via a rotation algorithm. Adding a rotation pass is small (~30 LOC) and
straightforward now that `entity_regions` is populated — see follow-up #1.

### 3. From the homepage I reach Mansa Musa, Wu Zetian, Tupac Amaru II, and Hatshepsut in ≤ 2 clicks each

**PASS.** All four appear in the homepage's `Available entries` list — one
click each. Hannibal too. (Implementation note: this passes by listing all
entities; the rotation algorithm in #2 would shorten the visible list but the
search bar would still keep them ≤ 2 clicks.)

### 4. From Hannibal I navigate Carthage → Punic Wars → Roman Republic → Mediterranean in 218 BCE, each transition < 400ms

**BLOCKED on data.** Carthage, Punic Wars, Roman Republic, and a
"Mediterranean in 218 BCE" entity aren't seeded yet. Hannibal's entity page
loads, and his explicit Wikidata relationships do include target QIDs for
Carthage (Q6343) and Roman Republic (Q11220) — they render as "orphan"
connections (count visible, not clickable). After the bulk Wikidata dump runs
or after a targeted seed pass on the most-referenced QIDs, this navigation
chain becomes possible. Per-page latency in dev was < 200ms for all probed
pages.

### 5. Searching "fall of an empire" returns Rome, Han Dynasty collapse, Bronze Age Collapse, Maya classical collapse, Songhai's defeat at Tondibi — properly ranked

**PARTIAL.** Songhai Empire and Battle of Tondibi both surface for "fall of
an empire" and "collapse" respectively. Han Dynasty collapse, Bronze Age
Collapse, Maya classical collapse aren't seeded as standalone entries. The
underlying search (FTS over name + summary, ts_rank weighted by tier)
behaves correctly on the entities that exist — adding more entries fills
this in automatically.

### 6. Timeline shows visual rhythm across all eras and regions, not just a Western spine

**PASS.** Tracks are ordered by earliest entity per civilizational tag, which
in our corpus puts ancient-egypt and vedic-and-mauryan above
classical-greece, and roman-republic-and-empire well below
mesoamerican-civilizations and andean-civilizations. The Canvas-based
renderer + D3 zoom feels considered (no bounce, slow zoom).

### 7. Every Tier 2 entity reads like a human who knows the topic wrote it

**N/A YET.** No Tier 2 narratives have been generated — the `narrate` prompt
is built and locked but the `narrate` worker isn't wired into the pipeline.
The Tier 1 prose (live now) reads strong: it opens with hooks not
"[Name] was a [Y]…" patterns, uses BCE/CE, doesn't fall into Western framings
("the African Alexander", etc.). Sample openings:

- _"When the ninth ruler of the Mali Empire embarked on his pilgrimage to Mecca in 1324 CE…"_ — Mansa Musa
- _"The boy who would nearly dismantle the Roman Republic began his mission with a childhood oath…"_ — Hannibal
- _"When the young pharaoh Thutmose II died, the Egyptian crown passed to a toddler…"_ — Hatshepsut

### 8. Pipeline ingests at least 1,000 new entities per hour (post-seed) on my laptop

**NOT MEASURED AT SCALE.** Observed throughput:
- Wikidata streaming parser: ~130 entities/sec on the 7-entity synthetic
  dump = ~470,000/hour ceiling, network/disk-bound at scale
- Tier 1 enrichment (Wikipedia REST + Flash): ~6-10s per entity sequential
  = ~400-600/hour without parallelism. With 4 concurrent workers it would
  comfortably exceed 1,000/hour
- Civ tagging: ~3 calls/sec = ~10,000/hour

### 9. Lighthouse performance ≥ 90

**NOT MEASURED.** Production build emits 6 routes with no large bundles
flagged. Tailwind v4 + Next.js 16 with the App Router should hit 90+ out of
the box; no client-side JS on /, /entity/[slug], or /search (server
components). /timeline and /graph are heavier (Canvas + force-graph) but
load lazily.

### 10. Page-to-page navigation < 2s on 4G simulation

**NOT MEASURED.** Server-rendered pages with `next/link` prefetching should
clear the bar; no client-side data fetching on entity pages. Probed pages in
dev returned in 18–60ms locally.

## Follow-ups (in priority order)

1. **Homepage region rotation** (~30 LOC). Group entities by primary
   civilizational tag, round-robin pick up to N, cap at 2 per region.
   Addresses criterion #2.
2. **Seed targeted entities** for the Hannibal → Carthage → Punic Wars chain
   (criterion #4). Reuse `seed-curated.ts` with a list of the QIDs
   referenced by Hannibal/Caesar/etc that aren't yet in the DB.
3. **Tier 2 narrate worker** (criterion #7). The prompt is built; wire it
   into pg-boss as `tier2.narrate` and run on the 10 calibration entities
   to lock the voice before scaling.
4. **Sunjata Keïta Wikipedia resolution** — current Wikipedia REST title
   match is exact; add a fallback that tries name with diacritics stripped.
5. **Lighthouse + 4G probe** (criteria #9, #10). One-time measurement run
   to confirm or flag bundle issues.
6. **Bulk Wikidata dump ingestion**. Download `latest-all.json.bz2`,
   run `pnpm pipeline:wikidata`. The parser is built and tested on a
   synthetic sample; this just needs the dump file and a long wall-clock
   window.
