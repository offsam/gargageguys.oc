"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatClientDate,
  formatUsd,
  type ClientListItem,
} from "@/lib/clients/directory";

export function ClientsBoard({ clients }: { clients: ClientListItem[] }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => {
      const hay = [client.name, ...client.phones, ...client.addresses].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [clients, q]);

  return (
    <div>
      <div className="clients-toolbar">
        <input
          className="stock-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, address…"
        />
        <p className="clients-count">
          {rows.length} client{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="clients-empty">No clients match that search.</p>
      ) : (
        <table className="bos-table clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Jobs</th>
              <th>Paid</th>
              <th>Last job</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((client) => (
              <tr key={client.id}>
                <td>
                  <Link href={`/clients/${client.id}`}>{client.name}</Link>
                </td>
                <td>{client.phones[0] || "—"}</td>
                <td>{client.addresses[0] || "—"}</td>
                <td>{client.jobCount}</td>
                <td>{client.paidCents ? formatUsd(client.paidCents) : "—"}</td>
                <td>{formatClientDate(client.lastDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
