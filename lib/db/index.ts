import "../env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://library:changeme@localhost:5434/library";

const queryClient = postgres(connectionString, {
  max: 10,
  // The pipeline opens long-lived workers; idle timeout keeps Postgres tidy.
  idle_timeout: 20,
  prepare: false,
  // Neon's `neondb_owner` ships with an empty default search_path; without
  // this, unqualified table refs (e.g. Drizzle's `FROM "entities"`) fail
  // with "relation does not exist". Also set via `ALTER ROLE ... SET
  // search_path = public` on the DB itself, this is defense-in-depth so
  // new clients work on first connect.
  connection: { search_path: "public" },
});

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;

export * from "./schema";
