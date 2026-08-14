import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { ClientsBoard } from "@/components/bos/ClientsBoard";
import { getSessionUser } from "@/lib/auth/session";
import { loadClientDirectory } from "@/lib/clients/directory";

const ALLOWED = new Set(["owner", "office", "dispatcher", "accountant"]);

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!ALLOWED.has(user.role)) redirect(user.homePath);

  const clients = await loadClientDirectory();

  return (
    <BosShell
      user={user}
      active="/clients"
      title="Clients"
      subtitle="People from Sheet and CRM — tap a name for jobs, dates, and what they paid"
    >
      <ClientsBoard clients={clients} />
    </BosShell>
  );
}
