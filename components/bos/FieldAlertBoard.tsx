"use client";

import type { ReactNode } from "react";

export function FieldAlertJump({
  jobs,
  stock,
  recalls,
}: {
  jobs: number;
  stock: number;
  recalls: number;
}) {
  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="field-jump" aria-label="Alert categories">
      <JumpChip count={jobs} label="Jobs" onClick={() => jump("alert-jobs")} />
      <JumpChip count={stock} label="Stock" onClick={() => jump("alert-stock")} />
      <JumpChip count={recalls} label="Recalls" onClick={() => jump("alert-recalls")} />
    </nav>
  );
}

function JumpChip({
  count,
  label,
  onClick,
}: {
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="field-jump-chip" onClick={onClick}>
      <strong>{count}</strong>
      <span>{label}</span>
    </button>
  );
}

export function FieldAlertSection({
  id,
  title,
  empty,
  children,
}: {
  id: string;
  title: string;
  empty?: string;
  children?: ReactNode;
}) {
  const hasKids = Boolean(children);
  return (
    <section id={id} className="field-alert-section">
      <h2>{title}</h2>
      {hasKids ? <div className="field-chip-row">{children}</div> : <p className="field-chip-empty">{empty || "Empty"}</p>}
    </section>
  );
}
