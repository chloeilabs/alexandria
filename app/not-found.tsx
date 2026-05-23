import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          404 · Not Found
        </p>
        <h1 className="font-display font-light text-5xl md:text-6xl text-foreground leading-tight mb-6">
          The Library is silent here.
        </h1>
        <p className="font-display italic text-lg text-muted-foreground leading-relaxed mb-10">
          This entry has not yet been written, or you took a wrong turn in
          the stacks. Begin again from the index.
        </p>
        <Link
          href="/"
          className="inline-block font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1"
        >
          Return to the Library
        </Link>
      </div>
    </main>
  );
}
