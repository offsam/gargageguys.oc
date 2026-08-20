"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockPartOption } from "@/components/bos/SheetTable";
import {
  formatPartsLines,
  mergePartLines,
  type SheetPartLine,
} from "@/lib/sheet/parts-lines";

type Props = {
  open: boolean;
  catalog: StockPartOption[];
  initialLines: SheetPartLine[];
  title?: string;
  onClose: () => void;
  onApply: (lines: SheetPartLine[]) => void;
};

export function SheetPartsPicker({
  open,
  catalog,
  initialLines,
  title = "Parts",
  onClose,
  onApply,
}: Props) {
  const [qtyByName, setQtyByName] = useState<Record<string, number>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const line of initialLines) {
      if (line.name && line.qty > 0) next[line.name] = line.qty;
    }
    setQtyByName(next);
    setOpenCats({});
  }, [open, initialLines]);

  const categories = useMemo(() => {
    const map = new Map<string, StockPartOption[]>();
    for (const part of catalog) {
      if (!part.name) continue;
      const cat = (part.category || "Misc").trim() || "Misc";
      const list = map.get(cat) || [];
      list.push(part);
      map.set(cat, list);
    }
    return [...map.entries()]
      .map(([category, parts]) => ({
        category,
        parts: [...parts].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [catalog]);

  const selectedLines = useMemo(
    () =>
      mergePartLines(
        Object.entries(qtyByName)
          .filter(([, qty]) => qty > 0)
          .map(([name, qty]) => ({ name, qty })),
      ),
    [qtyByName],
  );

  function setQty(name: string, qty: number, stock?: number) {
    let next = Math.max(0, Math.floor(qty));
    if (typeof stock === "number" && Number.isFinite(stock)) {
      next = Math.min(next, Math.max(0, stock));
    }
    setQtyByName((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[name];
      else copy[name] = next;
      return copy;
    });
  }

  if (!open) return null;

  return (
    <div className="sheet-parts-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-parts-backdrop" onClick={onClose} aria-label="Close" />
      <div className="sheet-parts-modal">
        <header className="sheet-parts-head">
          <div>
            <strong>{title}</strong>
            <p>Pick parts by category. Use + / − for quantity.</p>
          </div>
          <button type="button" className="sheet-parts-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="sheet-parts-selected">
          {selectedLines.length ? (
            <span>{formatPartsLines(selectedLines)}</span>
          ) : (
            <span className="sheet-parts-muted">Nothing selected</span>
          )}
        </div>

        <div className="sheet-parts-body">
          {categories.map(({ category, parts }) => {
            const isOpen = Boolean(openCats[category]);
            const pickedInCat = parts.reduce((sum, p) => sum + (qtyByName[p.name] || 0), 0);
            return (
              <div key={category} className="sheet-parts-cat">
                <button
                  type="button"
                  className={`sheet-parts-cat-btn${isOpen ? " is-open" : ""}`}
                  onClick={() =>
                    setOpenCats((prev) => ({ ...prev, [category]: !prev[category] }))
                  }
                >
                  <span>{category}</span>
                  <span className="sheet-parts-cat-meta">
                    {pickedInCat > 0 ? `${pickedInCat} selected · ` : ""}
                    {parts.length}
                    <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                  </span>
                </button>
                {isOpen ? (
                  <ul className="sheet-parts-list">
                    {parts.map((part) => {
                      const qty = qtyByName[part.name] || 0;
                      const stock = part.qty;
                      return (
                        <li key={part.name} className={qty > 0 ? "is-picked" : undefined}>
                          <div className="sheet-parts-name">
                            <strong>{part.name}</strong>
                            <span>
                              {stock == null ? "—" : `in stock ${stock}`}
                              {part.unitCost ? ` · $${part.unitCost}` : ""}
                            </span>
                          </div>
                          <div className="sheet-parts-qty">
                            <button
                              type="button"
                              onClick={() => setQty(part.name, qty - 1, stock)}
                              disabled={qty <= 0}
                              aria-label={`Decrease ${part.name}`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={stock ?? undefined}
                              value={qty}
                              onChange={(e) =>
                                setQty(part.name, Number(e.target.value) || 0, stock)
                              }
                              aria-label={`${part.name} quantity`}
                            />
                            <button
                              type="button"
                              onClick={() => setQty(part.name, qty + 1, stock)}
                              disabled={stock != null && qty >= stock}
                              aria-label={`Increase ${part.name}`}
                            >
                              +
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <footer className="sheet-parts-foot">
          <button type="button" className="sheet-parts-clear" onClick={() => setQtyByName({})}>
            Clear
          </button>
          <div className="sheet-parts-foot-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sheet-parts-apply"
              onClick={() => onApply(selectedLines)}
            >
              Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
