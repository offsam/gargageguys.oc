"use client";

import { useMemo, useState, useTransition } from "react";
import { saveSheetRowAction } from "@/app/actions/sheet";

export type SheetRow = {
  id: string;
  leadSource: string;
  leadCost: string;
  date: string;
  clientName: string;
  jobType: string;
  parts: string;
  paymentType: string;
  checkNumber: string;
  jobCost: string;
  bankFee: string;
  partsCost: string;
  techSalary: string;
};

const PAYMENT_TYPES = ["", "Credit Card", "Venmo", "Zelle", "Cash", "Check"] as const;

const COLUMNS: Array<{
  key: keyof SheetRow;
  label: string;
  width?: string;
  kind?: "text" | "select" | "computed";
}> = [
  { key: "leadSource", label: "Lead source", width: "130px" },
  { key: "leadCost", label: "Lead cost", width: "100px" },
  { key: "date", label: "Date", width: "110px" },
  { key: "clientName", label: "Client name", width: "150px" },
  { key: "jobType", label: "Job type", width: "140px" },
  { key: "parts", label: "Parts", width: "160px" },
  { key: "paymentType", label: "Payment type", width: "140px", kind: "select" },
  { key: "checkNumber", label: "Check #", width: "110px" },
  { key: "jobCost", label: "Job cost", width: "100px" },
  { key: "bankFee", label: "Bank fee", width: "90px" },
  { key: "partsCost", label: "Parts cost", width: "100px" },
  { key: "techSalary", label: "Tech salary", width: "110px" },
];

function money(value: string): number {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function emptyRow(index: number): SheetRow {
  return {
    id: `new-${index}-${Date.now()}`,
    leadSource: "",
    leadCost: "",
    date: new Date().toLocaleDateString(),
    clientName: "",
    jobType: "",
    parts: "",
    paymentType: "",
    checkNumber: "",
    jobCost: "",
    bankFee: "",
    partsCost: "",
    techSalary: "",
  };
}

function clearProfitFor(row: SheetRow): string {
  const hasMoney =
    money(row.jobCost) ||
    money(row.leadCost) ||
    money(row.bankFee) ||
    money(row.partsCost) ||
    money(row.techSalary);
  if (!hasMoney) return "";
  return formatMoney(
    money(row.jobCost) -
      money(row.leadCost) -
      money(row.bankFee) -
      money(row.partsCost) -
      money(row.techSalary),
  );
}

export function SheetTable({ rows: initialRows }: { rows: SheetRow[] }) {
  const [rows, setRows] = useState<SheetRow[]>(() => {
    const extras = Math.max(8, 14 - initialRows.length);
    return [...initialRows, ...Array.from({ length: extras }, (_, i) => emptyRow(i))];
  });
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const profitColIndex = COLUMNS.length;

  function updateCell(rowId: string, key: keyof SheetRow, value: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    );
  }

  function persist(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    startTransition(async () => {
      const result = await saveSheetRowAction(row);
      if (!result.ok) {
        setStatus(result.error || "Save failed");
        return;
      }
      if (result.id && result.id !== rowId) {
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, id: result.id! } : r)),
        );
      }
      setStatus("Saved");
      window.setTimeout(() => setStatus(""), 1200);
    });
  }

  const displayRows = useMemo(() => rows, [rows]);

  return (
    <div>
      <div className="sheet-status">{pending ? "Saving…" : status}</div>
      <div className="sheet-wrap">
        <table className="sheet-grid">
          <thead>
            <tr>
              <th className="sheet-corner" />
              {COLUMNS.map((col, idx) => (
                <th key={col.key} style={{ minWidth: col.width }}>
                  <span className="sheet-col-letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="sheet-col-label">{col.label}</span>
                </th>
              ))}
              <th style={{ minWidth: "110px" }}>
                <span className="sheet-col-letter">{String.fromCharCode(65 + profitColIndex)}</span>
                <span className="sheet-col-label">Clear profit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={row.id}>
                <th className="sheet-row-num">{rowIndex + 1}</th>
                {COLUMNS.map((col) => (
                  <td key={col.key}>
                    {col.kind === "select" ? (
                      <select
                        className="sheet-cell sheet-select"
                        value={row.paymentType}
                        onChange={(e) => {
                          updateCell(row.id, "paymentType", e.target.value);
                        }}
                        onBlur={() => persist(row.id)}
                      >
                        {PAYMENT_TYPES.map((opt) => (
                          <option key={opt || "empty"} value={opt}>
                            {opt || "—"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="sheet-cell"
                        value={row[col.key]}
                        onChange={(e) => updateCell(row.id, col.key, e.target.value)}
                        onBlur={() => persist(row.id)}
                        placeholder=""
                      />
                    )}
                  </td>
                ))}
                <td className="sheet-profit">
                  <input className="sheet-cell" value={clearProfitFor(row)} readOnly tabIndex={-1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="emp-add-btn"
        style={{ marginTop: "0.75rem" }}
        onClick={() => setRows((prev) => [...prev, emptyRow(prev.length)])}
      >
        + Add row
      </button>
    </div>
  );
}
