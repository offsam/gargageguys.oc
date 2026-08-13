"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPartToInvoiceAction,
  addServiceToInvoiceAction,
  completeInvoiceAction,
  confirmEstimateAction,
  confirmPaymentAction,
  removeInvoiceLineAction,
  saveSignatureAction,
  startPaymentAction,
} from "@/app/actions/job-invoice";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";
import {
  money,
  PAYMENT_OPTIONS,
  type JobInvoice,
  type JobInvoiceStatus,
} from "@/lib/field/job-invoice-types";

type VanPart = { id: string; name: string; qty: number; unitCostCents: number };

const STEPS: Array<{ id: JobInvoiceStatus | "building"; label: string }> = [
  { id: "draft", label: "1. Add items" },
  { id: "estimate_ready", label: "2. Estimate" },
  { id: "estimate_confirmed", label: "3. Work" },
  { id: "payment_pending", label: "4. Payment" },
  { id: "payment_confirmed", label: "5. Sign" },
  { id: "complete", label: "6. Done" },
];

function stepIndex(status: JobInvoiceStatus) {
  if (status === "draft") return 0;
  if (status === "estimate_ready") return 1;
  if (status === "estimate_confirmed") return 2;
  if (status === "payment_pending") return 3;
  if (status === "payment_confirmed" || status === "signed") return 4;
  return 5;
}

export function FieldInvoiceWizard({
  jobId,
  technicianId,
  vanParts,
  invoice: initial,
  jobStatus,
}: {
  jobId: string;
  technicianId: string;
  vanParts: VanPart[];
  invoice: JobInvoice;
  jobStatus: string;
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [partId, setPartId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [serviceQty, setServiceQty] = useState(1);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [paymentType, setPaymentType] = useState(invoice.payment_type || "Credit Card");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    setInvoice(initial);
  }, [initial]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = 160;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f2340";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }, [invoice.status]);

  const active = stepIndex(invoice.status);

  const selectedService = useMemo(
    () => FIELD_SERVICES.find((s) => s.id === serviceId),
    [serviceId],
  );

  function run(action: () => Promise<{ ok: boolean; error?: string; invoice?: JobInvoice }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error || "Action failed");
        return;
      }
      if (result.invoice) setInvoice(result.invoice);
      router.refresh();
    });
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointerPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function onPointerUp() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, 160);
  }

  function submitSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    const isBlank = canvas.toDataURL() === blank.toDataURL();
    if (isBlank) {
      setError("Client signature required");
      return;
    }
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("signatureData", canvas.toDataURL("image/png"));
    run(() => saveSignatureAction(fd));
  }

  if (jobStatus !== "on_site" && jobStatus !== "done" && invoice.status === "draft" && !invoice.lines.length) {
    return (
      <section className="field-section inv-locked">
        <h2>Invoice</h2>
        <div className="field-detail-card">
          <p className="field-muted">
            Set status to <strong>on site</strong> to start the invoice (parts, services, payment,
            signature).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="field-section">
      <h2>Invoice</h2>

      <div className="inv-steps">
        {STEPS.map((step, idx) => (
          <span
            key={step.id}
            className={`inv-step${idx <= active ? " is-on" : ""}${idx === active ? " is-current" : ""}`}
          >
            {step.label}
          </span>
        ))}
      </div>

      <div className="field-detail-card inv-client">
        <strong>{invoice.client_name || "Customer"}</strong>
        <span>{invoice.client_phone || "No phone"}</span>
        <span>
          {[invoice.client_address, invoice.client_zip].filter(Boolean).join(", ") || "No address"}
        </span>
      </div>

      {error ? <p className="inv-error">{error}</p> : null}

      {(invoice.status === "draft" || invoice.status === "estimate_ready") && (
        <div className="field-detail-card inv-build">
          <h3>Add parts</h3>
          <div className="inv-row">
            <select value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">Part from van…</option>
              {vanParts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.qty}) · {money(p.unitCostCents)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={partQty}
              onChange={(e) => setPartQty(Number(e.target.value) || 1)}
            />
            <button
              type="button"
              disabled={pending || !partId}
              onClick={() => {
                const fd = new FormData();
                fd.set("jobId", jobId);
                fd.set("technicianId", technicianId);
                fd.set("itemId", partId);
                fd.set("qty", String(partQty));
                run(() => addPartToInvoiceAction(fd));
              }}
            >
              Add part
            </button>
          </div>

          <h3>Add service</h3>
          <div className="inv-row">
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Service…</option>
              {FIELD_SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.unitPriceCents ? ` · ${money(s.unitPriceCents)}` : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={serviceQty}
              onChange={(e) => setServiceQty(Number(e.target.value) || 1)}
            />
            <button
              type="button"
              disabled={pending || !serviceId}
              onClick={() => {
                const fd = new FormData();
                fd.set("jobId", jobId);
                fd.set("serviceId", serviceId);
                fd.set("qty", String(serviceQty));
                fd.set("customName", customName);
                fd.set("customPrice", customPrice);
                run(() => addServiceToInvoiceAction(fd));
              }}
            >
              Add service
            </button>
          </div>
          {selectedService?.id === "svc-custom" ? (
            <div className="inv-row">
              <input
                placeholder="Custom service name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price $"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      )}

      <div className="field-detail-card">
        <h3>Estimate</h3>
        {invoice.lines.length === 0 ? (
          <p className="field-muted">No lines yet.</p>
        ) : (
          <ul className="inv-lines">
            {invoice.lines.map((line) => (
              <li key={line.id}>
                <div>
                  <strong>
                    {line.kind === "part" ? "Part" : "Service"} · {line.name}
                  </strong>
                  <span>
                    {line.qty} × {money(line.unitCents)}
                  </span>
                </div>
                <div className="inv-line-right">
                  <strong>{money(line.totalCents)}</strong>
                  {(invoice.status === "draft" || invoice.status === "estimate_ready") && (
                    <button
                      type="button"
                      className="inv-remove"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("jobId", jobId);
                        fd.set("lineId", line.id);
                        run(() => removeInvoiceLineAction(fd));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="inv-total">
          <span>Total</span>
          <strong>{money(invoice.total_cents)}</strong>
        </div>
      </div>

      {(invoice.status === "draft" || invoice.status === "estimate_ready") &&
        invoice.lines.length > 0 && (
          <button
            type="button"
            className="inv-primary"
            disabled={pending}
            onClick={() => run(() => confirmEstimateAction(jobId))}
          >
            Client confirms estimate
          </button>
        )}

      {invoice.status === "estimate_confirmed" && (
        <div className="field-detail-card">
          <p>Estimate confirmed. Complete the work, then collect payment.</p>
          <button
            type="button"
            className="inv-primary"
            disabled={pending}
            onClick={() => run(() => startPaymentAction(jobId))}
          >
            Take payment
          </button>
        </div>
      )}

      {invoice.status === "payment_pending" && (
        <div className="field-detail-card">
          <h3>Payment type</h3>
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="field-muted">Total due: {money(invoice.total_cents)}</p>
          <button
            type="button"
            className="inv-primary"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("jobId", jobId);
              fd.set("paymentType", paymentType);
              run(() => confirmPaymentAction(fd));
            }}
          >
            Payment received
          </button>
        </div>
      )}

      {(invoice.status === "payment_confirmed" || invoice.status === "signed") && (
        <div className="field-detail-card">
          <h3>Client signature</h3>
          <p className="field-muted">Have the customer sign with their finger.</p>
          <canvas
            ref={canvasRef}
            className="inv-sign-pad"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div className="inv-sign-actions">
            <button type="button" onClick={clearSignature} disabled={pending}>
              Clear
            </button>
            <button type="button" className="inv-primary" disabled={pending} onClick={submitSignature}>
              Save signature
            </button>
          </div>
          {invoice.signature_data ? (
            <button
              type="button"
              className="inv-primary"
              disabled={pending}
              onClick={() => run(() => completeInvoiceAction(jobId))}
            >
              Finish — finalize invoice
            </button>
          ) : null}
        </div>
      )}

      {invoice.status === "complete" && (
        <div className="field-detail-card inv-done">
          <h3>Invoice complete</h3>
          <p>
            Saved in BOS. Payment: <strong>{invoice.payment_type}</strong> ·{" "}
            <strong>{money(invoice.total_cents)}</strong>
          </p>
          {invoice.signature_data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invoice.signature_data} alt="Customer signature" className="inv-sign-preview" />
          ) : null}
          <p className="field-muted">
            Public link token ready for email/SMS later:{" "}
            <code>/i/{invoice.public_token}</code>
          </p>
        </div>
      )}
    </section>
  );
}
