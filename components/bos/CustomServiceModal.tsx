"use client";

import { useEffect, useState } from "react";

export function CustomServiceModal({
  pending,
  error,
  showPrice,
  requirePrice,
  onClose,
  onSave,
}: {
  pending?: boolean;
  error?: string;
  showPrice?: boolean;
  requirePrice?: boolean;
  onClose: () => void;
  onSave: (input: { name: string; price: string }) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (requirePrice && !(Number(price) > 0)) return;
    onSave({ name: trimmed, price: price.trim() });
  }

  return (
    <div className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="custom-service-title">
      <button type="button" className="crm-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="crm-modal__panel crm-modal__panel--narrow">
        <div className="crm-modal__head">
          <h3 id="custom-service-title">New service</h3>
          <button type="button" className="crm-modal__close" onClick={onClose} disabled={pending}>
            ×
          </button>
        </div>
        <p className="crm-modal__hint">Name it once — it stays in the Services list next time.</p>
        <form className="crm-add-form" onSubmit={submit}>
          <label className="crm-span-2">
            Service name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cable replacement"
              required
              autoFocus
            />
          </label>
          {showPrice ? (
            <label className="crm-span-2">
              Price {requirePrice ? "" : <span className="stock-optional">(optional)</span>}
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required={requirePrice}
              />
            </label>
          ) : null}
          {error ? <p className="crm-form-error crm-span-2">{error}</p> : null}
          <div className="crm-form-actions crm-span-2">
            <button type="button" className="crm-btn-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="crm-btn-primary" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
