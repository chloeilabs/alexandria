// Skeleton for the thread detail page — numbered walk through entries.

export default function Loading() {
  return (
    <article className="min-h-screen pb-32 animate-pulse" aria-busy="true">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="h-3 w-32 bg-foreground/10 mb-6" />
        <div className="h-16 md:h-20 w-3/4 bg-foreground/15 rounded" />
        <div className="mt-6 space-y-3 border-l-2 border-accent/40 pl-5">
          <div className="h-5 w-full bg-foreground/10 rounded" />
          <div className="h-5 w-4/5 bg-foreground/10 rounded" />
        </div>
      </header>
      <ol className="max-w-3xl mx-auto px-6 space-y-16 mt-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i}>
            <div className="flex items-baseline gap-4 mb-6">
              <div className="h-3 w-8 bg-foreground/15" />
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3 mb-6 border-l-2 border-accent/40 pl-5">
              <div className="h-5 w-full bg-foreground/10 rounded" />
              <div className="h-5 w-5/6 bg-foreground/10 rounded" />
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-32 h-32 shrink-0 bg-foreground/10" />
              <div className="flex-1 space-y-3">
                <div className="h-7 w-2/3 bg-foreground/15 rounded" />
                <div className="h-4 w-full bg-foreground/10 rounded" />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
