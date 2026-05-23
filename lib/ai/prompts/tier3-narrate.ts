// Tier 3 narrate prompt — more ambitious than Tier 2.
//
// Differences from narrate.ts (the Tier 1→2 path):
//   - 2,500-3,500 word target (vs 800-1,500)
//   - Permission to develop a single scene at length where one matters
//   - Permission to bring in named scholarly debate when the sources show it
//   - Same hard rules on source-grounding — no invented facts/quotes/dates
//   - System prompt emphasises the editorial voice and long-form structure

import { MODEL_FLASH } from "../index";
import type { NarrateSource } from "./narrate";

export interface Tier3Input {
  name: string;
  type: string;
  dateStart: number | null;
  dateEnd: number | null;
  sources: NarrateSource[];
  /** Optional editorial focus — "ground this in the gold-and-salt trade"
   *  etc. — passed through to the prompt to bias what gets developed. */
  editorialFocus?: string;
}

const SYSTEM = `You are writing the Tier 3 entry for Alexandria — the long-form, no-algorithmic-limits version reserved for the most important subjects.

Voice rules (carried from Tier 2):
- Intelligent, evocative, never bored. Treat the reader as a curious adult.
- Lead with what's interesting, surprising, or telling — not biography-textbook chronology.
- Synthesis across multiple sources. Where sources disagree, develop the disagreement briefly rather than ignoring it.
- Cite NO fact that isn't in the provided sources. NEVER invent dates, quotes, populations, borders, causal claims, or scholarly attributions. If the sources are silent, you stay silent.
- BCE/CE, never BC/AD. Spell out centuries: "the fourth century BCE".
- For non-Western subjects: stand on their own. NO framings like "the African Alexander", "the Chinese Renaissance".

Tier 3 amplifications:
- 2,500–3,500 words. Five to eight paragraphs. No headings, no section breaks — one continuous piece of long-form prose.
- Permission to develop ONE scene at length, when the sources support it. The reader is here for the texture and the atmosphere, not just the facts.
- Permission to surface named scholarly debate when the sources mention it — historians disagreeing, evidence being partial, conventional dating shifting.
- Open with a moment, a paradox, or an image so vivid the reader can't look away.
- Close on a question that opens to other entries — what came after, what we still don't know, what changed because of this.

Output format: just the prose. No preamble, no headings, no trailing notes.`;

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

export function tier3NarratePrompt(input: Tier3Input) {
  if (input.sources.length === 0) {
    throw new Error("tier3NarratePrompt requires at least one source");
  }
  const dr = fmtDateRange(input.dateStart, input.dateEnd);
  const datesLine = dr ? `\nDates: ${dr}` : "";
  const focusLine = input.editorialFocus
    ? `\nEditorial focus: ${input.editorialFocus}`
    : "";

  return {
    model: MODEL_FLASH,
    // Tier 3 gets a meaningfully larger output budget.
    maxOutputTokens: 5500,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    system: SYSTEM,
    prompt: `Subject: ${input.name}${datesLine}
Type: ${input.type}${focusLine}

<sources>
${fmtSources(input.sources)}
</sources>

Write the 2,500–3,500 word Tier 3 narrative now. Begin directly with the prose — no preamble.`,
  };
}
