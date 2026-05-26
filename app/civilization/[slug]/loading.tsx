// Skeleton that matches the civilization detail layout. Shows while
// the page-data query is in flight — gives the reader a sense of
// what's coming instead of a blank screen during slow Neon cold-starts.

export default function Loading() {
  return (
    <main className="min-h-screen pb-32 animate-pulse" aria-busy="true">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="h-3 w-32 bg-foreground/10 mb-6" />
        <div className="h-16 md:h-20 w-3/4 bg-foreground/15 rounded" />
      </header>
      <div className="max-w-3xl mx-auto px-6 space-y-12">
        {[0, 1, 2].map((i) => (
          <section key={i}>
            <div className="h-3 w-24 bg-foreground/10 mb-8 border-t border-border pt-8" />
            <ul className="space-y-8">
              {[0, 1, 2].map((j) => (
                <li key={j} className="flex gap-6 items-start">
                  <div className="w-24 h-24 shrink-0 bg-foreground/10" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-2/3 bg-foreground/15 rounded" />
                    <div className="h-4 w-full bg-foreground/10 rounded" />
                    <div className="h-4 w-5/6 bg-foreground/10 rounded" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
