import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { KnownClient } from "@/lib/sheet/known-client";

export type { KnownClient };

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ilikePattern(raw: string): string {
  return `%${raw.replace(/[%_]/g, " ").trim().slice(0, 80)}%`;
}

function rank(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const gap = n.indexOf(` ${q}`);
  if (gap >= 0) return 2;
  return 3;
}

function keyOf(name: string, address: string): string {
  return `${name.toLowerCase()}|${address.toLowerCase()}`;
}

export async function searchKnownClients(query: string): Promise<KnownClient[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const admin = getSupabaseAdmin();
  const pattern = ilikePattern(q);

  const [{ data: leads }, { data: customers }] = await Promise.all([
    admin
      .from("leads")
      .select("id, name, address, phone, zip, metadata, updated_at")
      .ilike("name", pattern)
      .order("updated_at", { ascending: false })
      .limit(40),
    admin
      .from("customers")
      .select("id, name, address, phone, zip, updated_at")
      .ilike("name", pattern)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const scored: Array<KnownClient & { rank: number; hasAddress: boolean; order: number }> = [];

  for (const [index, lead] of (leads || []).entries()) {
    const meta = asMeta(lead.metadata);
    const name = text(lead.name) || text(meta.clientName);
    if (!name) continue;
    const address = text(lead.address) || text(meta.clientAddress) || text(meta.address);
    scored.push({
      id: `lead:${lead.id}:${address || "none"}`,
      name,
      address,
      phone: text(lead.phone) || text(meta.phone),
      zip: text(lead.zip) || text(meta.zip),
      rank: rank(name, q),
      hasAddress: Boolean(address),
      order: index,
    });
  }

  for (const [index, customer] of (customers || []).entries()) {
    const name = text(customer.name);
    if (!name) continue;
    scored.push({
      id: `customer:${customer.id}`,
      name,
      address: text(customer.address),
      phone: text(customer.phone),
      zip: text(customer.zip),
      rank: rank(name, q),
      hasAddress: Boolean(text(customer.address)),
      order: 1000 + index,
    });
  }

  scored.sort((a, b) => a.rank - b.rank || Number(b.hasAddress) - Number(a.hasAddress) || a.order - b.order);

  const byName = new Map<string, { addressed: boolean }>();
  for (const row of scored) {
    const nameKey = row.name.toLowerCase();
    const prev = byName.get(nameKey);
    if (!prev) byName.set(nameKey, { addressed: row.hasAddress });
    else if (row.hasAddress) prev.addressed = true;
  }

  const seen = new Set<string>();
  const out: KnownClient[] = [];
  for (const row of scored) {
    const nameKey = row.name.toLowerCase();
    if (!row.hasAddress && byName.get(nameKey)?.addressed) continue;
    const dup = keyOf(row.name, row.address);
    if (seen.has(dup)) continue;
    seen.add(dup);
    out.push({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      zip: row.zip,
    });
    if (out.length >= 8) break;
  }

  return out;
}
