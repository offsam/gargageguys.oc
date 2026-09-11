"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { FIELD_BASEMAP_URL, OC_MAP_CENTER, type GeoPoint } from "@/lib/field/maps";

export type FieldMapPin = {
  id: string;
  title: string;
  label: string;
  href: string;
  point: GeoPoint;
  status?: string;
};

type Props = {
  pins: FieldMapPin[];
  focusId?: string | null;
  showLegend?: boolean;
  showLocate?: boolean;
  /** Last known tech GPS from server (shown until live GPS arrives). */
  lastKnownTech?: GeoPoint | null;
  lastKnownTechAt?: string | null;
};

function pinTone(status?: string): "wait" | "active" | "done" | "cancel" {
  if (status === "done") return "done";
  if (status === "cancelled") return "cancel";
  if (status === "en_route" || status === "on_site") return "active";
  return "wait";
}

function pinHtml(tone: ReturnType<typeof pinTone>, focus: boolean): string {
  const mark =
    tone === "done"
      ? `<span class="field-map-pin__mark">✓</span>`
      : tone === "cancel"
        ? `<span class="field-map-pin__mark">×</span>`
        : "";
  return `<span class="field-map-pin__dot field-map-pin__dot--${tone}${focus ? " is-focus" : ""}">${mark}</span>`;
}

export function FieldDayMap({
  pins,
  focusId = null,
  showLegend = false,
  showLocate = false,
  lastKnownTech = null,
  lastKnownTechAt = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const hasLiveFixRef = useRef(false);
  const pinKey = useMemo(
    () =>
      pins
        .map(
          (p) =>
            `${p.id}:${p.status || ""}:${p.point.lat.toFixed(5)},${p.point.lng.toFixed(5)}`,
        )
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

        L.tileLayer(FIELD_BASEMAP_URL, {
          maxZoom: 16,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);
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

      const latLngs: Array<[number, number]> = [];
      for (const pin of pins) {
        const tone = pinTone(pin.status);
        const isFocus = focusId === pin.id;
        const icon = L.divIcon({
          className: `field-map-pin field-map-pin--${tone}${isFocus ? " field-map-pin--focus" : ""}`,
          html: pinHtml(tone, isFocus),
          iconSize: [28, 36],
          iconAnchor: [14, 34],
        });
        const marker = L.marker([pin.point.lat, pin.point.lng], {
          icon,
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
    if (!showLocate) return;
    let watchId: number | null = null;
    let cancelled = false;
    hasLiveFixRef.current = false;

    async function placeUser(lat: number, lng: number, live: boolean) {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (live) hasLiveFixRef.current = true;
      const icon = L.divIcon({
        className: live ? "field-map-user" : "field-map-user field-map-user--stale",
        html: `<span class="field-map-user__pulse"></span><span class="field-map-user__dot"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
        userMarkerRef.current.setIcon(icon);
      } else {
        userMarkerRef.current = L.marker([lat, lng], { icon, interactive: false }).addTo(map);
      }
    }

    if (lastKnownTech && !hasLiveFixRef.current) {
      void placeUser(lastKnownTech.lat, lastKnownTech.lng, false);
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void placeUser(pos.coords.latitude, pos.coords.longitude, true);
        },
        () => {
          /* permission denied — keep last known */
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
      );
    }

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [showLocate, pinKey, lastKnownTech?.lat, lastKnownTech?.lng]);

  useEffect(() => {
    return () => {
      for (const [, marker] of markersRef.current) {
        marker.remove();
      }
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="field-day-map">
      <div ref={containerRef} className="field-day-map__canvas" role="img" aria-label="Job map" />
      {showLegend ? (
        <ul className="field-map-legend" aria-label="Map legend">
          <li>
            <span className="field-map-legend__swatch field-map-legend__swatch--wait" />
            Waiting
          </li>
          <li>
            <span className="field-map-legend__swatch field-map-legend__swatch--active" />
            On the way
          </li>
          <li>
            <span className="field-map-legend__swatch field-map-legend__swatch--done" />
            Completed
          </li>
          <li>
            <span className="field-map-legend__swatch field-map-legend__swatch--you" />
            You
          </li>
        </ul>
      ) : null}
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
