import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://library:changeme@localhost:5434/library",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
