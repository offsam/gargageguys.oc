import { redirect } from "next/navigation";
import { BosShell } from "@/components/bos/BosShell";
import { PartnersBoard } from "@/components/bos/PartnersBoard";
import { listPartnersAction } from "@/app/actions/partners";
import { getSessionUser } from "@/lib/auth/session";

export default async function PartnersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "office") redirect(user.homePath);

  const partners = await listPartnersAction();

  return (
    <BosShell
      user={user}
      active="/partners"
      title="Partners"
      subtitle="Companies you take jobs from — used on Sheet when Work source is Partner"
    >
      <PartnersBoard partners={partners} canDelete={user.role === "owner"} />
    </BosShell>
  );
}
