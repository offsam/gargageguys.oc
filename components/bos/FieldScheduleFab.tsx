"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function FieldScheduleFab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div className="field-fab-root" ref={rootRef}>
      {open ? (
        <div className="field-fab-menu" role="menu" aria-label="Add to schedule">
          <Link
            href="/field/add"
            className="field-fab-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="field-fab-menu__glyph">+</span>
            <span>Add client</span>
          </Link>
          <Link
            href="/field/busy"
            className="field-fab-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="field-fab-menu__glyph">–</span>
            <span>I&apos;m busy</span>
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        className={`field-fab${open ? " is-open" : ""}`}
        aria-label="Add to schedule"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
