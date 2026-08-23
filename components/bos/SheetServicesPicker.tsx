"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatServiceLines,
  mergeServiceLines,
  type SheetServiceLine,
} from "@/lib/sheet/service-lines";

export type ServiceCatalogOption = {
  name: string;
  unitPrice: string;
  category: string;
};

type Props = {
  open: boolean;
  catalog: ServiceCatalogOption[];
  initialLines: SheetServiceLine[];
  title?: string;
  onClose: () => void;
  onApply: (lines: SheetServiceLine[]) => void;
  onAddCustom?: (selectedLines: SheetServiceLine[]) => void;
};

export function SheetServicesPicker({
  open,
  catalog,
  initialLines,
  title = "Services",
  onClose,
  onApply,
  onAddCustom,
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
    const map = new Map<string, ServiceCatalogOption[]>();
    for (const svc of catalog) {
      if (!svc.name) continue;
      const cat = (svc.category || "Other").trim() || "Other";
      const list = map.get(cat) || [];
      list.push(svc);
      map.set(cat, list);
    }
    return [...map.entries()]
      .map(([category, services]) => ({
        category,
        services: [...services].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [catalog]);

  const selectedLines = useMemo(
    () =>
      mergeServiceLines(
        Object.entries(qtyByName)
          .filter(([, qty]) => qty > 0)
          .map(([name, qty]) => ({ name, qty })),
      ),
    [qtyByName],
  );

  function setQty(name: string, qty: number) {
    const next = Math.max(0, Math.floor(qty));
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
            <p>Pick services by category. Use + / − for quantity.</p>
          </div>
          <button type="button" className="sheet-parts-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="sheet-parts-selected">
          {selectedLines.length ? (
            <span>{formatServiceLines(selectedLines)}</span>
          ) : (
            <span className="sheet-parts-muted">Nothing selected</span>
          )}
        </div>

        <div className="sheet-parts-body">
          {categories.map(({ category, services }) => {
            const isOpen = Boolean(openCats[category]);
            const pickedInCat = services.reduce((sum, s) => sum + (qtyByName[s.name] || 0), 0);
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
                    {services.length}
                    <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                  </span>
                </button>
                {isOpen ? (
                  <ul className="sheet-parts-list">
                    {services.map((svc) => {
                      const qty = qtyByName[svc.name] || 0;
                      return (
                        <li key={svc.name} className={qty > 0 ? "is-picked" : undefined}>
                          <div className="sheet-parts-name">
                            <strong>{svc.name}</strong>
                            <span>{svc.unitPrice ? `$${svc.unitPrice}` : "—"}</span>
                          </div>
                          <div className="sheet-parts-qty">
                            <button
                              type="button"
                              onClick={() => setQty(svc.name, qty - 1)}
                              disabled={qty <= 0}
                              aria-label={`Decrease ${svc.name}`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={qty}
                              onChange={(e) => setQty(svc.name, Number(e.target.value) || 0)}
                              aria-label={`${svc.name} quantity`}
                            />
                            <button
                              type="button"
                              onClick={() => setQty(svc.name, qty + 1)}
                              aria-label={`Increase ${svc.name}`}
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
          <div className="sheet-parts-foot-actions">
            {onAddCustom ? (
              <button
                type="button"
                className="sheet-parts-clear"
                onClick={() => onAddCustom(selectedLines)}
              >
                Add custom…
              </button>
            ) : null}
            <button type="button" className="sheet-parts-clear" onClick={() => setQtyByName({})}>
              Clear
            </button>
          </div>
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
