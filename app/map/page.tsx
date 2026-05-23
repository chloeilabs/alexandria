import { HistoryMap } from "@/components/map/HistoryMap";
import { getMapMarkers } from "@/lib/db/queries/map";

export const metadata = {
  title: "Map · The Library of Alexandria",
};

export default async function MapRoute() {
  const markers = await getMapMarkers();
  return (
    <main className="min-h-[calc(100vh-3rem)] flex flex-col">
      <header className="max-w-7xl mx-auto w-full px-6 pt-8 pb-3 flex items-baseline justify-between">
        <h1 className="font-display font-light text-3xl md:text-4xl text-foreground">
          Map
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {markers.length} located
        </span>
      </header>
      <p className="max-w-2xl mx-auto px-6 pb-6 font-display italic text-muted-foreground text-center text-lg">
        Each pin marks an entry with known coordinates. Hover for context,
        click to enter.
      </p>
      <div className="flex-1 min-h-[640px] border-t border-border">
        <HistoryMap markers={markers} />
      </div>
    </main>
  );
}
