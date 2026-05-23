import { Timeline } from "@/components/timeline/Timeline";
import { getTimelineEvents } from "@/lib/db/queries/timeline";

export const metadata = {
  title: "Timeline · Alexandria",
};

export const dynamic = "force-dynamic";

export default async function TimelineRoute() {
  const events = await getTimelineEvents();
  return (
    <main className="min-h-[calc(100vh-3rem)] pb-12">
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-6 flex items-baseline justify-between">
        <h1 className="font-display font-light text-3xl md:text-4xl text-foreground">
          Timeline
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {events.length} entries
        </span>
      </header>
      <div className="w-full max-w-[1600px] mx-auto px-6">
        <Timeline events={events} />
      </div>
    </main>
  );
}
