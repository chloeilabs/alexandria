// Prompt + zod schema for the second-pass consensus verifier.
//
// We send the generated record to a fresh-context call with the same
// model and ask it to flag claims it disagrees with. Same-model
// verification has known limits (correlated hallucinations), so the
// output is graded by severity and used to score consensus, not to
// gate publish on agreement alone.

import { z } from "zod";

export const verifySchema = z.object({
  verdict: z.enum(["agree", "disagree", "uncertain"]),
  disagreements: z
    .array(
      z.object({
        claim: z.string().describe("The specific claim being challenged."),
        why: z.string().describe("Why it seems wrong or suspect."),
        suggestedFix: z.string().nullable(),
        severity: z.enum(["low", "medium", "high"]).default("medium"),
      }),
    )
    .max(15),
  notes: z
    .string()
    .nullable()
    .describe("Free-form additional observations, if any."),
});

export type VerifyOutput = z.infer<typeof verifySchema>;

export function buildVerifyPrompt(entry: unknown): string {
  return `Review this encyclopedia entry for factual problems. Identify any claims that are wrong, anachronistic, or unsupported.

Entry to review:
${JSON.stringify(entry, null, 2)}

Output a structured verdict. Be specific about which claims you challenge. Mark severity:
- "high": demonstrably wrong, contradicts well-established facts, or fabricated detail (made-up book/quote/date).
- "medium": likely wrong, contested by mainstream scholarship, or overconfident on a debated point.
- "low": minor imprecision, stylistic concerns, easily fixable.

If everything looks accurate, return verdict "agree" with an empty disagreements array.`;
}

export const verifySystem = `You are a fact-checker reviewing an encyclopedia entry. You flag inaccuracies precisely and grade severity honestly. You don't invent objections to look thorough — when the entry is accurate, you say so.`;
