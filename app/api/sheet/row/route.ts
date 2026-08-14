import { NextRequest, NextResponse } from "next/server";
import {
  deleteSheetRowAction,
  saveSheetRowAction,
  type SheetSaveInput,
} from "@/app/actions/sheet";

function str(record: Record<string, unknown>, key: string): string {
  return String(record[key] ?? "").trim();
}

function asSaveInput(body: unknown): SheetSaveInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const id = String(record.id ?? "");
  if (!id) return null;
  return {
    id,
    workSource: str(record, "workSource"),
    partnerName: str(record, "partnerName"),
    leadSource: str(record, "leadSource"),
    leadCost: str(record, "leadCost"),
    date: str(record, "date"),
    clientName: str(record, "clientName"),
    clientAddress: str(record, "clientAddress"),
    jobStatus: str(record, "jobStatus"),
    jobType: str(record, "jobType"),
    service: str(record, "service"),
    parts: str(record, "parts"),
    paymentType: str(record, "paymentType"),
    checkNumber: str(record, "checkNumber"),
    jobCost: str(record, "jobCost"),
    bankFee: str(record, "bankFee"),
    partsCost: str(record, "partsCost"),
    technician: str(record, "technician"),
    techSalary: str(record, "techSalary"),
    description: str(record, "description"),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input = asSaveInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Invalid row" }, { status: 400 });
  }
  const result = await saveSheetRowAction(input, { silent: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const result = await deleteSheetRowAction(id, { silent: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
