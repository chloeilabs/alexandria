import Link from "next/link";
import { HistoryMap } from "@/components/map/HistoryMap";
import { getMapMarkers } from "@/lib/db/queries/map";

export const metadata = {
  title: "Map · The Library of Alexandria",
};

export default async function MapRoute() {
  const markers = await getMapMarkers();
  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-7xl mx-auto w-full px-6 pt-12 pb-6 flex items-baseline justify-between">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
        >
          ← The Library
        </Link>
        <h1 className="font-display font-light text-3xl md:text-4xl text-foreground">
          Map
        </h1>
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {markers.length} located
        </div>
      </header>
      <p className="max-w-2xl mx-auto px-6 pb-6 font-display italic text-muted-foreground text-center">
        Each pin marks an entry with known coordinates. Hover for context,
        click to enter.
      </p>
      <div className="flex-1 min-h-[640px] border-t border-border">
        <HistoryMap markers={markers} />
      </div>
    </main>
  );
}
