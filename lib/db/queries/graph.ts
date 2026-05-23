// Data fetch for the connection graph.
//
// Edges have two flavors:
//  - "civ" (soft): two entities share at least one civilizational tag.
//    Edge weight = number of shared tags. Forms organic clusters by
//    civilization and is dense even with a small seed corpus.
//  - "rel" (hard): explicit Wikidata relationship where the target QID
//    is also in our DB. These are sparse until the bulk dump runs.
//
// Both feed into the same react-force-graph-2d component, with hard edges
// rendered stronger (thicker, more opaque, higher force).

import { sql } from "drizzle-orm";
import { db } from "../index";
import { withRetry } from "../retry";

export interface GraphNode {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  primaryTag: string | null;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  kind: "civ" | "rel";
  predicate?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

type RawNode = {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  date_start: number | null;
  civ_tags: string[];
} & Record<string, unknown>;

type RawLink = {
  source: string;
  target: string;
  weight: number;
  kind: "civ" | "rel";
  predicate: string | null;
} & Record<string, unknown>;

export async function getGraphData(): Promise<GraphData> {
  return withRetry("getGraphData", getGraphDataInner);
}

async function getGraphDataInner(): Promise<GraphData> {
  const nodeRows = await db.execute<RawNode>(sql`
    SELECT
      e.qid,
      e.slug,
      e.name,
      e.type,
      e.tier,
      e.date_start,
      COALESCE(
        ARRAY_AGG(er.region_value) FILTER (WHERE er.region_kind = 'civilizational'),
        ARRAY[]::varchar[]
      ) AS civ_tags
    FROM entities e
    LEFT JOIN entity_regions er ON er.entity_qid = e.qid
    GROUP BY e.qid
    ORDER BY e.tier DESC, e.name ASC
  `);

  const nodes: GraphNode[] = Array.from(nodeRows).map((r) => ({
    qid: r.qid,
    slug: r.slug,
    name: r.name,
    type: r.type,
    tier: r.tier,
    dateStart: r.date_start,
    primaryTag: r.civ_tags?.[0] ?? null,
  }));

  // Shared-civ-tag edges. Self-join entity_regions; weight = count of shared.
  const civLinks = await db.execute<RawLink>(sql`
    SELECT
      a.entity_qid AS source,
      b.entity_qid AS target,
      COUNT(*)::int AS weight,
      'civ'::text AS kind,
      NULL::text AS predicate
    FROM entity_regions a
    JOIN entity_regions b
      ON a.region_kind = 'civilizational'
     AND b.region_kind = 'civilizational'
     AND a.region_value = b.region_value
     AND a.entity_qid < b.entity_qid
    GROUP BY a.entity_qid, b.entity_qid
  `);

  // Explicit relationship edges where the target is in our DB. We skip a
  // few high-noise predicates (P31 instance-of, P39 held-position) that
  // mostly target classes.
  const relLinks = await db.execute<RawLink>(sql`
    SELECT
      r.source_qid AS source,
      r.target_qid AS target,
      1 AS weight,
      'rel'::text AS kind,
      r.predicate AS predicate
    FROM relationships r
    INNER JOIN entities e_target ON e_target.qid = r.target_qid
    WHERE r.predicate NOT IN ('P31', 'P279', 'P39', 'P106')
  `);

  const links: GraphLink[] = [
    ...Array.from(civLinks).map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
      kind: l.kind,
    })),
    ...Array.from(relLinks).map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
      kind: l.kind,
      predicate: l.predicate ?? undefined,
    })),
  ];

  return { nodes, links };
}
