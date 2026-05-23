// Data fetch for the map view.

import { sql } from "drizzle-orm";
import { db } from "../index";
import { entities } from "../schema";

export interface MapMarker {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  latitude: number;
  longitude: number;
  dateStart: number | null;
  dateEnd: number | null;
}

export async function getMapMarkers(): Promise<MapMarker[]> {
  const rows = await db
    .select({
      qid: entities.qid,
      slug: entities.slug,
      name: entities.name,
      type: entities.type,
      tier: entities.tier,
      latitude: entities.latitude,
      longitude: entities.longitude,
      dateStart: entities.dateStart,
      dateEnd: entities.dateEnd,
    })
    .from(entities)
    .where(sql`${entities.latitude} IS NOT NULL AND ${entities.longitude} IS NOT NULL`);

  // The WHERE clause guarantees non-null but TS doesn't know that.
  return rows
    .filter(
      (r): r is typeof r & { latitude: number; longitude: number } =>
        r.latitude != null && r.longitude != null,
    )
    .map((r) => ({
      qid: r.qid,
      slug: r.slug,
      name: r.name,
      type: r.type,
      tier: r.tier,
      latitude: r.latitude,
      longitude: r.longitude,
      dateStart: r.dateStart,
      dateEnd: r.dateEnd,
    }));
}
