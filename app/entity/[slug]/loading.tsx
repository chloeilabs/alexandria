// Skeleton for entity-page navigation. Matches the final EntityPage layout
// so the swap-in is invisible.

export default function Loading() {
  return (
    <article className="min-h-screen pb-32 animate-pulse">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="h-3 w-40 bg-foreground/10 mb-8 rounded" />
        <div className="h-12 w-3/4 bg-foreground/15 mb-3 rounded" />
        <div className="h-12 w-1/2 bg-foreground/15 rounded" />
      </header>
      <section className="max-w-3xl mx-auto px-6 py-4 space-y-5">
        <div className="h-5 w-full bg-foreground/8 rounded" />
        <div className="h-5 w-[97%] bg-foreground/8 rounded" />
        <div className="h-5 w-[92%] bg-foreground/8 rounded" />
        <div className="h-5 w-[95%] bg-foreground/8 rounded" />
        <div className="h-5 w-[80%] bg-foreground/8 rounded" />
      </section>
    </article>
  );
}
