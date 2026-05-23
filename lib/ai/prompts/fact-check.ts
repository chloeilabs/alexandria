// Post-narration validation pass. Uses ai-sdk's `Output.object` to coerce
// the model into a typed schema (no manual JSON parsing, no tool-use
// dance). The model returns { findings: [...] } via the gateway.

import { Output } from "ai";
import { z } from "zod";

import { MODEL_FLASH } from "../index";
import type { NarrateSource } from "./narrate";

export const FactCheckFindingsSchema = z.object({
  findings: z.array(
    z.object({
      claim: z
        .string()
        .describe("The verbatim sentence or phrase from the narrative."),
      reason: z
        .enum(["missing", "contradicts", "uncertain"])
        .describe(
          "missing = source silent; contradicts = source disagrees; uncertain = source ambiguous",
        ),
      source_excerpt: z
        .string()
        .optional()
        .describe("Optional pointer to the relevant passage in the sources."),
    }),
  ),
});

export type FactCheckOutput = z.infer<typeof FactCheckFindingsSchema>;

export interface FactCheckInput {
  name: string;
  narrative: string;
  sources: NarrateSource[];
}

const SYSTEM = `You are the fact-check pass for Alexandria. You receive a narrative and the sources it was supposedly derived from. Your job: find every factual claim in the narrative that is NOT grounded in the sources, OR that the sources contradict.

Be precise. Be conservative. Only flag claims that are:
- "missing": the source does not contain this fact at all, AND it's a specific, falsifiable claim (date, number, quote, name, place, cause). General context that ANY informed person would know is fine.
- "contradicts": the source says something different from what the narrative claims.
- "uncertain": the source is ambiguous or partial; the narrative reads as more definite than the source warrants.

Do NOT flag:
- Stylistic phrasing or interpretation.
- Background context implied by the source.
- Reasonable paraphrases.

If the narrative is fully grounded, return an empty findings array.`;

export function factCheckPrompt(input: FactCheckInput) {
  const sourcesBlock = input.sources
    .map(
      (s, i) =>
        `<source idx="${i + 1}" kind="${s.kind}">\n${s.content.trim()}\n</source>`,
    )
    .join("\n\n");

  return {
    model: MODEL_FLASH,
    maxOutputTokens: 1500,
    // Disable thinking — structured output is more deterministic without it.
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    system: SYSTEM,
    prompt: `Subject: ${input.name}

<narrative>
${input.narrative}
</narrative>

<sources>
${sourcesBlock}
</sources>

Return every unsupported claim. Empty findings array = clean pass.`,
    output: Output.object({ schema: FactCheckFindingsSchema }),
  };
}
