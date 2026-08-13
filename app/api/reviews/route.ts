import { NextRequest, NextResponse } from "next/server";
import { getPublicReviewPayload } from "@/lib/reviews/store";
import type { ReviewSource } from "@/lib/reviews/store";

const ALLOWED_ORIGINS = new Set([
  "https://garageguysoc.com",
  "https://www.garageguysoc.com",
  "https://pullgaragedoor.com",
  "https://www.pullgaragedoor.com",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:3010",
  "http://127.0.0.1:3010",
]);

function withCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const sourceParam = request.nextUrl.searchParams.get("source");
  const source =
    sourceParam === "google" || sourceParam === "thumbtack"
      ? (sourceParam as ReviewSource)
      : undefined;

  const payload = await getPublicReviewPayload(source);
  return withCors(
    request,
    NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }),
  );
}
