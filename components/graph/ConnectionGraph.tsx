"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import type { GraphData, GraphNode } from "@/lib/db/queries/graph";
import { color, hueFor } from "@/lib/colors";
import { fmtYear } from "@/lib/format";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((m) => m.default),
  { ssr: false },
);

type ForceGraphRef = {
  zoomToFit?: (ms?: number, padding?: number) => void;
};

interface Props {
  data: GraphData;
}

type NodeWithStyle = GraphNode & {
  color: string;
  val: number;
  x?: number;
  y?: number;
};

export function ConnectionGraph({ data }: Props) {
  const router = useRouter();
  const ref = useRef<ForceGraphRef | null>(null);

  // Color is stable per node so it doesn't flicker on re-render.
  const nodes = useMemo<NodeWithStyle[]>(() => {
    const accent = color("accent");
    return data.nodes.map((n) => ({
      ...n,
      color: n.tier >= 2 ? accent : hueFor(n.primaryTag),
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
        const date = n.dateStart != null ? ` · ${fmtYear(n.dateStart)}` : "";
        return `${n.name} · ${n.type}${date}`;
      }}
      nodeCanvasObject={(raw, ctx, scale) => {
        const node = raw as unknown as NodeWithStyle;
        if (node.x == null || node.y == null) return;
        const r = 4 + node.tier * 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        if (scale > 1.3 || node.tier >= 2) {
          const fontSize = Math.max(7, 10 / scale);
          ctx.font = `${fontSize}px Cormorant Garamond, Georgia, serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = color("foreground");
          ctx.fillText(node.name, node.x, node.y + r + 2);
        }
      }}
      linkColor={(l) =>
        (l as { kind?: string }).kind === "rel"
          ? `${color("accent")}AA`
          : `${color("border")}80`
      }
      linkWidth={(l) =>
        (l as { kind?: string; weight?: number }).kind === "rel"
          ? 1.2
          : Math.max(0.4, ((l as { weight?: number }).weight ?? 1) * 0.4)
      }
      backgroundColor={color("background")}
      cooldownTicks={120}
      onEngineStop={() => ref.current?.zoomToFit?.(600, 80)}
      onNodeClick={(n) => handleNodeClick(n as unknown as GraphNode)}
      enableNodeDrag={true}
    />
  );
}
