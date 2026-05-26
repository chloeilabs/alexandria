"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapMarker } from "@/lib/db/queries/map";
import { color, colorHex } from "@/lib/colors";
import { fmtYear } from "@/lib/format";

// Popup HTML is built via template strings and handed to
// maplibre-gl's setHTML, which renders unescaped. Entity names + type
// strings come from the DB (model output) and could in principle
// contain "<" / ">" — escape them before interpolation so a malicious
// or accidentally-marked-up value can't run script.
function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Props {
  markers: MapMarker[];
}

interface EmpireFeatureProps {
  id: string;
  name: string;
  peak_year: number;
  peak_label: string;
  slug: string;
}

// Muted, distinct colours for each empire — readable on the
// desaturated OSM background, no two confusable.
const EMPIRE_COLORS: Record<string, string> = {
  roman: "#c97e5b",
  han: "#d4a017",
  mongol: "#3a6ea5",
  songhai: "#b8842a",
  inca: "#5f8c61",
  maurya: "#7e5a8a",
  ottoman: "#a83232",
  achaemenid: "#3a8e8e",
};

export function HistoryMap({ markers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // `visibleLayers` is React state so the toggle UI re-renders.
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  // `empires` is loaded async from the GeoJSON so the toggle list
  // matches whatever is in the file.
  const [empires, setEmpires] = useState<EmpireFeatureProps[]>([]);
  const empiresRef = useRef<EmpireFeatureProps[]>([]);

  // Map setup (once)
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const accent = color("accent");
    const muted = color("muted");
    const bg = colorHex("background");

    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
        boundaries: {
          type: "geojson",
          data: "/historical-boundaries.geojson",
        },
      },
      layers: [
        {
          id: "bg",
          type: "background",
          paint: { "background-color": bg },
        },
        {
          id: "osm",
          type: "raster",
          source: "osm",
          paint: { "raster-opacity": 0.55, "raster-saturation": -0.7 },
        },
      ],
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [30, 25],
      zoom: 1.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "top-right",
    );

    map.on("load", async () => {
      // Add per-empire fill + line layers, hidden by default. We toggle
      // visibility from a React effect rather than re-creating layers.
      try {
        const r = await fetch("/historical-boundaries.geojson");
        const gj = (await r.json()) as {
          features: Array<{ properties: EmpireFeatureProps }>;
        };
        const list = gj.features.map((f) => f.properties);
        setEmpires(list);
        empiresRef.current = list;

        for (const emp of list) {
          const col = EMPIRE_COLORS[emp.id] ?? "#888";
          map.addLayer({
            id: `boundary-fill-${emp.id}`,
            type: "fill",
            source: "boundaries",
            filter: ["==", ["get", "id"], emp.id],
            paint: {
              "fill-color": col,
              "fill-opacity": 0.22,
            },
            layout: { visibility: "none" },
          });
          map.addLayer({
            id: `boundary-line-${emp.id}`,
            type: "line",
            source: "boundaries",
            filter: ["==", ["get", "id"], emp.id],
            paint: {
              "line-color": col,
              "line-width": 1.5,
              "line-opacity": 0.85,
            },
            layout: { visibility: "none" },
          });

          // Hover popup on the polygon — shows empire name + peak label.
          const popup = new maplibregl.Popup({
            closeButton: false,
            className: "library-map-popup",
          });
          map.on("mousemove", `boundary-fill-${emp.id}`, (e) => {
            map.getCanvas().style.cursor = "pointer";
            popup
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family: var(--font-display), Georgia, serif; font-size: 18px; line-height: 1.2; margin-bottom: 4px; color: var(--color-foreground);">${escapeHtml(emp.name)}</div>
                 <div style="font-family: JetBrains Mono, ui-monospace, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--color-muted-foreground);">${escapeHtml(emp.peak_label)}</div>`,
              )
              .addTo(map);
          });
          map.on("mouseleave", `boundary-fill-${emp.id}`, () => {
            map.getCanvas().style.cursor = "";
            popup.remove();
          });
        }
      } catch (err) {
        console.warn("[map] failed to load historical boundaries", err);
      }

      // Existing markers — unchanged from before.
      for (const m of markers) {
        const el = document.createElement("a");
        el.href = `/entity/${m.slug}`;
        el.setAttribute("aria-label", m.name);
        Object.assign(el.style, {
          display: "block",
          width: "13px",
          height: "13px",
          borderRadius: "50%",
          background: m.tier >= 2 ? accent : muted,
          border: `2px solid ${accent}`,
          boxShadow: "0 0 0 1px color-mix(in oklch, var(--color-foreground) 30%, transparent)",
          cursor: "pointer",
          opacity: m.tier >= 1 ? "0.95" : "0.6",
          transition: "transform 200ms ease-out",
        });
        el.onmouseenter = () => {
          el.style.transform = "scale(1.4)";
        };
        el.onmouseleave = () => {
          el.style.transform = "scale(1)";
        };

        const dateLine =
          m.dateStart != null
            ? ` · ${fmtYear(m.dateStart)}${m.dateEnd != null ? `–${fmtYear(m.dateEnd)}` : ""}`
            : "";

        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          className: "library-map-popup",
        }).setHTML(`
          <div style="font-family: var(--font-display), Georgia, serif; font-size: 18px; line-height: 1.2; margin-bottom: 4px; color: var(--color-foreground);">${escapeHtml(m.name)}</div>
          <div style="font-family: JetBrains Mono, ui-monospace, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--color-muted-foreground);">${escapeHtml(m.type)}${escapeHtml(dateLine)}</div>
        `);

        new maplibregl.Marker({ element: el })
          .setLngLat([m.longitude, m.latitude])
          .setPopup(popup)
          .addTo(map);

        el.onmouseover = () => popup.addTo(map);
        el.onmouseout = () => popup.remove();
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  // Visibility toggle (runs whenever `visibleLayers` changes).
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const list = empiresRef.current;
    if (list.length === 0) return;
    const apply = () => {
      for (const emp of list) {
        const v = visibleLayers.has(emp.id) ? "visible" : "none";
        const fillId = `boundary-fill-${emp.id}`;
        const lineId = `boundary-line-${emp.id}`;
        if (m.getLayer(fillId)) m.setLayoutProperty(fillId, "visibility", v);
        if (m.getLayer(lineId)) m.setLayoutProperty(lineId, "visibility", v);
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [visibleLayers]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 560 }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: 560 }}
      />
      <BoundaryPanel
        empires={empires}
        visible={visibleLayers}
        onToggle={(id) => {
          setVisibleLayers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onClear={() => setVisibleLayers(new Set())}
        onAll={() =>
          setVisibleLayers(new Set(empires.map((e) => e.id)))
        }
      />
    </div>
  );
}

function BoundaryPanel({
  empires,
  visible,
  onToggle,
  onClear,
  onAll,
}: {
  empires: EmpireFeatureProps[];
  visible: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  onAll: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (empires.length === 0) return null;

  return (
    <div
      className="absolute top-4 left-4 max-w-[16rem] bg-background/85 backdrop-blur border border-border rounded-sm shadow-lg"
      style={{ zIndex: 5 }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        aria-expanded={open}
      >
        <span>Empires at peak</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
          <ul className="px-3 pb-1 space-y-1">
            {empires
              .slice()
              .sort((a, b) => a.peak_year - b.peak_year)
              .map((emp) => {
                const isOn = visible.has(emp.id);
                const col = EMPIRE_COLORS[emp.id] ?? "#888";
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(emp.id)}
                      className="w-full flex items-center gap-2 py-1.5 text-left focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                      aria-pressed={isOn}
                    >
                      <span
                        className="inline-block w-3 h-3 shrink-0 border border-border"
                        style={{
                          background: isOn ? col : "transparent",
                          borderColor: col,
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className={
                          "flex-1 font-display text-sm transition-colors " +
                          (isOn
                            ? "text-foreground"
                            : "text-muted-foreground")
                        }
                      >
                        {emp.name}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        {emp.peak_year < 0
                          ? `${-emp.peak_year} BCE`
                          : `${emp.peak_year} CE`}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          <div className="px-3 pb-3 pt-1 flex items-center gap-3 border-t border-border/60">
            <button
              type="button"
              onClick={onAll}
              className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
            >
              all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
            >
              none
            </button>
          </div>
        </>
      )}
    </div>
  );
}
