import { BosShell } from "@/components/bos/BosShell";
import { CslbCourse } from "@/components/bos/CslbCourse";
import { requireRouteAccess } from "@/lib/auth/require";

export default async function BosCslbTestPage() {
  const user = await requireRouteAccess("/test");

  return (
    <BosShell user={user} active="/test" title="Test" subtitle="CSLB Law & Business">
      <CslbCourse backHref="/owner" />
    </BosShell>
  );
}
