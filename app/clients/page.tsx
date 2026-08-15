import { BosShell } from "@/components/bos/BosShell";
import { ClientsBoard } from "@/components/bos/ClientsBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { loadClientDirectory } from "@/lib/clients/directory";

export default async function ClientsPage() {
  const user = await requireRouteAccess("/clients");

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
