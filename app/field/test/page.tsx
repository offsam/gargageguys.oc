import { FieldShell } from "@/components/bos/FieldShell";
import { CslbCourse } from "@/components/bos/CslbCourse";
import { requireRoles } from "@/lib/auth/require";

export default async function FieldCslbTestPage() {
  const user = await requireRoles("owner");

  return (
    <FieldShell user={user} title="CSLB Test" subtitle="Law & Business" active="schedule">
      <CslbCourse backHref="/field" />
    </FieldShell>
  );
}
