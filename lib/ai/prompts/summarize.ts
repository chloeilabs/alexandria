// Tier 0 → Tier 1 prompt: 150-300 word summary in our voice.
// Returns args ready to pass directly to ai-sdk `generateText`.

import { MODEL_FLASH } from "../index";

export interface SummarizeInput {
  name: string;
  type: string;
  dateStart: number | null;
  dateEnd: number | null;
  wikipediaIntro: string;
}

const SYSTEM = `You are writing for Alexandria — a serious, beautifully written encyclopedia of human civilization.

Voice: intelligent, evocative, never bored. Read like the best long-form journalism (NYT, The New Yorker, In Our Time, Hardcore History) — NOT like Wikipedia. Treat the reader as a curious adult.

Constraints:
- 150-300 words. No headings. One or two paragraphs.
- Cite ONLY facts present in the provided source. NEVER invent dates, quotes, places, or borders. If the source is silent on something, you stay silent.
- Do NOT open with "[Name] was a [thing] who..." or "[Name] is best known for...". Lead with what's most interesting, surprising, or telling about this subject — the thing that makes someone want to read the next sentence.
- Do NOT narrate the source ("according to Wikipedia", "sources say"). Just write.
- Use full names on first mention; surnames after. Use BCE/CE, never BC/AD.
- For non-Western subjects, do NOT frame in Western terms ("the African Alexander", "the Chinese Renaissance"). Let them stand on their own.
- For places and organizations, end with a sense of what they meant to the world they were part of, not just facts.
- No quotation marks around the subject's name. No bold. No italics for emphasis.`;

function formatDateRange(start: number | null, end: number | null): string {
  if (start == null) return "";
  const fmt = (y: number) => (y < 0 ? `${-y} BCE` : `${y} CE`);
  return end == null ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
}

export function summarizePrompt(input: SummarizeInput) {
  const dr = formatDateRange(input.dateStart, input.dateEnd);
  const datesLine = dr ? `\nDates: ${dr}` : "";
  return {
    model: MODEL_FLASH,
    maxOutputTokens: 600,
    // Disable Gemini's "thinking" reasoning — for stub-to-summary we want
    // the model to write directly, not deliberate (and burn output tokens).
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    system: SYSTEM,
    prompt: `Subject: ${input.name}${datesLine}
Type: ${input.type}

Wikipedia lead section (CC BY-SA, treat as factual source — paraphrase, do not quote):
<source>
${input.wikipediaIntro}
</source>

Write the 150-300 word summary now. Begin directly with the prose — no preamble, no "Here is the summary", nothing.`,
  };
}
