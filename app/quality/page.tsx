import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { StatsCard } from "@/components/quality/StatsCard";
import { ConsensusHistogram } from "@/components/quality/ConsensusHistogram";
import { ModelCoverage } from "@/components/quality/ModelCoverage";
import { TopicChip } from "@/components/topic/TopicChip";
import { getQualitySummary } from "@/lib/db/queries/quality";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quality · Alexandria",
};

export default async function QualityPage() {
  const summary = await getQualitySummary();

  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Quality
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            Transparency.
          </h1>
          <p
            className="font-display italic mt-3"
            style={{
              fontSize: 17,
              color: "var(--color-muted-foreground)",
              maxWidth: 600,
            }}
          >
            Aggregates over the AI-distilled corpus. Consensus scores
            reflect inter-model agreement during generation — they are
            not a substitute for external verification.
          </p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <StatsCard label="Published" value={summary.totalPublished} />
          <StatsCard
            label="Avg consensus"
            value={summary.avgConsensusScore.toFixed(2)}
            hint="0 – 1 scale"
          />
          <StatsCard label="Flagged" value={summary.totalFlagged} />
          <StatsCard label="In review" value={summary.totalReviewQueueOpen} />
        </section>

        <section className="mb-12">
          <ConsensusHistogram byType={summary.consensusByType} />
        </section>

        <section className="mb-12">
          <ModelCoverage coverage={summary.modelCoverage} />
        </section>

        {summary.topTopics.length > 0 && (
          <section className="mb-12">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
              ¶ Top topics
            </h3>
            <ul className="flex flex-wrap gap-2">
              {summary.topTopics.map((t) => (
                <li key={t.topic}>
                  <TopicChip topic={t.topic} count={t.count} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Recent generation runs
          </h3>
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr
                className="border-b text-left text-muted-foreground"
                style={{ borderColor: "var(--color-border)" }}
              >
                <th className="py-2 pr-3 font-normal uppercase tracking-[0.16em]">
                  When
                </th>
                <th className="py-2 pr-3 font-normal uppercase tracking-[0.16em]">
                  Kind
                </th>
                <th className="py-2 pr-3 font-normal uppercase tracking-[0.16em]">
                  Model
                </th>
                <th className="py-2 pr-3 font-normal uppercase tracking-[0.16em]">
                  Status
                </th>
                <th className="py-2 font-normal uppercase tracking-[0.16em] text-right">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.latestRuns.map((r) => (
                <tr
                  key={r.id}
                  className="border-b"
                  style={{ borderColor: "var(--color-border-faint)" }}
                >
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.finishedAt
                      ? new Date(r.finishedAt).toISOString().slice(0, 16).replace("T", " ")
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">{r.jobKind}</td>
                  <td className="py-2 pr-3">{r.model}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.status}</td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(r.apiCostUsd).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Container>
    </main>
  );
}
