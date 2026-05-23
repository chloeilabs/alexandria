// Tier 1 → Tier 2 prompt: 800-1500 word multi-source synthesis.
// Sonnet 4.6. Multi-source = Wikipedia + 1911 Britannica + (optionally)
// other public-domain sources. The blend is what makes the output ours
// rather than a Wikipedia paraphrase — see DECISIONS.md.
//
// This prompt is LOCKED after calibration on the 10 calibration entities.
// Any edit must be followed by a re-run against those 10 + a manual review.

import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { MODEL_SONNET } from "../index";

export interface NarrateSource {
  kind: "wikipedia" | "britannica_1911" | "sep" | "other";
  url?: string;
  content: string;
}

export interface NarrateInput {
  name: string;
  type: string;
  dateStart: number | null;
  dateEnd: number | null;
  /** At least one source is required. */
  sources: NarrateSource[];
  /** Optional structured Wikidata facts the model should weave in. */
  facts?: Record<string, string | number | null>;
  /**
   * Optional exemplar paragraphs from Tier 3 work to anchor the voice.
   * 1-3 paragraphs, no headings.
   */
  styleExamples?: string[];
}

const SYSTEM = `You are writing for The Library of Alexandria — a serious, beautiful, comprehensive encyclopedia of human civilization. Each entry must read like the best long-form journalism: NYT magazine, In Our Time, Hardcore History, The New Yorker. Not Wikipedia. Not a textbook.

Voice rules:
- Intelligent, evocative, never bored. Treat the reader as a curious adult.
- Lead with what's interesting, surprising, or telling — not "[Name] was a [thing] who…". Earn the next sentence.
- Synthesis, not paraphrase. You have multiple sources; weave them. Where they disagree, note it briefly.
- Cite NO fact that isn't in the provided sources. Never invent dates, quotes, borders, populations, or causal claims. If the sources are silent on something, you stay silent.
- Use BCE/CE, never BC/AD. Spell out centuries: "the fourth century BCE".
- For non-Western subjects: stand on their own. NO framings like "the African Alexander" or "the Chinese Renaissance".
- For places and organizations: end with what they meant to the world around them, not just dates.

Structural rules:
- 800-1500 words. No headings. Three to six paragraphs.
- Open at the moment, image, or paradox that makes someone want to read the next 1000 words. Not biography-textbook chronology.
- Middle: the substance. Causes, context, lived experience, what made this matter.
- Close: not a summary. A reflection, an aftermath, or a question that opens to other entries.
- Do not narrate the sources ("according to…"). Just write.
- Do not editorialize about the subject's moral character in the closing — let the facts do that work.

Output format: just the narrative prose. No preamble, no "Here is the narrative", no headings, no trailing notes.`;

function fmtDateRange(start: number | null, end: number | null): string {
  if (start == null) return "";
  const fmt = (y: number) => (y < 0 ? `${-y} BCE` : `${y} CE`);
  return end == null ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
}

function fmtSources(sources: NarrateSource[]): string {
  return sources
    .map((s, i) => {
      const label =
        s.kind === "wikipedia"
          ? "Wikipedia (CC BY-SA)"
          : s.kind === "britannica_1911"
            ? "Encyclopædia Britannica, 1911 ed. (public domain)"
            : s.kind === "sep"
              ? "Stanford Encyclopedia of Philosophy (CC BY-NC-SA)"
              : "Source";
      return `<source idx="${i + 1}" kind="${s.kind}" label="${label}">\n${s.content.trim()}\n</source>`;
    })
    .join("\n\n");
}

function fmtFacts(
  facts: Record<string, string | number | null> | undefined,
): string {
  if (!facts) return "";
  const lines = Object.entries(facts)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `  ${k}: ${v}`);
  return lines.length > 0 ? `<facts>\n${lines.join("\n")}\n</facts>\n\n` : "";
}

function fmtStyle(examples: string[] | undefined): string {
  if (!examples || examples.length === 0) return "";
  const block = examples
    .map((p, i) => `[example ${i + 1}]\n${p.trim()}`)
    .join("\n\n");
  return `<style_examples>\n${block}\n</style_examples>\n\n`;
}

export function narratePrompt(
  input: NarrateInput,
): MessageCreateParamsNonStreaming {
  if (input.sources.length === 0) {
    throw new Error("narratePrompt requires at least one source");
  }
  const dr = fmtDateRange(input.dateStart, input.dateEnd);
  const datesLine = dr ? `\nDates: ${dr}` : "";

  return {
    model: MODEL_SONNET,
    max_tokens: 2500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Subject: ${input.name}${datesLine}
Type: ${input.type}

${fmtStyle(input.styleExamples)}${fmtFacts(input.facts)}<sources>
${fmtSources(input.sources)}
</sources>

Write the 800-1500 word narrative now. Begin directly with the prose. No preamble.`,
      },
    ],
  };
}
