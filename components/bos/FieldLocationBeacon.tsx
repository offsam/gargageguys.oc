"use client";

import { useEffect, useRef } from "react";

const MIN_INTERVAL_MS = 45_000;
const MIN_MOVE_M = 25;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * While Field is open, stream GPS to the server so the map can show
 * live or last-known technician position.
 */
export function FieldLocationBeacon({ enabled }: { enabled: boolean }) {
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    let watchId: number | null = null;

    async function send(lat: number, lng: number, accuracyM: number | null) {
      const now = Date.now();
      const prev = lastSentRef.current;
      if (prev) {
        const moved = haversineM(prev, { lat, lng });
        if (moved < MIN_MOVE_M && now - prev.at < MIN_INTERVAL_MS) return;
      }
      lastSentRef.current = { lat, lng, at: now };
      try {
        await fetch("/api/field/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, accuracyM }),
          keepalive: true,
        });
      } catch {
        /* ignore network blips */
      }
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        void send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null);
      },
      () => {
        /* permission denied / unavailable — map falls back to last known */
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 20_000 },
    );

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return null;
}
