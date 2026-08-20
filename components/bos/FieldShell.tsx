import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { techRankLabel } from "@/lib/auth/tech-rank";
import { signOutAction } from "@/app/actions/auth";
import { FieldSessionKeeper } from "@/components/bos/FieldSessionKeeper";

type TabId = "schedule" | "report" | "stock" | "attention";

const TABS: Array<{ id: TabId; href: string; label: string }> = [
  { id: "schedule", href: "/field", label: "Schedule" },
  { id: "report", href: "/field/report", label: "Report" },
  { id: "stock", href: "/stock?view=tech", label: "Stock" },
  { id: "attention", href: "/field/attention", label: "Alerts" },
];

export function FieldShell({
  user,
  title,
  subtitle,
  active = "schedule",
  attentionCount = 0,
  wide = false,
  children,
}: {
  user: SessionUser;
  title: string;
  subtitle?: string;
  active?: TabId | string;
  attentionCount?: number;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const activeId: TabId =
    active === "report" || active === "/field/report"
      ? "report"
      : active === "stock" || active === "/stock" || String(active).startsWith("/stock")
        ? "stock"
        : active === "attention" || active === "/field/attention"
          ? "attention"
          : "schedule";

  return (
    <div className={`field-app${wide ? " field-app--wide" : ""}`}>
      <FieldSessionKeeper />
      <header className="field-top">
        <div>
          <p className="field-brand">Garage Guys</p>
          <h1>{title}</h1>
          {subtitle ? <p className="field-sub">{subtitle}</p> : null}
        </div>
        <div className="field-user">
          <span>{user.fullName || user.email}</span>
          {user.role === "technician" && user.techRank ? (
            <span className="field-rank">{techRankLabel(user.techRank)}</span>
          ) : null}
          <form action={signOutAction}>
            <button type="submit" className="field-signout">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="field-main">{children}</main>

      <nav className="field-tabs" aria-label="Field">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={activeId === tab.id ? "active" : undefined}
          >
            <span className="field-tab-label">
              {tab.label}
              {tab.id === "attention" && attentionCount > 0 ? (
                <span className="field-tab-badge">{attentionCount > 9 ? "9+" : attentionCount}</span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
