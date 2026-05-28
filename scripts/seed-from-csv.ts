// Load data/seeds.csv into the seed_topics table. The CSV is intentionally
// tiny — three columns: name, hint, entity_type_guess. Lines starting with
// "#" are ignored.
//
// Usage: pnpm tsx scripts/seed-from-csv.ts [--file data/seeds.csv]

import "../lib/env";
import * as fs from "node:fs";
import * as path from "node:path";

import { db } from "../lib/db";
import { seedTopics } from "../lib/db/schema";
import { ENTITY_TYPES } from "../lib/db/schema";
import { withRetry } from "../lib/db/retry";

interface Row {
  name: string;
  hint: string | null;
  entityTypeGuess: string | null;
}

function parseCsv(content: string): Row[] {
  const rows: Row[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    // Tiny tolerant parser: split on commas not inside quotes.
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    const name = cells[0] ?? "";
    const hint = cells[1] ?? "";
    const type = cells[2] ?? "";
    if (!name) continue;
    const guess = (ENTITY_TYPES as readonly string[]).includes(type) ? type : null;
    rows.push({
      name,
      hint: hint || null,
      entityTypeGuess: guess,
    });
  }
  return rows;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileFlag = args.indexOf("--file");
  const passed = fileFlag !== -1 ? args[fileFlag + 1] : undefined;
  const file = passed ?? path.join(process.cwd(), "data/seeds.csv");

  if (!fs.existsSync(file)) {
    console.error(`seed file not found: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(file, "utf-8");
  const rows = parseCsv(content);
  if (!rows.length) {
    console.log("no rows parsed");
    return;
  }

  const inserted = await withRetry("insertSeedsFromCsv", async () =>
    db.insert(seedTopics).values(
      rows.map((r) => ({
        name: r.name,
        hint: r.hint,
        entityTypeGuess: r.entityTypeGuess,
      })),
    ).returning({ id: seedTopics.id }),
  );

  console.log(`inserted ${inserted.length} seeds from ${path.relative(process.cwd(), file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
