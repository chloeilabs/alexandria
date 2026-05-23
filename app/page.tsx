export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="font-display font-light tracking-tight text-6xl md:text-7xl text-foreground">
          The Library of Alexandria
        </h1>
        <p className="font-display italic text-2xl text-muted-foreground">
          A living digital encyclopedia of human civilization.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          The pipeline is awakening.
        </p>
      </div>
    </main>
  );
}
