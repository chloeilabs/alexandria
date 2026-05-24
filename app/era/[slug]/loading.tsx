// Skeleton for the era detail page. Same shape as civilization/[slug]
// loading since the two routes render structurally identical lists.

export default function Loading() {
  return (
    <main className="min-h-screen pb-32 animate-pulse" aria-busy="true">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="h-3 w-32 bg-muted/30 mb-6" />
        <div className="h-16 md:h-20 w-2/3 bg-muted/40 rounded" />
      </header>
      <div className="max-w-3xl mx-auto px-6 space-y-12">
        {[0, 1, 2].map((i) => (
          <section key={i}>
            <div className="h-3 w-32 bg-muted/30 mb-8 border-t border-border pt-8" />
            <ul className="space-y-8">
              {[0, 1, 2].map((j) => (
                <li key={j} className="flex gap-6 items-start">
                  <div className="w-24 h-24 shrink-0 bg-muted/30" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-2/3 bg-muted/40 rounded" />
                    <div className="h-4 w-full bg-muted/30 rounded" />
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
