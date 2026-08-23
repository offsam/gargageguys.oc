"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { CARTO_POSITRON_URL, OC_MAP_CENTER, type GeoPoint } from "@/lib/field/maps";

export type FieldMapPin = {
  id: string;
  title: string;
  label: string;
  href: string;
  point: GeoPoint;
};

type Props = {
  pins: FieldMapPin[];
  /** When set, highlight this pin (e.g. selected client). */
  focusId?: string | null;
};

export function FieldDayMap({ pins, focusId = null }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const pinKey = useMemo(
    () =>
      pins
        .map((p) => `${p.id}:${p.point.lat.toFixed(5)},${p.point.lng.toFixed(5)}`)
        .join("|"),
    [pins],
  );

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      const el = containerRef.current;
      if (!el) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(el, {
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: false,
        }).setView([OC_MAP_CENTER.lat, OC_MAP_CENTER.lng], 11);

        L.tileLayer(CARTO_POSITRON_URL, {
          maxZoom: 19,
          subdomains: "abcd",
        }).addTo(map);

        L.control.zoom({ position: "topright" }).addTo(map);
        mapRef.current = map;

        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(el);
      }

      const map = mapRef.current;
      if (!map) return;

      for (const [, marker] of markersRef.current) {
        marker.remove();
      }
      markersRef.current.clear();

      const icon = L.divIcon({
        className: "field-map-pin",
        html: `<span class="field-map-pin__dot"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const focusIcon = L.divIcon({
        className: "field-map-pin field-map-pin--focus",
        html: `<span class="field-map-pin__dot"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const latLngs: Array<[number, number]> = [];
      for (const pin of pins) {
        const isFocus = focusId === pin.id;
        const marker = L.marker([pin.point.lat, pin.point.lng], {
          icon: isFocus ? focusIcon : icon,
          title: pin.title,
        });
        marker.bindPopup(
          `<a class="field-map-popup" href="${pin.href}">${escapeHtml(pin.label)}</a>`,
        );
        marker.addTo(map);
        markersRef.current.set(pin.id, marker);
        latLngs.push([pin.point.lat, pin.point.lng]);
      }

      map.invalidateSize();

      if (latLngs.length === 0) {
        map.setView([OC_MAP_CENTER.lat, OC_MAP_CENTER.lng], 11);
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], 14);
      } else {
        // Pad so ~2 pins read clearly in one map viewport.
        map.fitBounds(L.latLngBounds(latLngs), {
          padding: [36, 36],
          maxZoom: 14,
        });
      }
    }

    void setup();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [pinKey, focusId, pins]);

  useEffect(() => {
    return () => {
      for (const [, marker] of markersRef.current) {
        marker.remove();
      }
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="field-day-map">
      <div ref={containerRef} className="field-day-map__canvas" role="img" aria-label="Job map" />
      {pins.length === 0 ? (
        <p className="field-day-map__empty">Add addresses to see pins on the map.</p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
