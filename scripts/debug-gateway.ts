#!/usr/bin/env tsx
import "../lib/env";
import { generateText } from "ai";

async function probe(label: string, opts: Parameters<typeof generateText>[0]) {
  console.log(`\n=== ${label} ===`);
  try {
    const r = await generateText(opts);
    console.log("finishReason:", r.finishReason);
    console.log("text:", JSON.stringify(r.text.slice(0, 200)));
    console.log(
      "usage:",
      `in=${r.usage.inputTokens} out=${r.usage.outputTokens} reasoning=${(r.usage as { reasoningTokens?: number }).reasoningTokens ?? 0}`,
    );
  } catch (e) {
    console.log("ERROR:", e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  const prompt = "Write one sentence about Hannibal of Carthage.";

  await probe("A: max=200 (the failing config)", {
    model: "google/gemini-3.5-flash",
    maxOutputTokens: 200,
    prompt,
  });

  await probe("B: max=3000", {
    model: "google/gemini-3.5-flash",
    maxOutputTokens: 3000,
    prompt,
  });

  await probe("C: max=600, thinkingBudget=0 (google namespace)", {
    model: "google/gemini-3.5-flash",
    maxOutputTokens: 600,
    prompt,
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } },
    },
  });

  await probe("D: max=600, thinkingBudget=0 (vertex namespace)", {
    model: "google/gemini-3.5-flash",
    maxOutputTokens: 600,
    prompt,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingBudget: 0 } },
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
