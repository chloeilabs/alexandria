import Link from "next/link";

export function Pagination({
  basePath,
  page,
  perPage,
  count,
}: {
  basePath: string;
  page: number;
  perPage: number;
  count: number;
}) {
  const hasNext = count === perPage;
  const hasPrev = page > 1;
  if (!hasNext && !hasPrev) return null;

  return (
    <nav
      className="mt-10 flex items-baseline justify-between"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={`${basePath}?page=${page - 1}`}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Page {page}
      </span>
      {hasNext ? (
        <Link
          href={`${basePath}?page=${page + 1}`}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
