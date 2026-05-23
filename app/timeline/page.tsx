import Link from "next/link";
import { Timeline } from "@/components/timeline/Timeline";
import { getTimelineEvents } from "@/lib/db/queries/timeline";

export const metadata = {
  title: "Timeline · The Library of Alexandria",
};

export default async function TimelineRoute() {
  const events = await getTimelineEvents();
  return (
    <main className="min-h-screen pb-16">
      <header className="max-w-7xl mx-auto px-6 pt-16 pb-8 flex items-baseline justify-between">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
        >
          ← The Library
        </Link>
        <h1 className="font-display font-light text-3xl md:text-4xl text-foreground">
          Timeline
        </h1>
        <div className="w-24" />
      </header>
      <div className="w-full max-w-[1600px] mx-auto px-6">
        <Timeline events={events} />
      </div>
    </main>
  );
}
