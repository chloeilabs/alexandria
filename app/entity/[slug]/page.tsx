import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EntityPage } from "@/components/entity/EntityPage";
import { getEntityBySlug } from "@/lib/db/queries/entity";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEntityBySlug(slug);
  if (!data) return { title: "Not found" };
  const description =
    data.entity.summary?.slice(0, 160) ?? `Read about ${data.entity.name}.`;
  return {
    title: `${data.entity.name} · Alexandria`,
    description,
    openGraph: {
      title: data.entity.name,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: data.entity.name,
      description,
    },
  };
}

export default async function EntityRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getEntityBySlug(slug);
  if (!data) notFound();
  return <EntityPage data={data} />;
}
