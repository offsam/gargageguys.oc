import { redirect } from "next/navigation";
import { FieldShell } from "@/components/bos/FieldShell";
import { FieldAddClientForm } from "@/components/bos/FieldAddClientForm";
import { getSessionUser } from "@/lib/auth/session";
import { getFieldAttentionCount } from "@/lib/field/load-attention";
import { isSeniorTechnician } from "@/lib/auth/tech-rank";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPartnersAction } from "@/app/actions/partners";
import { loadServices } from "@/lib/field/service-store";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";
import { ensureDefaultSeniorTechs } from "@/app/actions/employees";

export default async function FieldAddPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "technician" && user.role !== "owner") redirect("/field");

  const fullForm = isSeniorTechnician(user);
  await ensureDefaultSeniorTechs().catch(() => null);
  const attentionCount =
    user.role === "technician" ? await getFieldAttentionCount(user.id) : 0;

  const supabase = await createSupabaseServerClient();
  const [techs, partners, services] = fullForm
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("role", "technician"),
        listPartnersAction(),
        loadServices().catch(() => FIELD_SERVICES.filter((s) => s.id !== "svc-custom")),
      ])
    : [{ data: [] }, [], [] as typeof FIELD_SERVICES];

  const technicians = (techs.data || []).map((t) => ({
    id: t.id,
    name: t.full_name || t.email || "Technician",
  }));

  return (
    <FieldShell
      user={user}
      title="Add client"
      subtitle={
        fullForm
          ? "Same fields as dispatch / Sheet — scheduled on the technician you pick"
          : "Creates a job on your schedule"
      }
      active="schedule"
      attentionCount={attentionCount}
      wide={fullForm}
    >
      <FieldAddClientForm
        fullForm={fullForm}
        defaultTechnician={user.fullName || user.email}
        technicians={technicians}
        partners={partners.map((p) => ({ name: p.name }))}
        services={Array.isArray(services) ? services : []}
      />
    </FieldShell>
  );
}
