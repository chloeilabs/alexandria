// Tool definitions shared between the HTTP route handler (via
// `mcp-handler`) and the stdio bin (`bin/alexandria-mcp.ts`).
//
// Tool descriptions are the actual product surface for AI consumers:
// the calling agent picks tools based on these. Iterate on them after
// observing real usage.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ENTITY_TYPES } from "@/lib/db/schema";
import {
  entitiesByIds,
  getCitations,
  getEntityFull,
  getRelated,
  listByDateRange,
  listByTopic,
  listByType,
} from "@/lib/db/queries/entity";
import { hybridSearch } from "@/lib/db/queries/search";
import { CITATION_CAVEAT, PROVENANCE_CAVEAT } from "./citation-wrap";

// mcp-handler passes a slightly different shape than @modelcontextprotocol/sdk's
// McpServer type, but both expose registerTool with the same call shape. We
// accept either via a structural type.
type RegisterToolFn = McpServer["registerTool"];
type RegisterTool = { registerTool: RegisterToolFn };

const textContent = (obj: unknown): { content: Array<{ type: "text"; text: string }> } => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
});

export function registerAlexandriaTools(server: RegisterTool): void {
  server.registerTool(
    "search_entities",
    {
      title: "Search Entities",
      description:
        "Hybrid full-text + vector search across the Alexandria knowledge base. Returns ranked entity stubs (id, slug, name, type, short description, consensus score). Use this first to find candidate entities, then call get_entity for full content. Entries are AI-distilled; consensus_score below 0.7 indicates lower confidence.",
      inputSchema: {
        query: z.string().describe("Natural-language search query."),
        entity_type: z
          .enum(ENTITY_TYPES)
          .optional()
          .describe("Restrict results to this entity type."),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({
      query,
      entity_type,
      limit,
    }: {
      query: string;
      entity_type?: (typeof ENTITY_TYPES)[number];
      limit: number;
    }) => {
      const results = await hybridSearch({ query, entityType: entity_type, limit });
      return textContent({
        caveat: PROVENANCE_CAVEAT,
        results: results.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.canonicalName,
          type: r.entityType,
          short_description: r.shortDescription,
          consensus_score: r.consensusScore,
        })),
      });
    },
  );

  server.registerTool(
    "get_entity",
    {
      title: "Get Entity",
      description:
        "Fetch one entity by slug or id. `depth: 'light'` returns name + short_description + summary + topics. `depth: 'full'` adds narrative + structured_facts + key_dates + aliases. Includes consensus_score and generator/verifier model. Use after search_entities to retrieve full content.",
      inputSchema: {
        slug_or_id: z.string(),
        depth: z.enum(["light", "full"]).default("light"),
      },
    },
    async ({ slug_or_id, depth }: { slug_or_id: string; depth: "light" | "full" }) => {
      const entity = await getEntityFull(slug_or_id);
      if (!entity) return textContent({ error: "not_found", slug_or_id });
      const base = {
        id: entity.id,
        slug: entity.slug,
        name: entity.canonicalName,
        disambiguator: entity.disambiguator,
        type: entity.entityType,
        short_description: entity.shortDescription,
        summary: entity.summary,
        topics: entity.topics,
        consensus_score: entity.consensusScore,
        generator_model: entity.generatorModel,
        verifier_model: entity.verifierModel,
        caveat: PROVENANCE_CAVEAT,
      };
      if (depth === "light") return textContent(base);
      return textContent({
        ...base,
        narrative: entity.narrative,
        structured_facts: entity.structuredFacts,
        key_dates: entity.keyDates,
        coords: entity.coords,
        aliases: entity.aliases,
      });
    },
  );

  server.registerTool(
    "get_related",
    {
      title: "Get Related Entities",
      description:
        "Outbound relationships from an entity (parent_of, located_in, influenced_by, etc.). Optionally filter by predicate. Returns target entity stubs grouped by predicate.",
      inputSchema: {
        entity_id: z.string(),
        predicate: z.string().optional(),
      },
    },
    async ({ entity_id, predicate }: { entity_id: string; predicate?: string }) => {
      const rows = await getRelated({ entityId: entity_id, predicate });
      return textContent({
        caveat: PROVENANCE_CAVEAT,
        related: rows.map((r) => ({
          predicate: r.predicate,
          target: {
            id: r.entity.id,
            slug: r.entity.slug,
            name: r.entity.canonicalName,
            type: r.entity.entityType,
            short_description: r.entity.shortDescription,
            consensus_score: r.entity.consensusScore,
          },
        })),
      });
    },
  );

  server.registerTool(
    "list_by_type",
    {
      title: "List Entities by Type",
      description:
        "Paginated alphabetical list of all entities of one type (person, place, event, concept, work, organization, species, artifact).",
      inputSchema: {
        entity_type: z.enum(ENTITY_TYPES),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({
      entity_type,
      limit,
      offset,
    }: {
      entity_type: (typeof ENTITY_TYPES)[number];
      limit: number;
      offset: number;
    }) => {
      const rows = await listByType({ entityType: entity_type, limit, offset });
      return textContent({ caveat: PROVENANCE_CAVEAT, results: rows });
    },
  );

  server.registerTool(
    "list_by_topic",
    {
      title: "List Entities by Topic",
      description:
        "All published entities sharing a topic tag (lowercase hyphenated, e.g. 'french-revolution'). Use this to browse clusters once you know a topic name.",
      inputSchema: {
        topic: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ topic, limit, offset }: { topic: string; limit: number; offset: number }) => {
      const rows = await listByTopic({ topic, limit, offset });
      return textContent({ caveat: PROVENANCE_CAVEAT, results: rows });
    },
  );

  server.registerTool(
    "list_by_date_range",
    {
      title: "List Entities by Date Range",
      description:
        "Find entities whose key_dates fall within a year range. Useful for 'what was happening in the 1860s?' or 'people active in the 14th century'.",
      inputSchema: {
        year_start: z.number().int(),
        year_end: z.number().int(),
        entity_type: z.enum(ENTITY_TYPES).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({
      year_start,
      year_end,
      entity_type,
      limit,
    }: {
      year_start: number;
      year_end: number;
      entity_type?: (typeof ENTITY_TYPES)[number];
      limit: number;
    }) => {
      const rows = await listByDateRange({
        yearStart: year_start,
        yearEnd: year_end,
        entityType: entity_type,
        limit,
      });
      return textContent({ caveat: PROVENANCE_CAVEAT, results: rows });
    },
  );

  server.registerTool(
    "get_citations",
    {
      title: "Get Claimed Citations",
      description:
        "Return claimed citations for an entity. These are LLM-claimed at generation time and NOT externally verified — every response includes the caveat string inline.",
      inputSchema: {
        entity_id: z.string(),
      },
    },
    async ({ entity_id }: { entity_id: string }) => {
      const rows = await getCitations(entity_id);
      return textContent({
        caveat: CITATION_CAVEAT,
        claimed_citations: rows.map((r) => ({
          claim: r.claimExcerpt,
          claimed_source: r.claimedSource,
          claimed_url: r.claimedUrl,
          claimed_author: r.claimedAuthor,
          kind: r.claimKind,
          verified_by_second_model: r.verifiedBySecondModel,
        })),
      });
    },
  );

  void entitiesByIds; // exported for use by callers outside the MCP path
}
