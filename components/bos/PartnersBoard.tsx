"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPartnerAction,
  deletePartnerAction,
  updatePartnerAction,
  type Partner,
} from "@/app/actions/partners";

export function PartnersBoard({
  partners: initial,
  canDelete,
}: {
  partners: Partner[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [techPercent, setTechPercent] = useState("30");
  const [hasOwnStock, setHasOwnStock] = useState(false);

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("name", name);
    fd.set("notes", notes);
    fd.set("techPercent", techPercent);
    fd.set("hasOwnStock", hasOwnStock ? "true" : "false");
    startTransition(async () => {
      const result = await createPartnerAction(fd);
      if (!result.ok) {
        setError(result.error || "Could not add partner");
        return;
      }
      setOpen(false);
      setName("");
      setNotes("");
      setTechPercent("30");
      setHasOwnStock(false);
      router.refresh();
    });
  }

  function savePartner(partner: Partner, form: HTMLFormElement) {
    setError("");
    const fd = new FormData(form);
    fd.set("id", partner.id);
    startTransition(async () => {
      const result = await updatePartnerAction(fd);
      if (!result.ok) {
        setError(result.error || "Could not save partner");
        return;
      }
      router.refresh();
    });
  }

  function removePartner(partner: Partner) {
    if (!canDelete) return;
    if (!window.confirm(`Delete partner “${partner.name}”?`)) return;
    const fd = new FormData();
    fd.set("id", partner.id);
    startTransition(async () => {
      const result = await deletePartnerAction(fd);
      if (!result.ok) {
        setError(result.error || "Could not delete partner");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="emp-toolbar">
        {!open ? (
          <button type="button" className="emp-add-btn" onClick={() => setOpen(true)}>
            + Add partner
          </button>
        ) : null}
        {pending ? <span className="field-muted">Saving…</span> : null}
      </div>

      {error ? <div className="login-card error" style={{ marginBottom: "0.75rem" }}>{error}</div> : null}

      {open ? (
        <form className="emp-create-form bos-card" onSubmit={submitCreate}>
          <div className="emp-create-head">
            <h3>New partner</h3>
            <button type="button" className="emp-cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <label>
            Company name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Champion Garage Doors Service"
              required
              autoFocus
            />
          </label>
          <label>
            Tech % of Gross
            <input
              value={techPercent}
              onChange={(e) => setTechPercent(e.target.value)}
              inputMode="decimal"
              placeholder="30"
            />
          </label>
          <fieldset className="partner-stock-pick">
            <legend>Stock</legend>
            <label>
              <input
                type="radio"
                name="newHasOwnStock"
                checked={!hasOwnStock}
                onChange={() => setHasOwnStock(false)}
              />
              Uses Garage Guys stock
            </label>
            <label>
              <input
                type="radio"
                name="newHasOwnStock"
                checked={hasOwnStock}
                onChange={() => setHasOwnStock(true)}
              />
              Has own stock
            </label>
          </fieldset>
          <label>
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <button type="submit" className="emp-add-btn" disabled={pending}>
            Save partner
          </button>
        </form>
      ) : null}

      <section className="bos-card" style={{ marginTop: "1rem" }}>
        <div className="emp-section-head">
          <div>
            <h2>Partners</h2>
            <p>
              These names appear in Sheet when Work source = Partner. Pick whether each one uses
              Garage Guys parts or keeps a private warehouse.
            </p>
          </div>
          <span className="bos-badge">{initial.length}</span>
        </div>

        {initial.length === 0 ? (
          <p className="emp-empty">No partners yet. Use + to add one.</p>
        ) : (
          <table className="bos-table emp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tech %</th>
                <th>Stock</th>
                <th>Notes</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {initial.map((partner) => (
                <tr key={partner.id}>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <form
                      className="partner-row-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        savePartner(partner, e.currentTarget);
                      }}
                    >
                      <input name="name" defaultValue={partner.name} required />
                      <input
                        name="techPercent"
                        defaultValue={String(partner.tech_percent)}
                        inputMode="decimal"
                      />
                      <div className="partner-stock-cell">
                        <select name="hasOwnStock" defaultValue={partner.has_own_stock ? "true" : "false"}>
                          <option value="false">Garage Guys stock</option>
                          <option value="true">Own stock</option>
                        </select>
                        {partner.has_own_stock && !partner.id.startsWith("seed-") ? (
                          <a className="partner-stock-link" href={`/stock?owner=${partner.id}`}>
                            Open stock
                          </a>
                        ) : null}
                      </div>
                      <input name="notes" defaultValue={partner.notes} placeholder="—" />
                      <label className="partner-active">
                        <input type="hidden" name="active" value="false" />
                        <input
                          type="checkbox"
                          name="active"
                          value="true"
                          defaultChecked={partner.active}
                        />
                        On
                      </label>
                      <div className="partner-row-actions">
                        <button type="submit" disabled={pending}>
                          Save
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className="partner-del"
                            onClick={() => removePartner(partner)}
                            disabled={pending}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
