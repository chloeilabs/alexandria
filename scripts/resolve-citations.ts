// Resolve LLM-claimed citations against CrossRef/OpenAlex and write the
// result back to entity_claimed_citations. Free APIs (no AI budget). Paced
// for the polite pools.
//
// Usage:
//   pnpm tsx scripts/resolve-citations.ts [--limit N] [--reresolve]

import "../lib/env";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { entityClaimedCitations } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";
import { resolveCitation, type ResolutionStatus } from "@/lib/citations/resolve";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (n: string) => process.argv.includes(n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 1000);
  const reresolve = hasFlag("--reresolve");

  const rows = await withRetry("resolve:select", () =>
    db
      .select({
        id: entityClaimedCitations.id,
        source: entityClaimedCitations.claimedSource,
        author: entityClaimedCitations.claimedAuthor,
        status: entityClaimedCitations.resolutionStatus,
      })
      .from(entityClaimedCitations)
      .orderBy(asc(entityClaimedCitations.id))
      .limit(limit * 4),
  );

  const todo = reresolve
    ? rows
    : rows.filter((r) => r.status === "unchecked");
  const work = todo.slice(0, limit);

  if (work.length === 0) {
    console.log("nothing to resolve");
    return;
  }
  console.log(`resolving ${work.length} citations…\n`);

  const tally: Record<ResolutionStatus, number> = {
    verified: 0,
    ambiguous: 0,
    not_found: 0,
  };

  for (const [i, c] of work.entries()) {
    const r = await resolveCitation({ source: c.source, author: c.author });
    tally[r.status] += 1;

    await withRetry("resolve:write", () =>
      db
        .update(entityClaimedCitations)
        .set({
          resolutionStatus: r.status,
          resolvedTitle: r.title,
          resolvedDoi: r.doi,
          resolvedUrl: r.url,
          resolutionConfidence: r.confidence,
          resolvedVia: r.via,
          resolvedAt: new Date(),
        })
        .where(eq(entityClaimedCitations.id, c.id)),
    );

    const mark = r.status === "verified" ? "✓" : r.status === "ambiguous" ? "~" : "✗";
    if ((i + 1) % 20 === 0 || i === work.length - 1) {
      process.stdout.write(`  ${i + 1}/${work.length}\r`);
    }
    void mark;
    await sleep(180); // stay inside the polite-pool rate limits
  }

  console.log("\n");
  const total = work.length;
  console.log(
    `=== ${tally.verified}/${total} verified (${((tally.verified / total) * 100).toFixed(0)}%) · ` +
      `${tally.ambiguous} ambiguous · ${tally.not_found} not found ===`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
