"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AddressSuggestion } from "@/lib/geoapify/autocomplete";

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  disabled,
  readOnly,
  className,
  placeholder,
  name,
  autoFocus,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  name?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
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
      width: Math.max(rect.width, 280),
    });
  }

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (disabled || readOnly || q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        const next = data.suggestions || [];
        setItems(next);
        if (next.length && document.activeElement === inputRef.current) {
          placeList();
          setOpen(true);
        }
      } catch {
        /* ignore abort/network */
      }
    }, 220);

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

  function pick(item: AddressSuggestion) {
    skipRef.current = true;
    setOpen(false);
    setItems([]);
    onChange(item.label);
    onSelect?.(item);
  }

  return (
    <div className="addr-ac">
      <input
        ref={inputRef}
        name={name}
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        required={required}
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
                <li key={item.label}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                  >
                    {item.label}
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
