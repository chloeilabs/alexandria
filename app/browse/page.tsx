import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { TypeGrid } from "@/components/browse/TypeGrid";
import { typeCatalogCounts } from "@/lib/db/queries/entity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse · Alexandria",
};

export default async function BrowseIndex() {
  const counts = await typeCatalogCounts();
  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Browse
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            By type.
          </h1>
        </header>
        <TypeGrid counts={counts} />
      </Container>
    </main>
  );
}
