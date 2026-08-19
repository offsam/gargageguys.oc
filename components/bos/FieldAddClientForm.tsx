"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createFieldClientJobAction } from "@/app/actions/field";
import { AddressAutocomplete } from "@/components/bos/AddressAutocomplete";
import { CustomServiceModal } from "@/components/bos/CustomServiceModal";
import { upsertServiceAction } from "@/app/actions/services";
import {
  CUSTOM_SERVICE_LABEL,
  isCustomServiceChoice,
  type FieldService,
} from "@/lib/field/services-catalog";
import { money } from "@/lib/field/job-invoice-types";
import { applyServicePriceToJobCost } from "@/lib/sheet/money";
import { WORK_SOURCES } from "@/lib/sheet/work-source";

const LEAD_SOURCES = ["Facebook", "Google", "Website", "Referral", "Thumbtack", "Yelp"] as const;
const PAYMENT_TYPES = ["", "Credit Card", "Venmo", "Zelle", "Cash", "Check"] as const;

function defaultVisitLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function FieldAddClientForm({
  fullForm = false,
  defaultTechnician = "",
  technicians = [],
  partners = [],
  services = [],
}: {
  fullForm?: boolean;
  defaultTechnician?: string;
  technicians?: Array<{ id: string; name: string }>;
  partners?: Array<{ name: string }>;
  services?: FieldService[];
}) {
  const router = useRouter();
  const defaultVisit = useMemo(() => defaultVisitLocal(), []);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [workSource, setWorkSource] = useState("Garage Guys");
  const [service, setService] = useState("");
  const [jobCost, setJobCost] = useState("");
  const [extraServices, setExtraServices] = useState<FieldService[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customError, setCustomError] = useState("");

  const catalog = useMemo(() => {
    const map = new Map<string, FieldService>();
    for (const item of [...services, ...extraServices]) {
      if (!item?.name) continue;
      map.set(item.name.toLowerCase(), item);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [services, extraServices]);

  const priceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of catalog) {
      if (item.unitPriceCents > 0) map.set(item.name.toLowerCase(), item.unitPriceCents / 100);
    }
    return map;
  }, [catalog]);

  function pickService(raw: string) {
    if (isCustomServiceChoice(raw)) {
      setCustomError("");
      setCustomOpen(true);
      return;
    }
    const next = raw.trim();
    setJobCost((prev) => applyServicePriceToJobCost(prev, service, next, priceByName));
    setService(next);
  }

  function onSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createFieldClientJobAction(formData);
      if (!result.ok) {
        setError(result.error || "Failed");
        return;
      }
      router.push(`/field/jobs/${result.jobId}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className={`field-form${fullForm ? " field-form--full" : ""}`}>
      {error ? <div className="field-form-error">{error}</div> : null}

      {fullForm ? (
        <>
          <label>
            <span>Work source</span>
            <select
              name="workSource"
              value={workSource}
              onChange={(e) => setWorkSource(e.target.value)}
              disabled={pending}
            >
              {WORK_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
            {workSource !== "Partner" ? <input type="hidden" name="partnerName" value="" /> : null}
          </label>
          {workSource === "Partner" ? (
            <label>
              <span>Partner</span>
              <input name="partnerName" list="field-partners" placeholder="Company name" disabled={pending} />
              <datalist id="field-partners">
                {partners.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
            </label>
          ) : null}
        </>
      ) : null}

      <label>
        <span>Client name</span>
        <input name="name" required autoFocus disabled={pending} />
      </label>
      <label>
        <span>Phone</span>
        <input name="phone" type="tel" required disabled={pending} />
      </label>
      <label>
        <span>Address</span>
        <AddressAutocomplete
          name="address"
          value={address}
          onChange={setAddress}
          onSelect={(item) => {
            setAddress(item.label);
            if (item.zip) setZip(item.zip);
          }}
          placeholder="Start typing address…"
          disabled={pending}
          required
        />
      </label>
      <label>
        <span>ZIP</span>
        <input name="zip" value={zip} onChange={(e) => setZip(e.target.value)} disabled={pending} />
      </label>

      {fullForm ? (
        <>
          <label>
            <span>Lead source</span>
            <input name="leadSource" list="field-lead-sources" placeholder="Pick or type…" disabled={pending} />
            <datalist id="field-lead-sources">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Lead cost</span>
            <input name="leadCost" inputMode="decimal" disabled={pending} />
          </label>
          <label>
            <span>Issue</span>
            <input name="jobType" placeholder="What the client said" disabled={pending} />
          </label>
          <label>
            <span>Service</span>
            <input type="hidden" name="service" value={service} />
            <select
              value={service}
              onChange={(e) => pickService(e.target.value)}
              disabled={pending}
            >
              <option value="">Service…</option>
              {catalog.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.unitPriceCents ? ` · ${money(s.unitPriceCents)}` : ""}
                </option>
              ))}
              <option value={CUSTOM_SERVICE_LABEL}>{CUSTOM_SERVICE_LABEL}</option>
            </select>
          </label>
          <label>
            <span>Parts</span>
            <input name="parts" placeholder="From stock or type…" disabled={pending} />
          </label>
          <label>
            <span>Parts cost</span>
            <input name="partsCost" inputMode="decimal" disabled={pending} />
          </label>
          <label>
            <span>Payment type</span>
            <select name="paymentType" disabled={pending}>
              {PAYMENT_TYPES.map((p) => (
                <option key={p || "empty"} value={p}>
                  {p || "—"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Check #</span>
            <input name="checkNumber" disabled={pending} />
          </label>
          <label>
            <span>Job cost</span>
            <input
              name="jobCost"
              value={jobCost}
              onChange={(e) => setJobCost(e.target.value)}
              inputMode="decimal"
              disabled={pending}
            />
          </label>
          <label>
            <span>Bank fee</span>
            <input name="bankFee" inputMode="decimal" disabled={pending} />
          </label>
          <label>
            <span>Technician</span>
            <select name="technician" defaultValue={defaultTechnician} disabled={pending}>
              <option value="">—</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tech salary</span>
            <input name="techSalary" inputMode="decimal" disabled={pending} />
          </label>
        </>
      ) : null}

      <label>
        <span>{fullForm ? "Description / problem" : "Problem"}</span>
        <textarea name="message" rows={3} disabled={pending} />
      </label>
      <label>
        <span>Visit time</span>
        <input
          name="startAt"
          type="datetime-local"
          required
          defaultValue={defaultVisit}
          disabled={pending}
        />
      </label>

      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create & schedule"}
      </button>
      <p className="field-muted">
        <Link href="/field">Cancel</Link>
      </p>

      {customOpen ? (
        <CustomServiceModal
          pending={pending}
          error={customError}
          showPrice
          onClose={() => {
            if (!pending) setCustomOpen(false);
          }}
          onSave={({ name, price }) => {
            setCustomError("");
            startTransition(async () => {
              const fd = new FormData();
              fd.set("name", name);
              if (price) fd.set("price", price);
              const result = await upsertServiceAction(fd);
              if (!result.ok) {
                setCustomError(result.error || "Could not save service");
                return;
              }
              setExtraServices((prev) => {
                const next = prev.filter((s) => s.id !== result.service.id);
                return [...next, result.service];
              });
              const prices = new Map(priceByName);
              if (result.service.unitPriceCents > 0) {
                prices.set(result.service.name.toLowerCase(), result.service.unitPriceCents / 100);
              }
              setJobCost((prev) =>
                applyServicePriceToJobCost(prev, service, result.service.name, prices),
              );
              setService(result.service.name);
              setCustomOpen(false);
            });
          }}
        />
      ) : null}
    </form>
  );
}
