"use client";

import { useEffect, useRef, useState } from "react";
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
  const skipRef = useRef(false);
  const blurTimer = useRef<number | null>(null);

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

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        const next = data.suggestions || [];
        setItems(next);
        setOpen(next.length > 0);
      } catch {
        /* ignore network */
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [value, disabled, readOnly]);

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
          if (items.length) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setOpen(false);
            onBlur?.();
          }, 160);
        }}
      />
      {open && items.length ? (
        <ul className="addr-ac-list" role="listbox">
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
        </ul>
      ) : null}
    </div>
  );
}
