"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceJobStatusAction, cancelJobStatusAction } from "@/app/actions/dispatch";
import {
  FIELD_STATUS_STEPS,
  canAddJobItems,
  fieldFlowIndex,
  fieldStatusLabel,
  nextFieldStatus,
} from "@/lib/field/job-status";

export function FieldJobStatusSteps({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = nextFieldStatus(status);
  const currentIdx = fieldFlowIndex(status);
  const itemsUnlocked = canAddJobItems(status);
  const terminal = status === "done" || status === "cancelled";

  function advance() {
    if (!next || pending) return;
    startTransition(async () => {
      const result = await advanceJobStatusAction(jobId);
      if (!result.ok) {
        window.alert(result.error || "Could not update status");
        return;
      }
      router.refresh();
      if (result.status === "on_site") {
        window.requestAnimationFrame(() => {
          document.getElementById("field-job-items")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    });
  }

  function cancel() {
    if (pending || terminal) return;
    if (!window.confirm("Cancel this job?")) return;
    startTransition(async () => {
      const result = await cancelJobStatusAction(jobId);
      if (!result.ok) {
        window.alert(result.error || "Could not cancel");
        return;
      }
      router.refresh();
    });
  }

  const nextStep = next
    ? FIELD_STATUS_STEPS.find((s) => s.status === next)
    : null;

  return (
    <div className="field-status-steps">
      <div className="field-status-steps__now">
        <span className="field-status-steps__label">Status</span>
        <strong>{fieldStatusLabel(status)}</strong>
      </div>

      <ol className="field-status-steps__list" aria-label="Job steps">
        {FIELD_STATUS_STEPS.map((step) => {
          const done = currentIdx > FIELD_STATUS_STEPS.indexOf(step) || status === "done";
          const active = step.status === status;
          return (
            <li
              key={step.status}
              className={[
                "field-status-steps__item",
                done ? "is-done" : "",
                active ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="field-status-steps__num">{step.step}</span>
              <span>{step.label}</span>
            </li>
          );
        })}
        <li
          className={[
            "field-status-steps__item",
            itemsUnlocked ? "is-done is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="field-status-steps__num">4</span>
          <span>Parts &amp; services</span>
        </li>
      </ol>

      {!terminal && nextStep ? (
        <button
          type="button"
          className="field-status-steps__advance"
          disabled={pending}
          onClick={advance}
        >
          {pending ? "Updating…" : nextStep.actionLabel}
        </button>
      ) : null}

      {!terminal && itemsUnlocked ? (
        <a href="#field-job-items" className="field-status-steps__items-cta">
          4 · Add parts &amp; services
        </a>
      ) : null}

      {terminal ? (
        <p className="field-muted field-status-steps__done">
          {status === "done" ? "Job completed." : "Job cancelled."}
        </p>
      ) : (
        <button
          type="button"
          className="field-status-steps__cancel"
          disabled={pending}
          onClick={cancel}
        >
          Cancel job
        </button>
      )}
    </div>
  );
}
