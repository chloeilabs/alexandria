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
});

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;

export * from "./schema";
