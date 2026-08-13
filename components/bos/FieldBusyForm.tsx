"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBusyBlockAction } from "@/app/actions/field";

function localAt(hours: number): string {
  const d = new Date();
  d.setHours(hours, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function FieldBusyForm() {
  const router = useRouter();
  const defaults = useMemo(() => ({ start: localAt(8), end: localAt(18) }), []);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createBusyBlockAction(formData);
      if (!result.ok) {
        setError(result.error || "Failed");
        return;
      }
      router.push("/field");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="field-form">
      {error ? <div className="field-form-error">{error}</div> : null}

      <label>
        <span>Busy from</span>
        <input
          name="startAt"
          type="datetime-local"
          required
          defaultValue={defaults.start}
          disabled={pending}
        />
      </label>
      <label>
        <span>Busy until</span>
        <input
          name="endAt"
          type="datetime-local"
          required
          defaultValue={defaults.end}
          disabled={pending}
        />
      </label>
      <label>
        <span>Note (optional)</span>
        <input name="note" placeholder="Lunch, personal, parts run…" disabled={pending} />
      </label>

      <p className="field-muted">
        Dispatcher will see this block on your schedule and won&apos;t double-book you.
      </p>

      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Mark busy"}
      </button>
      <p className="field-muted">
        <Link href="/field">Cancel</Link>
      </p>
    </form>
  );
}
