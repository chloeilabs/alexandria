import { getFeaturedEntities } from "@/lib/db/queries/entity";
import { getAllCivilizationSlugs } from "@/lib/db/queries/civilization";
import { getEraCounts } from "@/lib/db/queries/era";
import { getScriptoriumStats } from "@/lib/db/queries/scriptorium";
import { getAllThreads, getFeaturedThread } from "@/lib/db/queries/thread";
import { HomeScriptorium } from "@/components/scriptorium/HomeScriptorium";

// Force per-request rendering. The DB lives off the build VM (Neon),
// so static prerender would either fail or capture stale state. Next's
// runtime caching covers the warm path.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, civs, eraCounts, stats, threads, featuredThread] =
    await Promise.all([
      getFeaturedEntities(12, 2),
      getAllCivilizationSlugs(),
      getEraCounts(),
      getScriptoriumStats(),
      getAllThreads(),
      getFeaturedThread(),
    ]);

  const erasWithEntries = eraCounts.filter((e) => e.entryCount > 0).length;

  return (
    <HomeScriptorium
      featured={featured}
      stats={stats}
      civs={civs}
      threads={threads.slice(0, 3)}
      featuredThread={featuredThread}
      erasWithEntries={erasWithEntries}
    />
  );
}
