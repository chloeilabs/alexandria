import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { EntityView } from "@/components/entity/EntityView";
import {
  getCitations,
  getEntityClaims,
  getEntityFull,
  getRelated,
} from "@/lib/db/queries/entity";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityFull(slug);
  if (!entity) return { title: "Not found · Alexandria" };
  return {
    title: `${entity.canonicalName} · Alexandria`,
    description: entity.shortDescription,
  };
}

export default async function EntityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entity = await getEntityFull(slug);
  if (!entity) notFound();

  const [related, citations, claims] = await Promise.all([
    getRelated({ entityId: entity.id }),
    getCitations(entity.id),
    getEntityClaims(entity.id),
  ]);

  return (
    <main className="py-12">
      <Container>
        <EntityView
          entity={entity}
          related={related}
          citations={citations.map((c) => ({
            claimExcerpt: c.claimExcerpt,
            claimedSource: c.claimedSource,
            claimedUrl: c.claimedUrl,
            claimedAuthor: c.claimedAuthor,
            claimKind: c.claimKind,
            verifiedBySecondModel: c.verifiedBySecondModel,
          }))}
          claims={claims}
        />
      </Container>
    </main>
  );
}
