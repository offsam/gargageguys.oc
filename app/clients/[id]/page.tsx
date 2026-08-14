import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { getSessionUser } from "@/lib/auth/session";
import {
  formatClientDate,
  formatUsd,
  loadClientProfile,
} from "@/lib/clients/directory";

const ALLOWED = new Set(["owner", "office", "dispatcher", "accountant"]);

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!ALLOWED.has(user.role)) redirect(user.homePath);

  const { id } = await params;
  const client = await loadClientProfile(decodeURIComponent(id));
  if (!client) notFound();

  return (
    <BosShell
      user={user}
      active="/clients"
      title={client.name}
      subtitle={`${client.jobCount} job${client.jobCount === 1 ? "" : "s"} · paid ${formatUsd(client.paidCents)}`}
    >
      <p className="clients-back">
        <Link href="/clients">← All clients</Link>
      </p>

      <dl className="client-facts">
        <div>
          <dt>Phone</dt>
          <dd>{client.phones.length ? client.phones.join(" · ") : "—"}</dd>
        </div>
        <div>
          <dt>Addresses</dt>
          <dd>
            {client.addresses.length ? (
              <ul>
                {client.addresses.map((address) => (
                  <li key={address}>{address}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {client.orders.length === 0 ? (
        <p className="clients-empty">No jobs on file for this client yet.</p>
      ) : (
        <table className="bos-table clients-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Job #</th>
              <th>Issue</th>
              <th>Service</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Technician</th>
            </tr>
          </thead>
          <tbody>
            {client.orders.map((order) => (
              <tr key={order.leadId}>
                <td>{formatClientDate(order.date)}</td>
                <td>{order.jobNumber || "—"}</td>
                <td>{order.issue || "—"}</td>
                <td>{order.service || "—"}</td>
                <td>{order.status}</td>
                <td>{order.amountCents ? formatUsd(order.amountCents) : "—"}</td>
                <td>{order.paymentType || "—"}</td>
                <td>{order.technician || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </BosShell>
  );
}
