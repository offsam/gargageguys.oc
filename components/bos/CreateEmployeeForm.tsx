"use client";

import { useActionState, useState } from "react";
import {
  createEmployeeAction,
  type CreateEmployeeState,
} from "@/app/actions/employees";
import { CREATABLE_STAFF_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/supabase/types";

const initial: CreateEmployeeState = {};

export function CreateEmployeeForm({ defaultRole }: { defaultRole?: AppRole }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createEmployeeAction, initial);
  const [role, setRole] = useState<AppRole>(defaultRole || "technician");

  if (!open && !state.ok) {
    return (
      <button type="button" className="emp-add-btn" onClick={() => setOpen(true)}>
        + Add specialist
      </button>
    );
  }

  if (state.ok) {
    return (
      <div className="emp-created bos-card">
        <h3>Cabinet created</h3>
        <p>
          <strong>Email:</strong> {state.email}
        </p>
        <p>
          <strong>Password:</strong> <code>{state.password}</code>
        </p>
        <p>
          <strong>Role:</strong> {state.role ? ROLE_LABELS[state.role as AppRole] : state.role}
        </p>
        <p className="emp-hint">Save this password — it won’t be shown again. They sign in at /login.</p>
        <button
          type="button"
          className="emp-add-btn"
          onClick={() => {
            setOpen(false);
            window.location.reload();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="emp-create-form bos-card">
      <div className="emp-create-head">
        <h3>New specialist cabinet</h3>
        <button type="button" className="emp-cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state.error ? <div className="login-card error">{state.error}</div> : null}
      <label>
        Full name
        <input name="fullName" type="text" placeholder="Alex Johnson" required />
      </label>
      <label>
        Email (login)
        <input name="email" type="email" placeholder="tech@garageguysoc.com" required />
      </label>
      <label>
        Role
        <select
          name="role"
          defaultValue={defaultRole || "technician"}
          required
          onChange={(e) => setRole(e.target.value as AppRole)}
        >
          {CREATABLE_STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      {role === "technician" ? (
        <label>
          Rank
          <select name="techRank" defaultValue="technician">
            <option value="technician">Technician</option>
            <option value="senior">Senior technician</option>
          </select>
        </label>
      ) : null}
      <label>
        Password (optional)
        <input name="password" type="text" placeholder="Leave blank to auto-generate" minLength={8} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create cabinet"}
      </button>
    </form>
  );
}
