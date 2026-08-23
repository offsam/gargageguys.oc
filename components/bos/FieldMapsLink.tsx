"use client";

import { useEffect, useState } from "react";
import { googleMapsFallbackUrl, mapsAppUrl } from "@/lib/field/maps";

/** Opens the phone’s native maps app (Apple on iOS, Google on Android/desktop). */
export function FieldMapsLink({
  address,
  className = "field-maps-link",
}: {
  address: string;
  className?: string;
}) {
  const [href, setHref] = useState(() => googleMapsFallbackUrl(address) || mapsAppUrl(address));

  useEffect(() => {
    const next = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? mapsAppUrl(address)
      : googleMapsFallbackUrl(address) || mapsAppUrl(address);
    setHref(next);
  }, [address]);

  if (!address.trim() || !href) return <span>{address || "—"}</span>;

  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {address}
    </a>
  );
}
