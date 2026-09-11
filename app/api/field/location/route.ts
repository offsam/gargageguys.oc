import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getTechLocation, upsertTechLocation } from "@/lib/field/tech-location-store";

export const runtime = "nodejs";

/** POST — technician pings live/last GPS while Field is open. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "technician" && user.role !== "owner" && user.role !== "dispatcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { lat?: unknown; lng?: unknown; accuracyM?: unknown; technicianId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracyM = body.accuracyM == null ? null : Number(body.accuracyM);
  const technicianId =
    user.role === "technician"
      ? user.id
      : typeof body.technicianId === "string" && body.technicianId.trim()
        ? body.technicianId.trim()
        : user.id;

  if (user.role === "technician" && technicianId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const saved = await upsertTechLocation({ technicianId, lat, lng, accuracyM });
    return NextResponse.json({ ok: true, location: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET — own last known location (or ?technicianId= for staff). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("technicianId")?.trim() || "";
  const technicianId =
    user.role === "technician"
      ? user.id
      : requested || user.id;

  if (user.role === "technician" && technicianId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const location = await getTechLocation(technicianId);
  return NextResponse.json({ location });
}
