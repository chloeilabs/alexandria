"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { GraphData, GraphNode } from "@/lib/db/queries/graph";
import { color, hueFor } from "@/lib/colors";
import { fmtYear, regionLabel } from "@/lib/format";

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
  size: number;
  x?: number;
  y?: number;
};

export function ConnectionGraph({ data }: Props) {
  const router = useRouter();
  const ref = useRef<ForceGraphRef | null>(null);
  const [hoverQid, setHoverQid] = useState<string | null>(null);
  const [neighborQids, setNeighborQids] = useState<Set<string>>(new Set());

  // Stable cluster colors keyed by primary civilizational tag — applied
  // to every node regardless of tier, so the cluster structure is
  // legible at a glance. Tier influences node SIZE (and a subtle outline
  // ring drawn in canvas), not hue.
  const nodes = useMemo<NodeWithStyle[]>(() => {
    return data.nodes.map((n) => ({
      ...n,
      color: hueFor(n.primaryTag),
      size: 4 + n.tier * 1.2,
    }));
  }, [data.nodes]);

  // Adjacency map for hover-emphasis.
  const adjacency = useMemo(() => {
    const a = new Map<string, Set<string>>();
    for (const l of data.links) {
      if (!a.has(l.source)) a.set(l.source, new Set());
      if (!a.has(l.target)) a.set(l.target, new Set());
      a.get(l.source)!.add(l.target);
      a.get(l.target)!.add(l.source);
    }
    return a;
  }, [data.links]);

  const handleNodeClick = useCallback(
    (n: GraphNode) => {
      router.push(`/entity/${n.slug}`);
    },
    [router],
  );

  const handleNodeHover = useCallback(
    (raw: unknown) => {
      const n = raw as GraphNode | null;
      if (!n) {
        setHoverQid(null);
        setNeighborQids(new Set());
        return;
      }
      setHoverQid(n.qid);
      setNeighborQids(adjacency.get(n.qid) ?? new Set());
    },
    [adjacency],
  );

  const fg = color("foreground");
  const bg = color("background");
  const accent = color("accent");
  const border = color("border");

  return (
    <ForceGraph2D
      graphData={{ nodes, links: data.links }}
      nodeId="qid"
      nodeRelSize={5}
      nodeLabel={(raw) => {
        const n = raw as unknown as GraphNode;
        const date = n.dateStart != null ? ` · ${fmtYear(n.dateStart)}` : "";
        const region = n.primaryTag ? ` · ${regionLabel(n.primaryTag)}` : "";
        return `${n.name} · ${n.type}${date}${region}`;
      }}
      nodeCanvasObject={(raw, ctx, scale) => {
        const node = raw as unknown as NodeWithStyle;
        if (node.x == null || node.y == null) return;
        const isFocused = hoverQid != null;
        const isHover = hoverQid === node.qid;
        const isNeighbor = neighborQids.has(node.qid);
        const fade = isFocused && !isHover && !isNeighbor;
        const r = node.size * (isHover ? 1.4 : 1);

        // Outer ring (subtle)
        if (node.tier >= 2) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 1.5, 0, 2 * Math.PI);
          ctx.strokeStyle = isHover ? accent : `${node.color}AA`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = fade ? `${node.color}33` : node.color;
        ctx.fill();

        // Labels: only on hover or when zoomed in past a threshold.
        const showLabel = isHover || isNeighbor || scale > 1.6;
        if (showLabel) {
          const fontSize = Math.max(8, isHover ? 12 : 11 / scale);
          ctx.font = `${fontSize}px Cormorant Garamond, Georgia, serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          // Pill background for legibility on hover
          if (isHover) {
            const text = node.name;
            const padX = 5;
            const w = ctx.measureText(text).width + padX * 2;
            const h = fontSize + 5;
            ctx.fillStyle = `${bg}E6`;
            ctx.strokeStyle = `${border}`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(
              node.x - w / 2,
              node.y + r + 3,
              w,
              h,
              h / 2,
            );
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = fade ? `${fg}55` : fg;
          ctx.fillText(
            node.name,
            node.x,
            node.y + r + (isHover ? 5 : 3),
          );
        }
      }}
      linkColor={(l) => {
        const link = l as {
          kind?: string;
          source: string | { qid?: string };
          target: string | { qid?: string };
        };
        const sId =
          typeof link.source === "string"
            ? link.source
            : link.source?.qid ?? "";
        const tId =
          typeof link.target === "string"
            ? link.target
            : link.target?.qid ?? "";
        const touchesHover =
          hoverQid != null && (sId === hoverQid || tId === hoverQid);
        const baseAccent = `${accent}AA`;
        const baseCiv = `${border}80`;
        if (hoverQid && !touchesHover) {
          return link.kind === "rel" ? `${accent}33` : `${border}33`;
        }
        if (touchesHover) {
          return link.kind === "rel" ? accent : `${accent}AA`;
        }
        return link.kind === "rel" ? baseAccent : baseCiv;
      }}
      linkWidth={(l) => {
        const link = l as { kind?: string; weight?: number };
        return link.kind === "rel" ? 1.2 : Math.max(0.5, (link.weight ?? 1) * 0.4);
      }}
      backgroundColor={bg}
      cooldownTicks={120}
      onEngineStop={() => ref.current?.zoomToFit?.(600, 80)}
      onNodeClick={(n) => handleNodeClick(n as unknown as GraphNode)}
      onNodeHover={handleNodeHover}
      enableNodeDrag={true}
      d3VelocityDecay={0.3}
    />
  );
}
