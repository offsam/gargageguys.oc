"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createFieldClientJobAction } from "@/app/actions/field";

function defaultVisitLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function FieldAddClientForm() {
  const router = useRouter();
  const defaultVisit = useMemo(() => defaultVisitLocal(), []);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createFieldClientJobAction(formData);
      if (!result.ok) {
        setError(result.error || "Failed");
        return;
      }
      router.push(`/field/jobs/${result.jobId}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="field-form">
      {error ? <div className="field-form-error">{error}</div> : null}

      <label>
        <span>Client name</span>
        <input name="name" required autoFocus disabled={pending} />
      </label>
      <label>
        <span>Phone</span>
        <input name="phone" type="tel" required disabled={pending} />
      </label>
      <label>
        <span>Address</span>
        <input name="address" required disabled={pending} />
      </label>
      <label>
        <span>ZIP</span>
        <input name="zip" disabled={pending} />
      </label>
      <label>
        <span>Problem</span>
        <textarea name="message" rows={3} disabled={pending} />
      </label>
      <label>
        <span>Visit time</span>
        <input
          name="startAt"
          type="datetime-local"
          required
          defaultValue={defaultVisit}
          disabled={pending}
        />
      </label>

      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create & schedule"}
      </button>
      <p className="field-muted">
        <Link href="/field">Cancel</Link>
      </p>
    </form>
  );
}
