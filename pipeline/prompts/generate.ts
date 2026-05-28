// Prompt + zod schema for primary entity generation.
//
// We ask the model for the full record in one structured call. The
// `citations` field is asked-for but flagged as LLM-claimed everywhere
// it surfaces; we never represent these as verified sources.

import { z } from "zod";
import { ENTITY_TYPES } from "@/lib/db/schema";

export const generateSchema = z.object({
  canonicalName: z
    .string()
    .min(1)
    .describe("The most common English-language name for this entity."),
  disambiguator: z
    .string()
    .nullable()
    .describe(
      "Short clarifier if the name is ambiguous, e.g. 'the chemist', 'the city in Egypt'. Null when not needed.",
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .describe("URL-safe lowercase hyphenated slug."),
  entityType: z.enum(ENTITY_TYPES),
  shortDescription: z
    .string()
    .min(20)
    .max(220)
    .describe("One sentence, suitable for search-result rows."),
  summary: z
    .string()
    .min(400)
    .max(1500)
    .describe("100–200 words. Encyclopedia lead style. Plain prose."),
  narrative: z
    .string()
    .min(2500)
    .describe(
      "800–2000 words. Multi-paragraph prose covering origin, significance, key episodes, and reception. No bullet lists.",
    ),
  structuredFacts: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe(
      "Flat key/value facts. Keys like birth_date, death_date, location, founded, profession, etc. Use ISO dates as strings.",
    ),
  keyDates: z
    .array(
      z.object({
        year: z.number().int(),
        precision: z.enum(["year", "decade", "century"]).default("year"),
        label: z.string(),
        kind: z.string().describe("e.g. birth, death, founded, battle"),
      }),
    )
    .max(15),
  coords: z
    .object({ lat: z.number(), lng: z.number() })
    .nullable()
    .describe("Lat/lng for place-typed entities only; null otherwise."),
  aliases: z
    .array(z.string())
    .max(20)
    .describe("Alternate names, translations, common misspellings."),
  topics: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(3)
    .max(7)
    .describe(
      "3–7 lowercase hyphenated tags (e.g. 'french-revolution', 'organic-chemistry').",
    ),
  relationships: z
    .array(
      z.object({
        targetName: z.string(),
        predicate: z
          .string()
          .describe(
            "Relationship label as a snake_case verb phrase: parent_of, located_in, influenced_by, part_of, member_of, succeeded_by, …",
          ),
      }),
    )
    .max(20)
    .describe(
      "Outbound relationships to other entities. Will only be persisted if the target already exists in the corpus.",
    ),
  citations: z
    .array(
      z.object({
        claim: z.string().describe("The factual claim being cited."),
        source: z
          .string()
          .describe(
            "Source name as the model recalls it. May be approximate.",
          ),
        url: z.string().nullable(),
        author: z.string().nullable(),
        kind: z.enum(["book", "journal", "web", "other"]).default("other"),
      }),
    )
    .max(20)
    .describe(
      "Claims with sources the model recalls from training. NOT externally verified.",
    ),
});

export type GenerateOutput = z.infer<typeof generateSchema>;

export function buildGeneratePrompt(seed: {
  name: string;
  hint: string | null;
  entityTypeGuess: string | null;
}): string {
  const guess = seed.entityTypeGuess
    ? `\nLikely type: ${seed.entityTypeGuess}.`
    : "";
  const hint = seed.hint ? `\nContext: ${seed.hint}` : "";
  return `Write an encyclopedia entry for: ${seed.name}.${guess}${hint}

Constraints:
- Tone: neutral, factual, encyclopedia-style. Past tense for historical subjects.
- The narrative should be a coherent multi-paragraph prose article, not a bullet list. Cover origins, significance, key moments/works, reception, and (if applicable) legacy.
- structuredFacts should be flat: prefer ISO dates as strings; keep keys snake_case.
- For citations, name books, journals, or well-known online sources you recall from training. Do not invent — if you are unsure, omit. These will be labeled "LLM-claimed; not externally verified" downstream, so accuracy and humility about uncertainty matter.
- If the name is ambiguous (e.g. multiple historical figures share it), pick the most prominent referent and set disambiguator accordingly.`;
}

export const generateSystem = `You are an encyclopedia editor producing a single entry. You write balanced, well-sourced prose grounded in your training knowledge, but you NEVER fabricate citations or specific quotes you can't recall. When uncertain, you omit the claim rather than invent one.`;
