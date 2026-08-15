import { BosShell } from "@/components/bos/BosShell";
import { PartnersBoard } from "@/components/bos/PartnersBoard";
import { listPartnersAction } from "@/app/actions/partners";
import { requireRouteAccess } from "@/lib/auth/require";

export default async function PartnersPage() {
  const user = await requireRouteAccess("/partners");

  const partners = await listPartnersAction();

  return (
    <BosShell
      user={user}
      active="/partners"
      title="Partners"
      subtitle="Who sends the job, and whether they use Garage Guys stock or their own"
    >
      <PartnersBoard partners={partners} canDelete={user.role === "owner"} />
    </BosShell>
  );
}
