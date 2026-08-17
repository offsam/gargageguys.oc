"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveServicePriceAction, upsertServiceAction } from "@/app/actions/services";
import type { FieldService } from "@/lib/field/services-catalog";

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function PriceCell({
  itemId,
  cents,
  onSaved,
}: {
  itemId: string;
  cents: number;
  onSaved: (itemId: string, cents: number) => void;
}) {
  const [value, setValue] = useState(money(cents));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(money(cents));
  }, [cents]);

  function commit() {
    const dollars = Number(value);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setValue(money(cents));
      return;
    }
    const nextCents = Math.round(dollars * 100);
    if (nextCents === cents) {
      setValue(money(cents));
      return;
    }
    setValue(money(nextCents));
    onSaved(itemId, nextCents);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("itemId", itemId);
      fd.set("unitCost", money(nextCents));
      await saveServicePriceAction(fd);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    });
  }

  return (
    <label className={`stock-cost ${pending ? "pending" : ""} ${saved ? "saved" : ""}`}>
      <span>$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Service price"
      />
    </label>
  );
}

export function ServicesBoard({
  services,
  showPrices,
  canManage,
}: {
  services: FieldService[];
  showPrices: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [pending, startTransition] = useTransition();
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(services.map((s) => [s.id, s.unitPriceCents])),
  );

  useEffect(() => {
    setPrices(Object.fromEntries(services.map((s) => [s.id, s.unitPriceCents])));
  }, [services]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = services.filter((s) => {
      if (!needle) return true;
      return `${s.name} ${s.category}`.toLowerCase().includes(needle);
    });
    const map = new Map<string, FieldService[]>();
    for (const service of list) {
      const cat = service.category || "Service";
      const group = map.get(cat) || [];
      group.push(service);
      map.set(cat, group);
    }
    return [...map.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({
        cat,
        items: (map.get(cat) || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [q, services]);

  function submitNew(form: HTMLFormElement) {
    setAddError("");
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await upsertServiceAction(fd);
      if (!result.ok) {
        setAddError(result.error || "Could not add service");
        return;
      }
      form.reset();
      setAddOpen(false);
      router.refresh();
    });
  }

  const colSpan = showPrices ? 2 : 1;

  return (
    <div className="stock-board">
      <div className="stock-toolbar">
        <input
          className="stock-search"
          type="search"
          placeholder="Search service…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={!addOpen}
        />
        {canManage ? (
          <button
            type="button"
            className="stock-add-btn"
            aria-label="Add service"
            aria-expanded={addOpen}
            onClick={() => {
              setAddError("");
              setAddOpen((open) => !open);
            }}
          >
            +
          </button>
        ) : null}
        <span className="stock-meta">
          {groups.reduce((sum, g) => sum + g.items.length, 0)}/{services.length}
          {pending ? " · saving…" : ""}
        </span>
      </div>

      {addOpen && canManage ? (
        <form
          className="stock-add-form bos-card"
          onSubmit={(e) => {
            e.preventDefault();
            submitNew(e.currentTarget);
          }}
        >
          <div className="emp-create-head">
            <h3>New service</h3>
            <button type="button" className="emp-cancel" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
          <label>
            Name
            <input name="name" required autoFocus placeholder="Cable replacement" />
          </label>
          {showPrices ? (
            <label>
              Price <span className="stock-optional">(optional)</span>
              <input name="unitCost" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" />
            </label>
          ) : null}
          {addError ? <p className="stock-add-error">{addError}</p> : null}
          <button type="submit" className="emp-add-btn" disabled={pending}>
            Add service
          </button>
        </form>
      ) : null}

      <div className="stock-wrap stock-services-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th className="stock-col-item">Service</th>
              {showPrices ? <th className="stock-col-cost">Price</th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ cat, items }) => (
              <Fragment key={cat}>
                <tr className="stock-cat">
                  <td colSpan={colSpan}>{cat}</td>
                </tr>
                {items.map((service) => (
                  <tr key={service.id}>
                    <td className="stock-col-item">
                      <span className="stock-name">{service.name}</span>
                    </td>
                    {showPrices ? (
                      <td className="stock-col-cost">
                        <PriceCell
                          itemId={service.id}
                          cents={prices[service.id] ?? service.unitPriceCents}
                          onSaved={(id, next) => setPrices((prev) => ({ ...prev, [id]: next }))}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </Fragment>
            ))}
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="stock-empty">
                  {q ? `Nothing matches “${q}”` : "No services yet — add one with +"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
