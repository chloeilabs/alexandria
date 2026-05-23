// Classifier prompt: assigns 0-3 civilizational tags to an entity.
// Uses Output.object so the model returns a typed, validated response.

import { Output } from "ai";
import { z } from "zod";

import { MODEL_FLASH } from "../index";
import {
  CIVILIZATIONAL_TAGS,
  TAG_DESCRIPTIONS,
} from "../../regions/civilizational-taxonomy";

const TagsSchema = z.object({
  tags: z
    .array(z.enum(CIVILIZATIONAL_TAGS))
    .max(3)
    .describe(
      "0-3 civilizational tags from the closed list. Pick none if no tag clearly applies.",
    ),
  rationale: z
    .string()
    .max(280)
    .describe("One sentence justifying the choice."),
});

export type ClassifyCivilizationOutput = z.infer<typeof TagsSchema>;

export interface ClassifyCivilizationInput {
  name: string;
  type: string;
  dateStart: number | null;
  dateEnd: number | null;
  latitude: number | null;
  longitude: number | null;
  countryQid: string | null; // P17 country, if known
  aliases: string[]; // a few aliases help disambiguate non-English names
}

const SYSTEM = `You assign civilizational tags to entities in Alexandria. The tag list is global and intentionally lean toward non-Western buckets — do NOT over-assign Western tags to non-Western subjects, and prefer the most specific bucket. If nothing in the closed list fits clearly, return an empty array. Use at most 3 tags, typically 1-2.`;

function fmtDateRange(start: number | null, end: number | null): string {
  if (start == null) return "(no dates)";
  const fmt = (y: number) => (y < 0 ? `${-y} BCE` : `${y} CE`);
  return end == null ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
}

function fmtTagList(): string {
  return CIVILIZATIONAL_TAGS.map((t) => `- ${t}: ${TAG_DESCRIPTIONS[t]}`).join(
    "\n",
  );
}

export function classifyCivilizationPrompt(input: ClassifyCivilizationInput) {
  const coordsLine =
    input.latitude != null && input.longitude != null
      ? `\nCoordinates: ${input.latitude.toFixed(2)}, ${input.longitude.toFixed(2)}`
      : "";
  const countryLine = input.countryQid
    ? `\nWikidata country (P17): ${input.countryQid}`
    : "";
  const aliasLine =
    input.aliases.length > 0
      ? `\nAliases: ${input.aliases.slice(0, 5).join(", ")}`
      : "";

  return {
    model: MODEL_FLASH,
    maxOutputTokens: 400,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    system: SYSTEM,
    output: Output.object({ schema: TagsSchema }),
    prompt: `Entity: ${input.name}
Type: ${input.type}
Dates: ${fmtDateRange(input.dateStart, input.dateEnd)}${coordsLine}${countryLine}${aliasLine}

Closed tag list (slug: description):
${fmtTagList()}

Assign 0-3 tags from the list above. Be specific and conservative.`,
  };
}
