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
  updateInvoiceLinePriceAction,
} from "@/app/actions/job-invoice";
import { FIELD_SERVICES, findFieldServiceByName, withCustomService, type FieldService } from "@/lib/field/services-catalog";
import { upsertServiceAction } from "@/app/actions/services";
import { CustomServiceModal } from "@/components/bos/CustomServiceModal";
import {
  money,
  formatJobNumber,
  PAYMENT_OPTIONS,
  sumInvoiceDiscounts,
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
  stockSourceLabel = "Garage Guys",
  stockFrom = "van",
  invoice: initial,
  defaultServiceName = "",
  services = FIELD_SERVICES,
  itemsUnlocked = true,
}: {
  jobId: string;
  technicianId: string;
  vanParts: VanPart[];
  stockSourceLabel?: string;
  stockFrom?: "van" | "partner";
  invoice: JobInvoice;
  defaultServiceName?: string;
  services?: FieldService[];
  /** Only after On site (step 3) — tech must follow status buttons first. */
  itemsUnlocked?: boolean;
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [partId, setPartId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partPrice, setPartPrice] = useState("");
  const [extraServices, setExtraServices] = useState<FieldService[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customError, setCustomError] = useState("");
  const catalog = useMemo(
    () => withCustomService([...services, ...extraServices]),
    [services, extraServices],
  );
  const [serviceId, setServiceId] = useState(
    () =>
      withCustomService(services).find(
        (s) => s.name.toLowerCase() === defaultServiceName.trim().toLowerCase(),
      )?.id ||
      findFieldServiceByName(defaultServiceName)?.id ||
      "",
  );
  const [serviceQty, setServiceQty] = useState(1);
  const [servicePrice, setServicePrice] = useState(() => {
    const match =
      withCustomService(services).find(
        (s) => s.name.toLowerCase() === defaultServiceName.trim().toLowerCase(),
      ) || findFieldServiceByName(defaultServiceName);
    return match?.unitPriceCents ? (match.unitPriceCents / 100).toFixed(2) : "";
  });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [paymentType, setPaymentType] = useState(invoice.payment_type || "Credit Card");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const SIGN_PAD_HEIGHT = 280;

  const selectedPart = vanParts.find((p) => p.id === partId) || null;
  // Van may go negative when tech borrows from another stock — no max clamp.
  const canAddPart =
    itemsUnlocked && Boolean(partId) && partQty >= 1 && !pending;

  useEffect(() => {
    setInvoice(initial);
  }, [initial]);

  useEffect(() => {
    if (invoice.status !== "payment_confirmed" && invoice.status !== "signed") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = SIGN_PAD_HEIGHT;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f2340";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    setHasInk(false);
  }, [invoice.status]);

  const active = stepIndex(invoice.status);

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

  function saveCustomService(input: { name: string; price: string }) {
    setCustomError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", input.name);
      if (input.price) fd.set("price", input.price);
              const result = await upsertServiceAction(fd);
              if (!result.ok) {
                setCustomError(result.error || "Could not save service");
                return;
              }
              setExtraServices((prev) => {
                const next = prev.filter((s) => s.id !== result.service.id);
                return [...next, result.service];
              });
              setServiceId(result.service.id);
              setCustomOpen(false);
              const add = new FormData();
              add.set("jobId", jobId);
              add.set("serviceId", result.service.id);
              add.set("qty", String(serviceQty));
              const added = await addServiceToInvoiceAction(add);
              if (!added.ok) {
                setError(added.error || "Service saved — tap Add service");
                return;
              }
              if (added.invoice) setInvoice(added.invoice);
              router.refresh();
    });
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / rect.width;
    const scaleY = canvas.clientHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    e.preventDefault();
    drawing.current = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointerPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, SIGN_PAD_HEIGHT);
    setHasInk(false);
    setError("");
  }

  function submitSignature(andFinish: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasInk && !invoice.signature_data) {
      setError("Ask the client to sign first");
      return;
    }
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("signatureData", canvas.toDataURL("image/png"));
    setError("");
    startTransition(async () => {
      const saved = await saveSignatureAction(fd);
      if (!saved.ok) {
        setError(saved.error || "Could not save signature");
        return;
      }
      if (saved.invoice) setInvoice(saved.invoice);
      if (!andFinish) {
        router.refresh();
        return;
      }
      const done = await completeInvoiceAction(jobId);
      if (!done.ok) {
        setError(done.error || "Signature saved — tap Finish again");
        if (saved.invoice) setInvoice(saved.invoice);
        return;
      }
      if (done.invoice) setInvoice(done.invoice);
      router.refresh();
    });
  }

  return (
    <section className="field-section">
      <h2>Invoice {formatJobNumber(invoice.job_number)}</h2>

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
        <div className="inv-job-num">Job # {formatJobNumber(invoice.job_number)}</div>
        <strong>{invoice.client_name || "Customer"}</strong>
        <span>{invoice.client_phone || "No phone"}</span>
        <span>
          {[invoice.client_address, invoice.client_zip].filter(Boolean).join(", ") || "No address"}
        </span>
      </div>

      {error ? <p className="inv-error">{error}</p> : null}

      {(invoice.status === "draft" || invoice.status === "estimate_ready") && (
        <div className="field-detail-card inv-build">
          {!itemsUnlocked ? (
            <p className="inv-locked">
              Finish steps 1–3 (Confirm → En route → On site). Then you can add parts and
              services here.
            </p>
          ) : null}
          <h3>Add parts · {stockSourceLabel}</h3>
          <div className="inv-row">
            <select
              value={partId}
              disabled={!itemsUnlocked || pending}
              onChange={(e) => {
                const id = e.target.value;
                setPartId(id);
                const part = vanParts.find((p) => p.id === id);
                setPartQty(1);
                setPartPrice(
                  part ? ((part.unitCostCents || 0) / 100).toFixed(2) : "",
                );
              }}
            >
              <option value="">
                {stockFrom === "partner"
                  ? `Part from ${stockSourceLabel} on van…`
                  : "Part from Garage Guys van…"}
              </option>
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
              disabled={!itemsUnlocked || pending || !partId}
              onChange={(e) => {
                setPartQty(Math.max(1, Math.floor(Number(e.target.value) || 1)));
              }}
              aria-label="Part quantity"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="inv-price-input"
              value={partPrice}
              disabled={!itemsUnlocked || pending || !partId}
              placeholder="Price $"
              aria-label="Part price"
              onChange={(e) => setPartPrice(e.target.value)}
            />
            <button
              type="button"
              disabled={!canAddPart}
              onClick={() => {
                if (!canAddPart || !selectedPart) return;
                const fd = new FormData();
                fd.set("jobId", jobId);
                fd.set("technicianId", technicianId);
                fd.set("itemId", partId);
                fd.set("qty", String(Math.min(partQty, selectedPart.qty)));
                if (partPrice.trim()) fd.set("unitPrice", partPrice.trim());
                run(() => addPartToInvoiceAction(fd));
                setPartId("");
                setPartQty(1);
                setPartPrice("");
              }}
            >
              Add part
            </button>
          </div>
          {itemsUnlocked && selectedPart && partQty > selectedPart.qty ? (
            <p className="field-muted">
              Van shows {selectedPart.qty}. Extra units go negative (ok if taken from
              another stock).
            </p>
          ) : null}
          {vanParts.length === 0 ? (
            <p className="field-muted">No parts in catalog yet.</p>
          ) : null}

          <h3>Add service</h3>
          <div className="inv-row">
            <select
              value={serviceId === "svc-custom" ? "" : serviceId}
              disabled={!itemsUnlocked || pending}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "svc-custom") {
                  setCustomError("");
                  setCustomOpen(true);
                  return;
                }
                setServiceId(next);
                const svc = catalog.find((s) => s.id === next);
                setServicePrice(
                  svc?.unitPriceCents ? (svc.unitPriceCents / 100).toFixed(2) : "",
                );
              }}
            >
              <option value="">Service…</option>
              {catalog
                .filter((s) => s.id !== "svc-custom")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.unitPriceCents ? ` · ${money(s.unitPriceCents)}` : ""}
                  </option>
                ))}
              <option value="svc-custom">Custom…</option>
            </select>
            <input
              type="number"
              min={1}
              value={serviceQty}
              disabled={!itemsUnlocked || pending}
              onChange={(e) => setServiceQty(Number(e.target.value) || 1)}
              aria-label="Service quantity"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="inv-price-input"
              value={servicePrice}
              disabled={!itemsUnlocked || pending || !serviceId || serviceId === "svc-custom"}
              placeholder="Price $"
              aria-label="Service price"
              onChange={(e) => setServicePrice(e.target.value)}
            />
            <button
              type="button"
              disabled={!itemsUnlocked || pending || !serviceId || serviceId === "svc-custom"}
              onClick={() => {
                const fd = new FormData();
                fd.set("jobId", jobId);
                fd.set("serviceId", serviceId);
                fd.set("qty", String(serviceQty));
                if (servicePrice.trim()) fd.set("unitPrice", servicePrice.trim());
                run(() => addServiceToInvoiceAction(fd));
              }}
            >
              Add service
            </button>
            <button
              type="button"
              className="inv-custom-btn"
              disabled={!itemsUnlocked || pending}
              onClick={() => {
                setCustomError("");
                setCustomOpen(true);
              }}
            >
              Custom
            </button>
          </div>
          <p className="field-muted">
            Custom names the work you did — it is added to this invoice and stays in the service list.
          </p>
        </div>
      )}

      <div className="field-detail-card">
        <h3>Estimate</h3>
        {invoice.lines.length === 0 ? (
          <p className="field-muted">No lines yet.</p>
        ) : (
          <ul className="inv-lines">
            {invoice.lines.map((line) => {
              const listCents = Number(line.listCents) || line.unitCents;
              const discount = Number(line.discountCents) || 0;
              const canEdit =
                invoice.status === "draft" || invoice.status === "estimate_ready";
              const editing = editingLineId === line.id;
              return (
                <li key={line.id}>
                  <div>
                    <strong>
                      {line.kind === "part" ? "Part" : "Service"} · {line.name}
                    </strong>
                    <span>
                      {line.qty} × {money(line.unitCents)}
                      {discount > 0 ? (
                        <>
                          {" "}
                          <em className="inv-discount-tag">
                            was {money(listCents)} · client discount −{money(discount)}
                          </em>
                        </>
                      ) : listCents > 0 && line.unitCents > listCents ? (
                        <>
                          {" "}
                          <em className="inv-price-up-tag">was {money(listCents)}</em>
                        </>
                      ) : null}
                    </span>
                    {editing ? (
                      <div className="inv-edit-price">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          aria-label="Edit line price"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("jobId", jobId);
                            fd.set("lineId", line.id);
                            fd.set("unitPrice", editPrice);
                            run(() => updateInvoiceLinePriceAction(fd));
                            setEditingLineId(null);
                          }}
                        >
                          Save price
                        </button>
                        <button
                          type="button"
                          className="inv-remove"
                          onClick={() => setEditingLineId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="inv-line-right">
                    <strong>{money(line.totalCents)}</strong>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          className="inv-remove"
                          disabled={pending}
                          onClick={() => {
                            setEditingLineId(line.id);
                            setEditPrice(((line.unitCents || 0) / 100).toFixed(2));
                          }}
                        >
                          Price
                        </button>
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
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {sumInvoiceDiscounts(invoice.lines) > 0 ? (
          <div className="inv-total inv-total--discount">
            <span>Client discount</span>
            <strong>−{money(sumInvoiceDiscounts(invoice.lines))}</strong>
          </div>
        ) : null}
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
        <div className="field-detail-card inv-sign-card">
          <h3>Client signature</h3>
          <p className="field-muted">Ask the customer to sign in the box with their finger.</p>
          <canvas
            ref={canvasRef}
            className="inv-sign-pad"
            style={{ height: SIGN_PAD_HEIGHT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {!hasInk && !invoice.signature_data ? (
            <p className="inv-sign-hint">Sign above, then tap the green button.</p>
          ) : (
            <p className="inv-sign-hint inv-sign-hint--ready">Signature ready — save below.</p>
          )}
          <div className="inv-sign-actions">
            <button
              type="button"
              className="inv-sign-clear"
              onClick={clearSignature}
              disabled={pending}
            >
              Clear
            </button>
            <button
              type="button"
              className="inv-primary inv-sign-save"
              disabled={pending || (!hasInk && !invoice.signature_data) || invoice.total_cents <= 0}
              onClick={() => submitSignature(true)}
            >
              {pending ? "Saving…" : "Save signature & finish"}
            </button>
          </div>
          {invoice.signature_data && invoice.status === "signed" ? (
            <button
              type="button"
              className="inv-primary"
              disabled={pending || invoice.total_cents <= 0}
              onClick={() => run(() => completeInvoiceAction(jobId))}
            >
              Finish invoice
            </button>
          ) : null}
        </div>
      )}

      {invoice.status === "complete" && (
        <div className="field-detail-card inv-done">
          <h3>Invoice complete — {formatJobNumber(invoice.job_number)}</h3>
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
      {customOpen ? (
        <CustomServiceModal
          pending={pending}
          error={customError}
          showPrice
          requirePrice={false}
          onClose={() => {
            if (!pending) setCustomOpen(false);
          }}
          onSave={saveCustomService}
        />
      ) : null}
    </section>
  );
}
