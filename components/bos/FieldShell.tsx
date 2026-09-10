import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { techRankLabel } from "@/lib/auth/tech-rank";
import { signOutAction } from "@/app/actions/auth";
import { FieldSessionKeeper } from "@/components/bos/FieldSessionKeeper";
import { FieldPwaRegister } from "@/components/bos/FieldPwaRegister";

type TabId = "schedule" | "calendar" | "report" | "stock" | "attention";

function TabIcon({ id }: { id: TabId }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (id) {
    case "schedule":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h10" />
          <path d="M4 18h14" />
          <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17" />
        </svg>
      );
    case "report":
      return (
        <svg {...common}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M20 19H3" />
        </svg>
      );
    case "stock":
      return (
        <svg {...common}>
          <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
          <path d="M12 12v8M4 8.5l8 3.5 8-3.5" />
        </svg>
      );
    case "attention":
      return (
        <svg {...common}>
          <path d="M12 4.5 21 19H3L12 4.5Z" />
          <path d="M12 10v4.5" />
          <circle cx="12" cy="17" r="0.85" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

const TABS: Array<{ id: TabId; href: string; label: string }> = [
  { id: "schedule", href: "/field", label: "Today" },
  { id: "calendar", href: "/field/calendar", label: "Calendar" },
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
    active === "calendar" || active === "/field/calendar"
      ? "calendar"
      : active === "report" || active === "/field/report"
        ? "report"
        : active === "stock" || active === "/stock" || String(active).startsWith("/stock")
          ? "stock"
          : active === "attention" || active === "/field/attention"
            ? "attention"
            : "schedule";

  return (
    <div className={`field-app field-app--glass${wide ? " field-app--wide" : ""}`}>
      <div className="field-app-glow" aria-hidden />
      <FieldPwaRegister />
      <FieldSessionKeeper />
      <header className="field-top field-glass">
        <div className="field-top-copy">
          <p className="field-brand">Garage Guys</p>
          <h1>{title}</h1>
          {subtitle ? <p className="field-sub">{subtitle}</p> : null}
        </div>
        <div className="field-user">
          <span className="field-user-name">{user.fullName || user.email}</span>
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

      <nav className="field-tabs field-tabs--5 field-glass" aria-label="Field">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={activeId === tab.id ? "active" : undefined}
          >
            <span className="field-tab-icon">
              <TabIcon id={tab.id} />
              {tab.id === "attention" && attentionCount > 0 ? (
                <span className="field-tab-badge">{attentionCount > 9 ? "9+" : attentionCount}</span>
              ) : null}
            </span>
            <span className="field-tab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
