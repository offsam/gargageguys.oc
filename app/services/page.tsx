import { BosShell } from "@/components/bos/BosShell";
import { ServicesBoard } from "@/components/bos/ServicesBoard";
import { requireRouteAccess } from "@/lib/auth/require";
import { loadServices } from "@/lib/field/service-store";
import { FIELD_SERVICES } from "@/lib/field/services-catalog";

export default async function ServicesPage() {
  const user = await requireRouteAccess("/services");
  const catalog = await loadServices().catch(() =>
    FIELD_SERVICES.filter((s) => s.id !== "svc-custom"),
  );

  return (
    <BosShell
      user={user}
      active="/services"
      title="Services"
      subtitle="Catalog for Sheet, CRM, and Field invoices"
    >
      <ServicesBoard
        services={catalog}
        showPrices={user.role === "owner"}
        canManage={user.role !== "technician"}
      />
    </BosShell>
  );
}
