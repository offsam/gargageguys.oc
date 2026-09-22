"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BLANK = "(blank)";

export function sheetFilterBlankLabel() {
  return BLANK;
}

/** Normalize a cell for Excel-style value filters. */
export function normalizeFilterValue(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v || BLANK;
}

type Props = {
  label: string;
  /** Distinct values available for this column (already sorted). */
  options: string[];
  /**
   * Selected values. `null` = no filter (show all).
   * Non-null = only rows whose cell is in this list.
   */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
};

export function SheetColumnFilterControl({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(options));
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const active = value != null;
  const selectedCount = value?.length ?? options.length;

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  function placePanel() {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(220, Math.min(320, Math.max(rect.width + 40, 240)));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const top = rect.bottom + 4;
    setBox({ top, left, width });
  }

  function openPanel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(new Set(value ?? options));
    setQuery("");
    placePanel();
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  function toggle(opt: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  }

  function selectAllVisible() {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const opt of visibleOptions) next.add(opt);
      return next;
    });
  }

  function clearVisible() {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const opt of visibleOptions) next.delete(opt);
      return next;
    });
  }

  function apply() {
    if (draft.size === 0) {
      // Nothing selected → empty result set (explicit empty filter)
      onChange([]);
      closePanel();
      return;
    }
    if (draft.size >= options.length && options.every((o) => draft.has(o))) {
      onChange(null);
      closePanel();
      return;
    }
    onChange([...draft]);
    closePanel();
  }

  function clearFilter() {
    onChange(null);
    closePanel();
  }

  useEffect(() => {
    if (!open) return;

    function onDoc(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      closePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    function onReposition() {
      placePanel();
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const allVisibleChecked =
    visibleOptions.length > 0 && visibleOptions.every((o) => draft.has(o));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`sheet-col-filter-btn${active ? " is-active" : ""}`}
        aria-label={`Filter ${label}`}
        aria-expanded={open}
        title={
          active
            ? `Filtered · ${selectedCount} value${selectedCount === 1 ? "" : "s"}`
            : `Filter ${label}`
        }
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={openPanel}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <path
            fill="currentColor"
            d="M2 3.5h12l-4.5 5.2V13l-3-1.5V8.7L2 3.5z"
          />
        </svg>
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              className="sheet-col-filter-panel"
              style={{ top: box.top, left: box.left, width: box.width }}
              role="dialog"
              aria-label={`Filter ${label}`}
            >
              <div className="sheet-col-filter-head">
                <strong>Filter · {label}</strong>
                {active ? (
                  <button type="button" className="sheet-col-filter-link" onClick={clearFilter}>
                    Clear
                  </button>
                ) : null}
              </div>
              <input
                className="sheet-col-filter-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search values…"
                autoFocus
              />
              <div className="sheet-col-filter-actions">
                <button type="button" className="sheet-col-filter-link" onClick={selectAllVisible}>
                  Select all
                </button>
                <button type="button" className="sheet-col-filter-link" onClick={clearVisible}>
                  Clear
                </button>
              </div>
              <label className="sheet-col-filter-item sheet-col-filter-item--all">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={() => {
                    if (allVisibleChecked) clearVisible();
                    else selectAllVisible();
                  }}
                />
                <span>(Select All)</span>
              </label>
              <div className="sheet-col-filter-list" role="listbox" aria-multiselectable>
                {visibleOptions.length === 0 ? (
                  <div className="sheet-col-filter-empty">No values</div>
                ) : (
                  visibleOptions.map((opt) => (
                    <label key={opt} className="sheet-col-filter-item">
                      <input
                        type="checkbox"
                        checked={draft.has(opt)}
                        onChange={() => toggle(opt)}
                      />
                      <span title={opt}>{opt}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="sheet-col-filter-foot">
                <button type="button" className="sheet-col-filter-cancel" onClick={closePanel}>
                  Cancel
                </button>
                <button type="button" className="sheet-col-filter-ok" onClick={apply}>
                  OK
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
