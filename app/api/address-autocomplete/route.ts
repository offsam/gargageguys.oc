import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { mapGeoapifyFeatures } from "@/lib/geoapify/autocomplete";

const OC_BIAS = "-117.8677,33.7455";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const key = process.env.GEOAPIFY_API_KEY || "";
  if (!key) {
    return NextResponse.json({ error: "Address lookup is not configured" }, { status: 503 });
  }

  const text = String(request.nextUrl.searchParams.get("q") || "").trim();
  if (text.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", text.slice(0, 120));
  url.searchParams.set("apiKey", key);
  url.searchParams.set("filter", "countrycode:us");
  url.searchParams.set("bias", `proximity:${OC_BIAS}`);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ suggestions: mapGeoapifyFeatures(data) });
}
