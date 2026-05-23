"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapMarker } from "@/lib/db/queries/map";

interface Props {
  markers: MapMarker[];
}

function fmtYear(year: number | null): string {
  if (year == null) return "";
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}

function readCssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function HistoryMap({ markers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const accent = readCssColor("--color-accent", "#d6b066");
    const muted = readCssColor("--color-muted-foreground", "#a89d8a");

    // Minimal hand-rolled style using OSM raster tiles (no API key required).
    // For time-aware historical vector tiles, swap to OpenHistoricalMap when
    // we have a tile-server API key configured.
    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm",
        },
      ],
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [20, 25],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

    map.on("load", () => {
      for (const m of markers) {
        const el = document.createElement("a");
        el.href = `/entity/${m.slug}`;
        el.setAttribute("aria-label", m.name);
        Object.assign(el.style, {
          display: "block",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: m.tier >= 2 ? accent : muted,
          border: `2px solid ${accent}`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          cursor: "pointer",
          opacity: m.tier >= 1 ? "0.95" : "0.6",
          transition: "transform 200ms",
        });
        el.onmouseenter = () => {
          el.style.transform = "scale(1.4)";
        };
        el.onmouseleave = () => {
          el.style.transform = "scale(1)";
        };

        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          className: "library-map-popup",
        }).setHTML(`
          <div style="font-family: Cormorant Garamond, Georgia, serif; font-size: 18px; line-height: 1.2; margin-bottom: 4px;">${m.name}</div>
          <div style="font-family: JetBrains Mono, ui-monospace, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #a89d8a;">${m.type}${m.dateStart != null ? ` · ${fmtYear(m.dateStart)}${m.dateEnd != null ? `–${fmtYear(m.dateEnd)}` : ""}` : ""}</div>
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

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 560 }}
    />
  );
}
