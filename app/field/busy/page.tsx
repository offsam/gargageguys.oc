import { redirect } from "next/navigation";
import { FieldShell } from "@/components/bos/FieldShell";
import { FieldBusyForm } from "@/components/bos/FieldBusyForm";
import { getSessionUser } from "@/lib/auth/session";
import { getFieldAttentionCount } from "@/lib/field/load-attention";

export default async function FieldBusyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "technician" && user.role !== "owner") redirect("/field");

  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  return (
    <FieldShell
      user={user}
      title="I'm busy"
      subtitle="Block time on your schedule"
      active="schedule"
      attentionCount={attentionCount}
    >
      <FieldBusyForm />
    </FieldShell>
  );
}
