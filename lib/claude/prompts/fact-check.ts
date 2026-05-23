// Post-narration validation pass. Cheap insurance against hallucinated
// dates, quotes, or causal claims.
//
// Sonnet (same as narrate, so they're comparably opinionated). Returns
// structured JSON via tool use, listing every claim NOT grounded in the
// sources. Empty list = passes; non-empty = routes the narrative to a
// `tier_2_review` queue instead of auto-publishing.

import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { MODEL_SONNET } from "../index";
import type { NarrateSource } from "./narrate";

export interface FactCheckInput {
  name: string;
  narrative: string;
  sources: NarrateSource[];
}

export interface FactCheckFinding {
  /** The verbatim sentence or phrase from the narrative. */
  claim: string;
  /** Why it's not grounded: missing | contradicts | uncertain. */
  reason: "missing" | "contradicts" | "uncertain";
  /** Optional pointer to the relevant passage in the sources. */
  source_excerpt?: string;
}

const SYSTEM = `You are the fact-check pass for The Library of Alexandria. You receive a narrative and the sources it was supposedly derived from. Your job: find every factual claim in the narrative that is NOT grounded in the sources, OR that the sources contradict.

Be precise. Be conservative. Only flag claims that are:
- "missing": the source does not contain this fact at all, AND it's a specific, falsifiable claim (date, number, quote, name, place, cause). General context that ANY informed person would know is fine.
- "contradicts": the source says something different from what the narrative claims.
- "uncertain": the source is ambiguous or partial; the narrative reads as more definite than the source warrants.

Do NOT flag:
- Stylistic phrasing or interpretation.
- Background context implied by the source.
- Reasonable paraphrases.

Return findings via the report_findings tool. If the narrative is fully grounded, return an empty findings array.`;

export function factCheckPrompt(
  input: FactCheckInput,
): MessageCreateParamsNonStreaming {
  const sourcesBlock = input.sources
    .map(
      (s, i) =>
        `<source idx="${i + 1}" kind="${s.kind}">\n${s.content.trim()}\n</source>`,
    )
    .join("\n\n");

  return {
    model: MODEL_SONNET,
    max_tokens: 1500,
    system: SYSTEM,
    tools: [
      {
        name: "report_findings",
        description:
          "Report every claim in the narrative that is not grounded in the provided sources. Empty array means the narrative passes fact-check.",
        input_schema: {
          type: "object" as const,
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  claim: {
                    type: "string",
                    description:
                      "The verbatim sentence or phrase from the narrative.",
                  },
                  reason: {
                    type: "string",
                    enum: ["missing", "contradicts", "uncertain"],
                  },
                  source_excerpt: {
                    type: "string",
                    description:
                      "Optional pointer to the relevant passage in the sources.",
                  },
                },
                required: ["claim", "reason"],
              },
            },
          },
          required: ["findings"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_findings" },
    messages: [
      {
        role: "user",
        content: `Subject: ${input.name}

<narrative>
${input.narrative}
</narrative>

<sources>
${sourcesBlock}
</sources>

Call report_findings with every unsupported claim. Empty findings array = clean pass.`,
      },
    ],
  };
}
