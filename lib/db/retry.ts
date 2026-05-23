// Retry wrapper for DB calls.
//
// Why this exists: Neon's serverless compute auto-suspends after idle.
// The first request after a suspension wakes the compute (1–2s typical)
// and the in-flight postgres-js connection can fail with CONNECT_TIMEOUT,
// ECONNRESET, or the postgres-js library codes CONNECTION_CLOSED /
// CONNECTION_ENDED / CONNECTION_DESTROYED. postgres-js auto-reconnects
// on the next query but it does NOT retry the failed query itself, so
// without a wrapper that first request surfaces as a 500.
//
// We only retry on connection-class errors. Postgres logic errors
// (PostgresError with a SQLSTATE code) are bugs in the query or schema
// and retrying them is a waste of latency.
//
// Logging note: Vercel's runtime log viewer truncates messages at ~30
// chars, so "Error: Failed query: SELECT..." hides the actual server
// error. We unpack the PostgresError fields into a structured object
// so the log table shows the SQLSTATE code, severity, detail, hint,
// schema, and table.

type AnyError = Record<string, unknown> & { code?: unknown; message?: unknown };

const TRANSIENT_CODES = new Set([
  // postgres-js library codes
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  // Node net codes
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EPIPE",
]);

// Drizzle wraps every query failure in DrizzleQueryError with the
// underlying driver error on `.cause` (see pg-core/session.ts). The
// wrapper itself has no `code` / SQLSTATE — the real fields are one
// level down. Without this unwrap, isTransient saw `code: undefined`
// for every real error and we never retried; logging missed SQLSTATE
// for the same reason.
function unwrap(err: unknown): AnyError {
  if (!err || typeof err !== "object") return {} as AnyError;
  const cause = (err as { cause?: unknown }).cause;
  return (cause && typeof cause === "object" ? cause : err) as AnyError;
}

function isTransient(err: unknown): boolean {
  const code = unwrap(err).code;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

function logDbError(label: string, err: unknown): void {
  if (!err || typeof err !== "object") {
    console.error(`[${label}] non-object error`, err);
    return;
  }
  const outer = err as AnyError;
  const inner = unwrap(err);
  const wrapped = outer !== inner;
  console.error(`[${label}] db error`, {
    // Inner = the underlying PostgresError / connection error. This is
    // where SQLSTATE and the structured fields live.
    code: inner.code,
    message: inner.message,
    severity: inner.severity,
    detail: inner.detail,
    hint: inner.hint,
    schema: inner.schema_name,
    table: inner.table_name,
    where: inner.where,
    constraint: inner.constraint_name,
    // Outer = the DrizzleQueryError wrapper, when present. Its message
    // includes the rendered query text — useful context but not the
    // server error.
    wrapper: wrapped ? outer.message : undefined,
    query: (outer as { query?: unknown }).query,
  });
}

export interface RetryOptions {
  /** Total attempts including the first try. Default 3 (initial + 2 retries). */
  attempts?: number;
  /** Base delay in ms. Each retry waits ~base * 3^i + jitter. Default 80ms. */
  baseDelayMs?: number;
}

/**
 * Run a DB call with retry on transient connection errors.
 *
 * Backoff schedule with defaults: ~80ms, ~240ms, ~720ms (plus 0-50ms jitter).
 * Total worst-case latency before giving up: ~1s, which fits Neon's typical
 * cold-start window without ballooning request times when the DB is healthy.
 *
 * @param label  Short identifier for logs (usually the calling function name).
 * @param fn     The DB call to execute.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 80;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) {
        logDbError(label, err);
        throw err;
      }
      const delay = baseDelayMs * Math.pow(3, i) + Math.floor(Math.random() * 50);
      const code = unwrap(err).code ?? "unknown";
      console.warn(
        `[${label}] transient db error (${String(code)}); retry ${i + 1}/${attempts - 1} in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Unreachable — the loop either returns or throws above.
  throw lastErr;
}
