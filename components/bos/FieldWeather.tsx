"use client";

import { useEffect, useState } from "react";

type WeatherState = {
  tempF: number;
  label: string;
  place: string;
};

/** Irvine / OC — Open-Meteo, no API key. */
const LAT = 33.6846;
const LNG = -117.8265;

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Storm";
  return "—";
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="#F5A623" />
      <path
        d="M12 2v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        stroke="#F5A623"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FieldWeather() {
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
      `&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.current) return;
        const temp = Math.round(Number(data.current.temperature_2m));
        const code = Number(data.current.weather_code);
        if (!Number.isFinite(temp)) return;
        setWeather({
          tempF: temp,
          label: weatherLabel(code),
          place: "Irvine, CA",
        });
      })
      .catch(() => {
        /* silent — chip stays hidden */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather) {
    return (
      <div className="field-weather field-weather--pending" aria-hidden>
        <SunIcon />
        <span className="field-weather__temp">—°</span>
        <span className="field-weather__place">Irvine, CA</span>
      </div>
    );
  }

  return (
    <div className="field-weather" title={weather.label}>
      <SunIcon />
      <span className="field-weather__temp">{weather.tempF}°</span>
      <span className="field-weather__place">{weather.place}</span>
    </div>
  );
}
