"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStockItemAction,
  issueToTechAction,
  receivePartnerStockAction,
  receiveStockAction,
  saveItemCostAction,
} from "@/app/actions/stock";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";

export type StockRow = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  sku: string;
  master: number;
  warehouse: number;
  van: number;
  vans: Record<string, number>;
  unitCostCents: number;
};

type Tech = { id: string; label: string };

type View = "master" | "warehouse" | "tech";

const CATEGORY_ORDER = [
  "Motors",
  "Springs",
  "Misc",
  "Liftmaster",
  "Genie",
  "Marantec",
  "Hinges/Brackets",
];

function sortCategories(cats: string[]) {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function CostCell({
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
      await saveItemCostAction(fd);
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
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        aria-label="Unit cost"
      />
    </label>
  );
}

export function StockBoard({
  rows,
  technicians,
  selectedTechId: initialTechId,
  showPrices,
  canManage,
  isTechOnly,
  stockOwners = [],
  stockOwner = "gg",
  ownerTotals = {},
  partnerWarehouseCount = 0,
  notice = "",
}: {
  rows: StockRow[];
  technicians: Tech[];
  selectedTechId: string;
  showPrices: boolean;
  canManage: boolean;
  isTechOnly: boolean;
  stockOwners?: { id: string; name: string }[];
  stockOwner?: string;
  ownerTotals?: Record<string, number>;
  partnerWarehouseCount?: number;
  notice?: string;
}) {
  const router = useRouter();
  const partnerMode = stockOwner !== "gg";
  const [view, setView] = useState<View>(isTechOnly ? "tech" : "master");
  const [techId, setTechId] = useState(initialTechId);
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [costs, setCosts] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.unitCostCents])),
  );

  useEffect(() => {
    setCosts(Object.fromEntries(rows.map((r) => [r.id, r.unitCostCents])));
  }, [rows]);

  const categories = useMemo(() => {
    const fromRows = sortCategories([...new Set(rows.map((r) => r.category).filter(Boolean))]);
    const extra = CATEGORY_ORDER.filter((cat) => !fromRows.includes(cat));
    return [...fromRows, ...extra];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = `${r.name} ${r.sku} ${r.category} ${r.subcategory || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, StockRow[]>();
    for (const row of filtered) {
      const list = map.get(row.category) || [];
      list.push(row);
      map.set(row.category, list);
    }
    return sortCategories([...map.keys()]).map((cat) => ({
      cat,
      items: (map.get(cat) || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [filtered]);

  const serviceGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const services = FIELD_SERVICES.filter((s) => s.id !== "svc-custom").filter((s) => {
      if (!needle) return true;
      return `${s.name} ${s.category}`.toLowerCase().includes(needle);
    });
    const map = new Map<string, typeof services>();
    for (const service of services) {
      const list = map.get(service.category) || [];
      list.push(service);
      map.set(service.category, list);
    }
    return [...map.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({
        cat,
        items: (map.get(cat) || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [q]);

  const inventoryValue = useMemo(() => {
    if (!showPrices) return 0;
    return rows.reduce((sum, r) => sum + r.master * (costs[r.id] ?? r.unitCostCents), 0);
  }, [rows, costs, showPrices]);

  function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    startTransition(async () => {
      await action(fd);
      setOpenActionId(null);
      router.refresh();
    });
  }

  function ownerHref(ownerId: string) {
    const qs = new URLSearchParams();
    qs.set("owner", ownerId);
    if (initialTechId) qs.set("tech", initialTechId);
    return `/stock?${qs.toString()}`;
  }

  function submitNewItem(form: HTMLFormElement) {
    setAddError("");
    const fd = new FormData(form);
    if (partnerMode) fd.set("partnerId", stockOwner);
    startTransition(async () => {
      const result = await createStockItemAction(fd);
      if (!result.ok) {
        setAddError(result.error || "Could not add item");
        return;
      }
      form.reset();
      setAddOpen(false);
      router.refresh();
    });
  }

  const colSpan = isTechOnly
    ? 2 + (showPrices ? 1 : 0)
    : 2 +
      (view === "master" || view === "warehouse" ? 1 : 0) +
      (view === "master" || view === "tech" ? 1 : 0) +
      (showPrices ? 1 : 0) +
      (canManage ? 1 : 0);

  const showOwnerTabs = !isTechOnly || stockOwners.length > 1;
  const techVanOnly = isTechOnly;

  return (
    <div className="stock-board">
      {showOwnerTabs ? (
        <div className="stock-owner-block">
          <div className="stock-owner-tabs" role="tablist" aria-label="Stock owner">
            {(stockOwners.length ? stockOwners : [{ id: "gg", name: "Garage Guys" }]).map((owner) => (
              <a
                key={owner.id}
                href={ownerHref(owner.id)}
                role="tab"
                aria-selected={stockOwner === owner.id}
                className={stockOwner === owner.id ? "active" : undefined}
              >
                {owner.name}
                <span className="stock-owner-count">{ownerTotals[owner.id] ?? 0}</span>
              </a>
            ))}
          </div>
          {notice ? <p className="stock-owner-hint">{notice}</p> : null}
          {!notice && isTechOnly && partnerWarehouseCount > 0 ? (
            <p className="stock-owner-hint">
              Both stocks are on your van. Tabs are just to see counts. On a job you only pick
              from that client’s stock.
            </p>
          ) : null}
          {!notice && !isTechOnly && partnerWarehouseCount < 1 ? (
            <p className="stock-owner-hint">
              This is Garage Guys stock (Master / Warehouse / vans). A partner tab appears after
              you set <strong>Own stock</strong> on Partners and Save.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isTechOnly ? (
        <div className="stock-tabs" role="tablist">
          {(
            [
              ["master", "Master"],
              ["warehouse", "Warehouse"],
              ["tech", "Technicians"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={view === key ? "active" : undefined}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="stock-toolbar">
        <input
          className="stock-search"
          type="search"
          placeholder="Search part or service…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={!addOpen}
        />
        {view === "tech" && !isTechOnly ? (
          <select
            className="stock-tech-select"
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
          >
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : null}
        {canManage ? (
          <button
            type="button"
            className="stock-add-btn"
            aria-label="Add stock item"
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
          {filtered.length}/{rows.length}
          {showPrices ? ` · value $${money(inventoryValue)}` : ""}
          {pending ? " · saving…" : ""}
        </span>
      </div>

      {addOpen && canManage ? (
        <form
          className="stock-add-form bos-card"
          onSubmit={(e) => {
            e.preventDefault();
            submitNewItem(e.currentTarget);
          }}
        >
          <div className="emp-create-head">
            <h3>New item</h3>
            <button type="button" className="emp-cancel" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
          <label>
            Name
            <input name="name" required autoFocus placeholder="LM 8500 7-ft" />
          </label>
          <label>
            Category
            <select name="category" defaultValue={categories[0] || "Misc"}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            SKU <span className="stock-optional">(optional)</span>
            <input name="sku" placeholder="Auto if empty" />
          </label>
          {showPrices ? (
            <label>
              Cost
              <input name="unitCost" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" />
            </label>
          ) : null}
          <label>
            Qty in this stock
            <input name="qty" type="number" min="0" step="1" defaultValue="0" />
          </label>
          {addError ? <p className="stock-add-error">{addError}</p> : null}
          <button type="submit" className="emp-add-btn" disabled={pending}>
            Add item
          </button>
        </form>
      ) : null}

      <div className="stock-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th className="stock-col-item">Item</th>
              <th className="stock-col-num">{techVanOnly ? "Van" : "Master"}</th>
              {!techVanOnly && (view === "master" || view === "warehouse") ? (
                <th className="stock-col-num">Wh</th>
              ) : null}
              {!techVanOnly && (view === "master" || view === "tech") ? (
                <th className="stock-col-num">Van</th>
              ) : null}
              {showPrices ? <th className="stock-col-cost">Cost</th> : null}
              {canManage ? <th className="stock-col-act" /> : null}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ cat, items }) => {
              const categoryQty = items.reduce((sum, row) => {
                if (techVanOnly || view === "tech") {
                  return sum + (row.vans[techId] ?? row.van);
                }
                if (view === "warehouse") return sum + row.warehouse;
                return sum + row.master;
              }, 0);
              return (
              <Fragment key={cat}>
                <tr className="stock-cat">
                  <td colSpan={colSpan}>
                    <span className="stock-cat-row">
                      <span>{cat}</span>
                      <span className="stock-cat-total">{categoryQty}</span>
                    </span>
                  </td>
                </tr>
                {items.map((row) => {
                  const open = openActionId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={
                        (techVanOnly ? row.vans[techId] ?? row.van : row.master) === 0
                          ? "stock-zero"
                          : undefined
                      }
                    >
                      <td className="stock-col-item">
                        <span className="stock-name">{row.name}</span>
                        {row.subcategory ? (
                          <span className="stock-sub">{row.subcategory}</span>
                        ) : null}
                      </td>
                      <td className="stock-col-num stock-master">
                        {techVanOnly ? row.vans[techId] ?? row.van : row.master}
                      </td>
                      {!techVanOnly && (view === "master" || view === "warehouse") ? (
                        <td className="stock-col-num">{row.warehouse}</td>
                      ) : null}
                      {!techVanOnly && (view === "master" || view === "tech") ? (
                        <td className="stock-col-num">{row.vans[techId] ?? row.van}</td>
                      ) : null}
                      {showPrices ? (
                        <td className="stock-col-cost">
                          <CostCell
                            itemId={row.id}
                            cents={costs[row.id] ?? row.unitCostCents}
                            onSaved={(id, next) =>
                              setCosts((prev) => ({ ...prev, [id]: next }))
                            }
                          />
                        </td>
                      ) : null}
                      {canManage ? (
                        <td className="stock-col-act">
                          <button
                            type="button"
                            className="stock-act-toggle"
                            aria-expanded={open}
                            onClick={() => setOpenActionId(open ? null : row.id)}
                          >
                            ±
                          </button>
                          {open ? (
                            <div className="stock-act-pop">
                              {partnerMode ? (
                                <>
                                  <form action={(fd) => run(receivePartnerStockAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="partnerId" value={stockOwner} />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">+Wh</button>
                                  </form>
                                  <form action={(fd) => run(receiveStockAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="destination" value="tech" />
                                    <input type="hidden" name="technicianId" value={techId} />
                                    <input type="hidden" name="partnerId" value={stockOwner} />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">+Van</button>
                                  </form>
                                  <form action={(fd) => run(issueToTechAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="technicianId" value={techId} />
                                    <input type="hidden" name="partnerId" value={stockOwner} />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">Wh→Van</button>
                                  </form>
                                </>
                              ) : (
                                <>
                                  <form action={(fd) => run(receiveStockAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="destination" value="warehouse" />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">+Wh</button>
                                  </form>
                                  <form action={(fd) => run(receiveStockAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="destination" value="tech" />
                                    <input type="hidden" name="technicianId" value={techId} />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">+Van</button>
                                  </form>
                                  <form action={(fd) => run(issueToTechAction, fd)}>
                                    <input type="hidden" name="itemId" value={row.id} />
                                    <input type="hidden" name="technicianId" value={techId} />
                                    <input name="qty" type="number" min={1} defaultValue={1} />
                                    <button type="submit">Wh→Van</button>
                                  </form>
                                </>
                              )}
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </Fragment>
              );
            })}
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="stock-empty">
                  Nothing matches “{q}”
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="stock-services">
        <div className="stock-services-head">
          <h2>Services</h2>
          <span className="stock-meta">
            {serviceGroups.reduce((sum, g) => sum + g.items.length, 0)} listed · same list as Field
            invoice
          </span>
        </div>
        <div className="stock-wrap stock-services-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th className="stock-col-item">Service</th>
                <th className="stock-col-cost">Price</th>
              </tr>
            </thead>
            <tbody>
              {serviceGroups.map(({ cat, items }) => (
                <Fragment key={`svc-${cat}`}>
                  <tr className="stock-cat">
                    <td colSpan={2}>{cat}</td>
                  </tr>
                  {items.map((service) => (
                    <tr key={service.id}>
                      <td className="stock-col-item">
                        <span className="stock-name">{service.name}</span>
                      </td>
                      <td className="stock-col-cost stock-service-price">
                        {service.unitPriceCents > 0 ? `$${money(service.unitPriceCents)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {serviceGroups.length === 0 ? (
                <tr>
                  <td colSpan={2} className="stock-empty">
                    Nothing matches “{q}”
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
