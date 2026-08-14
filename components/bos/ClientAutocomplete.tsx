"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KnownClient } from "@/lib/sheet/known-client";

export type { KnownClient };

export function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  disabled,
  readOnly,
  className,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (client: KnownClient) => void;
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KnownClient[]>([]);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const skipRef = useRef(false);
  const blurTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function placeList() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBox({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 320),
    });
  }

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (disabled || readOnly || q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/sheet/clients?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { clients?: KnownClient[] };
        const next = data.clients || [];
        setItems(next);
        if (next.length && document.activeElement === inputRef.current) {
          placeList();
          setOpen(true);
        }
      } catch {
        /* ignore abort/network */
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [value, disabled, readOnly]);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function reposition() {
      placeList();
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    };
  }, []);

  function pick(item: KnownClient) {
    skipRef.current = true;
    setOpen(false);
    setItems([]);
    onChange(item.name);
    onSelect?.(item);
  }

  return (
    <div className="addr-ac">
      <input
        ref={inputRef}
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (items.length) {
            placeList();
            setOpen(true);
          }
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setOpen(false);
            onBlur?.();
          }, 160);
        }}
      />
      {open && items.length && box
        ? createPortal(
            <ul
              className="addr-ac-list"
              role="listbox"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
              }}
            >
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(item)}>
                    <strong>{item.name}</strong>
                    <span>{item.address || "No address on file — fill after"}</span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
