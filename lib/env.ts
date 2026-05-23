// Centralized dotenv loader. Side-effect-only — import once per entry point.
//
// `import "dotenv/config"` only reads `.env`. Next.js auto-loads `.env.local`
// but our tsx-invoked pipeline scripts and CLI helpers need it explicitly.
// We load `.env.local` FIRST so it takes precedence over `.env`, mirroring
// Next.js semantics.

import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const candidates = [
  path.join(cwd, ".env.local"),
  path.join(cwd, ".env"),
];

for (const file of candidates) {
  if (existsSync(file)) {
    config({ path: file, override: false });
  }
}
