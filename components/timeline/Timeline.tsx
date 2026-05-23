"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  scaleLinear,
  zoom as d3Zoom,
  zoomIdentity,
  select,
  axisBottom,
  type ScaleLinear,
  type D3ZoomEvent,
} from "d3";

import type { TimelineEvent } from "@/lib/db/queries/timeline";
import { color } from "@/lib/colors";
import { fmtYear, regionLabel } from "@/lib/format";

interface Props {
  events: TimelineEvent[];
}

const MIN_YEAR = -3500;
const MAX_YEAR = 2026;
const TRACK_HEIGHT = 28;
const TRACK_LABEL_WIDTH = 230;
const TOP_PAD = 56;
const BOTTOM_PAD = 36;
const RIGHT_PAD = 24;
const BAR_HEIGHT = 12;
const POINT_RADIUS = 5;

function tierColor(tier: number, accent: string, muted: string): string {
  if (tier >= 2) return accent;
  if (tier === 1) return muted;
  return `${muted}80`;
}

export function Timeline({ events }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState(() => zoomIdentity);
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const [hover, setHover] = useState<{
    event: TimelineEvent;
    x: number;
    y: number;
  } | null>(null);

  // Group entities into tracks. One track per civilizational tag; if an
  // entity has multiple tags, use its primary (first) tag.
  const { tracks, eventsByTrack } = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const tag = ev.civTags[0] ?? "uncategorised";
      const arr = map.get(tag);
      if (arr) arr.push(ev);
      else map.set(tag, [ev]);
    }
    // Chronological track order (anti-Western-default).
    const trackList = [...map.entries()]
      .map(([tag, arr]) => ({
        tag,
        earliest: Math.min(...arr.map((e) => e.dateStart)),
        events: arr,
      }))
      .sort((a, b) => a.earliest - b.earliest);
    return {
      tracks: trackList.map((t) => t.tag),
      eventsByTrack: new Map(trackList.map((t) => [t.tag, t.events])),
    };
  }, [events]);

  const innerHeight = tracks.length * TRACK_HEIGHT + TOP_PAD + BOTTOM_PAD;

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({
          width: Math.max(800, e.contentRect.width),
          height: innerHeight,
        });
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [innerHeight]);

  const baseScale: ScaleLinear<number, number> = useMemo(
    () =>
      scaleLinear()
        .domain([MIN_YEAR, MAX_YEAR])
        .range([TRACK_LABEL_WIDTH + 12, size.width - RIGHT_PAD]),
    [size.width],
  );

  const x = useMemo(
    () => transform.rescaleX(baseScale),
    [transform, baseScale],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 200])
      .translateExtent([
        [0, 0],
        [size.width, innerHeight],
      ])
      .extent([
        [0, 0],
        [size.width, innerHeight],
      ])
      .filter((event: Event) => {
        return (
          event.type !== "dblclick" &&
          !(event.type === "mousedown" && (event as MouseEvent).button !== 0)
        );
      })
      .on("zoom", (ev: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        setTransform(ev.transform);
      });
    select(canvas).call(zoomBehavior);
    return () => {
      select(canvas).on(".zoom", null);
    };
  }, [size.width, innerHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = size.width * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = color("background");
    const fg = color("foreground");
    const border = color("border");
    const accent = color("accent");
    const muted = color("muted");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.width, innerHeight);

    // Tracks
    ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (let i = 0; i < tracks.length; i += 1) {
      const trackTag = tracks[i]!;
      const y = TOP_PAD + i * TRACK_HEIGHT + TRACK_HEIGHT / 2;

      ctx.strokeStyle = `${border}80`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + TRACK_HEIGHT / 2);
      ctx.lineTo(size.width, y + TRACK_HEIGHT / 2);
      ctx.stroke();

      ctx.fillStyle = muted;
      ctx.textAlign = "left";
      ctx.fillText(regionLabel(trackTag), 12, y);
    }

    // Time-axis verticals (zoom-dependent density)
    const visibleRange = x.domain();
    const spanYears = visibleRange[1]! - visibleRange[0]!;
    let tickStep: number;
    if (spanYears > 4000) tickStep = 1000;
    else if (spanYears > 1500) tickStep = 500;
    else if (spanYears > 600) tickStep = 100;
    else if (spanYears > 200) tickStep = 50;
    else if (spanYears > 60) tickStep = 10;
    else tickStep = 5;

    ctx.strokeStyle = `${border}60`;
    ctx.lineWidth = 1;
    const firstTick = Math.ceil(visibleRange[0]! / tickStep) * tickStep;
    for (let yr = firstTick; yr <= visibleRange[1]!; yr += tickStep) {
      const px = x(yr);
      if (px < TRACK_LABEL_WIDTH || px > size.width - RIGHT_PAD) continue;
      ctx.beginPath();
      ctx.moveTo(px, TOP_PAD - 4);
      ctx.lineTo(px, innerHeight - BOTTOM_PAD + 4);
      ctx.stroke();
    }

    // Entity bars
    for (let i = 0; i < tracks.length; i += 1) {
      const trackTag = tracks[i]!;
      const evs = eventsByTrack.get(trackTag) ?? [];
      const yCenter = TOP_PAD + i * TRACK_HEIGHT + TRACK_HEIGHT / 2;

      for (const ev of evs) {
        const x1 = x(ev.dateStart);
        const x2 = ev.dateEnd != null ? x(ev.dateEnd) : x1;
        const w = Math.max(0, x2 - x1);

        const isHover = hover?.event.qid === ev.qid;
        const fill = isHover ? fg : tierColor(ev.tier, accent, muted);

        if (w < 2) {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(x1, yCenter, POINT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = fill;
          const barY = yCenter - BAR_HEIGHT / 2;
          ctx.beginPath();
          ctx.roundRect(x1, barY, w, BAR_HEIGHT, BAR_HEIGHT / 2);
          ctx.fill();
        }
      }
    }

    // Gutter divider
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TRACK_LABEL_WIDTH, TOP_PAD - 12);
    ctx.lineTo(TRACK_LABEL_WIDTH, innerHeight - BOTTOM_PAD + 12);
    ctx.stroke();

    // Hint text in the top-left gutter
    ctx.fillStyle = muted;
    ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCROLL TO ZOOM · DRAG TO PAN", 12, 28);
  }, [
    transform,
    x,
    tracks,
    eventsByTrack,
    size,
    innerHeight,
    events.length,
    hover,
  ]);

  // SVG axis below
  useEffect(() => {
    const svg = axisRef.current;
    if (!svg) return;
    const muted = color("muted");
    select(svg).selectAll("*").remove();
    // Tick density adapts to width so labels don't collide. Each label is
    // ~70px wide ("3500 BCE"); aim for at most one tick per ~110px.
    const tickCount = Math.max(2, Math.min(10, Math.floor(size.width / 130)));
    const ax = axisBottom(x)
      .ticks(tickCount)
      .tickFormat((d: number | { valueOf(): number }) => fmtYear(Number(d)));
    const g = select(svg).append("g").attr("transform", `translate(0, 0)`).call(ax);
    g.selectAll("path,line").attr("stroke", muted).attr("opacity", 0.4);
    g.selectAll("text")
      .attr("fill", muted)
      .attr("font-family", "JetBrains Mono, ui-monospace, monospace")
      .attr("font-size", "10px")
      .attr("letter-spacing", "0.08em");
  }, [x, size.width]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const trackIdx = Math.floor((my - TOP_PAD) / TRACK_HEIGHT);
      if (trackIdx < 0 || trackIdx >= tracks.length) {
        setHover(null);
        return;
      }
      const trackTag = tracks[trackIdx]!;
      const evs = eventsByTrack.get(trackTag) ?? [];

      let best: TimelineEvent | null = null;
      let bestDist = Infinity;
      for (const ev of evs) {
        const x1 = x(ev.dateStart);
        const x2 = ev.dateEnd != null ? x(ev.dateEnd) : x1;
        const dist =
          mx >= x1 && mx <= x2
            ? 0
            : Math.min(Math.abs(mx - x1), Math.abs(mx - x2));
        if (dist < bestDist) {
          bestDist = dist;
          best = ev;
        }
      }
      if (best && bestDist < 18) {
        setHover({ event: best, x: e.clientX, y: e.clientY });
      } else {
        setHover(null);
      }
    },
    [tracks, eventsByTrack, x],
  );

  const handleClick = useCallback(() => {
    if (hover) router.push(`/entity/${hover.event.slug}`);
  }, [hover, router]);

  return (
    <div ref={wrapperRef} className="w-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
        style={{ cursor: hover ? "pointer" : "grab", display: "block" }}
      />
      <svg
        ref={axisRef}
        width={size.width}
        height={28}
        style={{ display: "block", marginTop: -BOTTOM_PAD }}
      />
      {hover && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 bg-card border border-border rounded text-sm shadow-lg max-w-xs"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="font-display text-base text-foreground leading-tight">
            {hover.event.name}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
            {hover.event.type}
            {" · "}
            {fmtYear(hover.event.dateStart, hover.event.dateStartPrecision)}
            {hover.event.dateEnd != null
              ? ` – ${fmtYear(hover.event.dateEnd, hover.event.dateEndPrecision)}`
              : ""}
            {hover.event.tier >= 1 ? ` · T${hover.event.tier}` : ""}
          </div>
          {hover.event.civTags.length > 0 && (
            <div className="font-mono text-[10px] text-accent/80 mt-1">
              {hover.event.civTags.map(regionLabel).join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
