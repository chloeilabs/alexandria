// In-memory capture/restore of a single entity's full content — the entity
// row plus its aliases / topics / citations / per-claim rows. Used by the
// remediation pass to roll back a regeneration that came out worse
// (keep-if-better), so remediation can only ever improve or no-op.

import { eq } from "drizzle-orm";

import { db } from ".";
import {
  entities,
  entityAliases,
  entityClaimedCitations,
  entityClaims,
  entityTopics,
} from "./schema";

export interface EntitySnapshot {
  entity: typeof entities.$inferSelect;
  aliases: string[];
  topics: string[];
  citations: (typeof entityClaimedCitations.$inferSelect)[];
  claims: (typeof entityClaims.$inferSelect)[];
}

export async function captureEntity(id: string): Promise<EntitySnapshot> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, id))
    .limit(1);
  if (!entity) throw new Error(`captureEntity: no entity ${id}`);

  const [aliases, topics, citations, claims] = await Promise.all([
    db
      .select({ alias: entityAliases.alias })
      .from(entityAliases)
      .where(eq(entityAliases.entityId, id)),
    db
      .select({ topic: entityTopics.topic })
      .from(entityTopics)
      .where(eq(entityTopics.entityId, id)),
    db
      .select()
      .from(entityClaimedCitations)
      .where(eq(entityClaimedCitations.entityId, id)),
    db.select().from(entityClaims).where(eq(entityClaims.entityId, id)),
  ]);

  return {
    entity,
    aliases: aliases.map((a) => a.alias),
    topics: topics.map((t) => t.topic),
    citations,
    claims,
  };
}

export async function restoreEntity(snap: EntitySnapshot): Promise<void> {
  const id = snap.entity.id;
  // Restore all content columns. Omit id + createdAt (preserve them) and
  // searchText (a trigger recomputes it from canonical_name/short/summary).
  const {
    id: _id,
    createdAt: _createdAt,
    searchText: _searchText,
    ...restorable
  } = snap.entity;
  void _id;
  void _createdAt;
  void _searchText;

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({ ...restorable, updatedAt: new Date() })
      .where(eq(entities.id, id));

    await tx.delete(entityAliases).where(eq(entityAliases.entityId, id));
    if (snap.aliases.length) {
      await tx
        .insert(entityAliases)
        .values(snap.aliases.map((alias) => ({ entityId: id, alias })))
        .onConflictDoNothing();
    }

    await tx.delete(entityTopics).where(eq(entityTopics.entityId, id));
    if (snap.topics.length) {
      await tx
        .insert(entityTopics)
        .values(snap.topics.map((topic) => ({ entityId: id, topic })))
        .onConflictDoNothing();
    }

    await tx
      .delete(entityClaimedCitations)
      .where(eq(entityClaimedCitations.entityId, id));
    if (snap.citations.length) {
      await tx
        .insert(entityClaimedCitations)
        .values(snap.citations.map(({ id: _cid, ...c }) => c));
    }

    await tx.delete(entityClaims).where(eq(entityClaims.entityId, id));
    if (snap.claims.length) {
      await tx.insert(entityClaims).values(snap.claims.map(({ id: _clid, ...c }) => c));
    }
  });
}
