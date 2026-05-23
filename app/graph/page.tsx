import Link from "next/link";
import { ConnectionGraph } from "@/components/graph/ConnectionGraph";
import { getGraphData } from "@/lib/db/queries/graph";

export const metadata = {
  title: "Graph · The Library of Alexandria",
};

export default async function GraphRoute() {
  const data = await getGraphData();
  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-7xl mx-auto px-6 pt-12 pb-6 flex items-baseline justify-between w-full">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
        >
          ← The Library
        </Link>
        <h1 className="font-display font-light text-3xl md:text-4xl text-foreground">
          Connections
        </h1>
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {data.nodes.length} nodes · {data.links.length} edges
        </div>
      </header>
      <p className="max-w-2xl mx-auto px-6 pb-6 font-display italic text-muted-foreground text-center">
        Each cluster is a civilization; each line a shared world. Click a name to enter.
      </p>
      <div className="flex-1 min-h-[600px] border-t border-border">
        <ConnectionGraph data={data} />
      </div>
    </main>
  );
}
