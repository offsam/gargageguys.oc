import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadServices, upsertService } from "@/lib/field/service-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const services = await loadServices();
  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      unitPrice: (s.unitPriceCents / 100).toFixed(2),
      unitPriceCents: s.unitPriceCents,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    price?: string | number;
    category?: string;
  };
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const dollars = Number(body.price || 0);
  const existing = (await loadServices()).find((s) => s.name.toLowerCase() === name.toLowerCase());
  const allowPrice = user.role !== "technician" || !existing;
  const service = await upsertService({
    name,
    category: String(body.category || "Service").trim() || "Service",
    unitPriceCents:
      allowPrice && Number.isFinite(dollars) && String(body.price ?? "").trim() !== ""
        ? Math.round(dollars * 100)
        : undefined,
  });
  return NextResponse.json({
    ok: true,
    service: {
      id: service.id,
      name: service.name,
      category: service.category,
      unitPrice: (service.unitPriceCents / 100).toFixed(2),
      unitPriceCents: service.unitPriceCents,
    },
  });
}
