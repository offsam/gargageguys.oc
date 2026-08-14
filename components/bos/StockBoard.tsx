"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueToTechAction,
  receivePartnerStockAction,
  receiveStockAction,
  saveItemCostAction,
} from "@/app/actions/stock";

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
  const [costs, setCosts] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.unitCostCents])),
  );

  useEffect(() => {
    setCosts(Object.fromEntries(rows.map((r) => [r.id, r.unitCostCents])));
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

  const colSpan = partnerMode
    ? 2 + (showPrices ? 1 : 0) + (canManage ? 1 : 0)
    : 2 +
      (view === "master" || view === "warehouse" ? 1 : 0) +
      (view === "master" || view === "tech" ? 1 : 0) +
      (showPrices ? 1 : 0) +
      (canManage ? 1 : 0);

  return (
    <div className="stock-board">
      {!isTechOnly ? (
        <div className="stock-owner-block">
          <div className="stock-owner-tabs" role="tablist" aria-label="Stock owner">
            {(stockOwners.length ? stockOwners : [{ id: "gg", name: "Garage Guys" }]).map((owner) => (
              <a
                key={owner.id}
                href={owner.id === "gg" ? "/stock" : `/stock?owner=${owner.id}`}
                className={stockOwner === owner.id ? "active" : undefined}
              >
                {owner.name}
              </a>
            ))}
          </div>
          {notice ? <p className="stock-owner-hint">{notice}</p> : null}
          {!notice && partnerWarehouseCount < 1 ? (
            <p className="stock-owner-hint">
              This is Garage Guys stock (Master / Warehouse / vans). A partner tab appears after
              you set <strong>Own stock</strong> on Partners and Save.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isTechOnly && !partnerMode ? (
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
          placeholder="Search part…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {view === "tech" && !isTechOnly && !partnerMode ? (
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
        <span className="stock-meta">
          {filtered.length}/{rows.length}
          {showPrices ? ` · value $${money(inventoryValue)}` : ""}
          {pending ? " · saving…" : ""}
        </span>
      </div>

      <div className="stock-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th className="stock-col-item">Item</th>
              <th className="stock-col-num">{partnerMode ? "Qty" : "Master"}</th>
              {!partnerMode && (view === "master" || view === "warehouse") ? (
                <th className="stock-col-num">Wh</th>
              ) : null}
              {!partnerMode && (view === "master" || view === "tech") ? (
                <th className="stock-col-num">Van</th>
              ) : null}
              {showPrices ? <th className="stock-col-cost">Cost</th> : null}
              {canManage ? <th className="stock-col-act" /> : null}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ cat, items }) => (
              <Fragment key={cat}>
                <tr className="stock-cat">
                  <td colSpan={colSpan}>{cat}</td>
                </tr>
                {items.map((row) => {
                  const open = openActionId === row.id;
                  return (
                    <tr key={row.id} className={row.master === 0 ? "stock-zero" : undefined}>
                      <td className="stock-col-item">
                        <span className="stock-name">{row.name}</span>
                        {row.subcategory ? (
                          <span className="stock-sub">{row.subcategory}</span>
                        ) : null}
                      </td>
                      <td className="stock-col-num stock-master">{row.master}</td>
                      {!partnerMode && (view === "master" || view === "warehouse") ? (
                        <td className="stock-col-num">{row.warehouse}</td>
                      ) : null}
                      {!partnerMode && (view === "master" || view === "tech") ? (
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
                                <form action={(fd) => run(receivePartnerStockAction, fd)}>
                                  <input type="hidden" name="itemId" value={row.id} />
                                  <input type="hidden" name="partnerId" value={stockOwner} />
                                  <input name="qty" type="number" min={1} defaultValue={1} />
                                  <button type="submit">+ Stock</button>
                                </form>
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
            ))}
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
    </div>
  );
}
