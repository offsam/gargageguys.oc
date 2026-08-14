import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatJobNumber } from "@/lib/field/job-invoice-types";
import { sheetIssueFromLead, sheetServiceFromLead } from "@/lib/sheet/issue-service";
import { sheetStatusFromLead } from "@/lib/leads/stage-sync";

export type ClientListItem = {
  id: string;
  name: string;
  phones: string[];
  addresses: string[];
  jobCount: number;
  paidCents: number;
  lastDate: string;
};

export type ClientOrder = {
  leadId: string;
  date: string;
  jobNumber: string;
  issue: string;
  service: string;
  status: string;
  amountCents: number;
  paymentType: string;
  technician: string;
  address: string;
};

export type ClientProfile = ClientListItem & {
  orders: ClientOrder[];
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pick(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

export function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function clientIdFromName(name: string): string {
  return Buffer.from(normalizeClientName(name), "utf8").toString("base64url");
}

export function nameFromClientId(id: string): string | null {
  try {
    const decoded = Buffer.from(id, "base64url").toString("utf8").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function moneyToCents(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatClientDate(value: string): string {
  if (!value) return "—";
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return value;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type LeadRow = {
  id: string;
  customer_id: string | null;
  name: string | null;
  phone: string | null;
  zip: string | null;
  address: string | null;
  message: string | null;
  stage: string | null;
  deal_title: string | null;
  deal_price: string | null;
  lead_type: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

function leadName(lead: LeadRow): string {
  const meta = asMeta(lead.metadata);
  return text(lead.name) || pick(meta, "clientName", "client_name");
}

function leadPhone(lead: LeadRow): string {
  const meta = asMeta(lead.metadata);
  return text(lead.phone) || pick(meta, "phone");
}

function leadAddress(lead: LeadRow): string {
  const meta = asMeta(lead.metadata);
  return text(lead.address) || pick(meta, "clientAddress", "client_address", "address");
}

function leadAmountCents(lead: LeadRow): number {
  const meta = asMeta(lead.metadata);
  return moneyToCents(pick(meta, "jobCost", "job_cost") || text(lead.deal_price));
}

function leadDate(lead: LeadRow): string {
  const meta = asMeta(lead.metadata);
  const sheet = pick(meta, "sheetDate", "date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(sheet)) return sheet;
  return String(lead.created_at || "").slice(0, 10);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const v = value.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function orderFromLead(lead: LeadRow, jobNumber: string): ClientOrder {
  const meta = asMeta(lead.metadata);
  const status = sheetStatusFromLead({ stage: lead.stage, metadata: lead.metadata });
  const rawNumber = pick(meta, "jobNumber", "job_number");
  const fromMeta = /^\d+$/.test(rawNumber) ? formatJobNumber(Number(rawNumber)) : rawNumber;
  return {
    leadId: lead.id,
    date: leadDate(lead),
    jobNumber: jobNumber || (fromMeta && fromMeta !== "—" ? fromMeta : ""),
    issue: sheetIssueFromLead({
      metadata: meta,
      dealTitle: lead.deal_title,
      leadType: lead.lead_type,
      message: lead.message,
    }),
    service: sheetServiceFromLead(meta),
    status,
    amountCents: leadAmountCents(lead),
    paymentType: pick(meta, "paymentType", "payment_type"),
    technician: pick(meta, "technician", "tech_name"),
    address: leadAddress(lead),
  };
}

function profileFromParts(
  displayName: string,
  orders: ClientOrder[],
  phones: string[],
  addresses: string[],
): ClientProfile {
  const paidCents = orders
    .filter((order) => order.status === "Completed")
    .reduce((sum, order) => sum + order.amountCents, 0);
  const lastDate = orders.reduce((best, order) => (order.date > best ? order.date : best), "");
  return {
    id: clientIdFromName(displayName),
    name: displayName,
    phones: unique(phones),
    addresses: unique(addresses),
    jobCount: orders.length,
    paidCents,
    lastDate,
    orders: [...orders].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  };
}

async function loadLeads(): Promise<LeadRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, customer_id, name, phone, zip, address, message, stage, deal_title, deal_price, lead_type, metadata, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(800);
  if (error) throw error;
  return (data || []) as LeadRow[];
}

async function jobNumbersFor(leadIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(leadIds.filter(Boolean))];
  if (!ids.length) return map;
  const admin = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data } = await admin
      .from("jobs")
      .select("lead_id, job_number, status")
      .in("lead_id", slice)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    for (const job of data || []) {
      const leadId = String(job.lead_id || "");
      if (!leadId || map.has(leadId)) continue;
      const label = formatJobNumber(
        job.job_number == null || job.job_number === "" ? null : Number(job.job_number),
      );
      if (label !== "—") map.set(leadId, label);
    }
  }
  return map;
}

export async function loadClientDirectory(): Promise<ClientListItem[]> {
  const [leads, customersRes] = await Promise.all([
    loadLeads(),
    getSupabaseAdmin().from("customers").select("id, name, phone, address").limit(400),
  ]);

  const groups = new Map<
    string,
    { display: string; leads: LeadRow[]; phones: string[]; addresses: string[] }
  >();

  function bump(name: string, lead: LeadRow | null, phone: string, address: string) {
    const key = normalizeClientName(name);
    if (!key) return;
    let group = groups.get(key);
    if (!group) {
      group = { display: name.trim(), leads: [], phones: [], addresses: [] };
      groups.set(key, group);
    }
    if (lead) group.leads.push(lead);
    if (phone) group.phones.push(phone);
    if (address) group.addresses.push(address);
  }

  for (const lead of leads) {
    const name = leadName(lead);
    if (!name) continue;
    bump(name, lead, leadPhone(lead), leadAddress(lead));
  }

  for (const customer of customersRes.data || []) {
    const name = text(customer.name);
    if (!name) continue;
    bump(name, null, text(customer.phone), text(customer.address));
  }

  const items: ClientListItem[] = [];
  for (const group of groups.values()) {
    const orders = group.leads.map((lead) => orderFromLead(lead, ""));
    const profile = profileFromParts(group.display, orders, group.phones, group.addresses);
    items.push(profile);
  }

  items.sort((a, b) => {
    if (a.lastDate !== b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return items;
}

export async function loadClientProfile(id: string): Promise<ClientProfile | null> {
  const admin = getSupabaseAdmin();
  let key = "";
  let customerId = "";

  if (UUID.test(id)) {
    customerId = id;
    const { data: customer } = await admin
      .from("customers")
      .select("id, name, phone, address")
      .eq("id", id)
      .maybeSingle();
    if (customer?.name) key = normalizeClientName(customer.name);
  } else {
    key = nameFromClientId(id) || "";
  }
  if (!key && !customerId) return null;

  const leads = await loadLeads();
  const matched = leads.filter((lead) => {
    if (customerId && lead.customer_id === customerId) return true;
    const name = leadName(lead);
    return Boolean(name && normalizeClientName(name) === key);
  });

  const { data: customerRows } = await admin
    .from("customers")
    .select("id, name, phone, address")
    .limit(400);
  const customers = (customerRows || []).filter((row) => {
    if (customerId && row.id === customerId) return true;
    return Boolean(text(row.name) && normalizeClientName(row.name || "") === key);
  });

  if (!matched.length && !customers.length) return null;

  const numbers = await jobNumbersFor(matched.map((lead) => lead.id));
  const orders = matched.map((lead) => orderFromLead(lead, numbers.get(lead.id) || ""));
  const display =
    text(matched[0] && leadName(matched[0])) ||
    text(customers[0]?.name) ||
    key;
  return profileFromParts(
    display,
    orders,
    [...matched.map(leadPhone), ...customers.map((c) => text(c.phone))],
    [...matched.map(leadAddress), ...customers.map((c) => text(c.address))],
  );
}
