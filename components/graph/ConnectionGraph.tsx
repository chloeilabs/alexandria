"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GraphData, GraphNode } from "@/lib/db/queries/graph";

// react-force-graph-2d uses window — load only on the client
const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((m) => m.default),
  { ssr: false },
);

type ForceGraphRef = {
  d3Force?: (name: string) => { strength?: (n: number) => void } | undefined;
  centerAt?: (x: number, y: number, ms?: number) => void;
  zoomToFit?: (ms?: number, padding?: number) => void;
};

interface Props {
  data: GraphData;
}

function readCssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

// Stable HSL by primaryTag — gives each cluster its own hue. The lightness
// is tuned for the dark background and stays consistent across runs.
function tagHue(tag: string | null): string {
  if (!tag) return "oklch(0.6 0.05 240)";
  let h = 0;
  for (let i = 0; i < tag.length; i += 1) {
    h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `oklch(0.72 0.11 ${hue})`;
}

export function ConnectionGraph({ data }: Props) {
  const router = useRouter();
  const ref = useRef<ForceGraphRef | null>(null);

  // Pre-compute colors per node so they don't flicker on re-render
  const nodes = useMemo(() => {
    const accent = readCssColor("--color-accent", "#d6b066");
    return data.nodes.map((n) => ({
      ...n,
      color: n.tier >= 2 ? accent : tagHue(n.primaryTag),
      val: 1 + n.tier * 1.5,
    }));
  }, [data.nodes]);

  const handleNodeClick = useCallback(
    (n: GraphNode) => {
      router.push(`/entity/${n.slug}`);
    },
    [router],
  );

  return (
    <ForceGraph2D
      graphData={{ nodes, links: data.links }}
      nodeId="qid"
      nodeRelSize={5}
      nodeLabel={(raw) => {
        const n = raw as unknown as GraphNode;
        return `${n.name} · ${n.type}${n.dateStart != null ? ` · ${n.dateStart < 0 ? `${-n.dateStart} BCE` : `${n.dateStart} CE`}` : ""}`;
      }}
      nodeCanvasObject={(raw, ctx, scale) => {
        const node = raw as unknown as GraphNode & {
          x?: number;
          y?: number;
          color: string;
          val: number;
        };
        if (node.x == null || node.y == null) return;
        const r = 4 + node.tier * 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        // Label only when zoomed in or for high-tier nodes
        if (scale > 1.3 || node.tier >= 2) {
          const fontSize = Math.max(7, 10 / scale);
          ctx.font = `${fontSize}px Cormorant Garamond, Georgia, serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = readCssColor("--color-foreground", "#f6f5f0");
          ctx.fillText(node.name, node.x, node.y + r + 2);
        }
      }}
      linkColor={(l) =>
        (l as { kind?: string }).kind === "rel"
          ? readCssColor("--color-accent", "#d6b066") + "AA"
          : readCssColor("--color-border", "#3a4150") + "80"
      }
      linkWidth={(l) =>
        (l as { kind?: string; weight?: number }).kind === "rel"
          ? 1.2
          : Math.max(0.4, ((l as { weight?: number }).weight ?? 1) * 0.4)
      }
      backgroundColor={readCssColor("--color-background", "#0d1320")}
      cooldownTicks={120}
      onEngineStop={() => ref.current?.zoomToFit?.(600, 80)}
      onNodeClick={(n) => handleNodeClick(n as unknown as GraphNode)}
      enableNodeDrag={true}
    />
  );
}
