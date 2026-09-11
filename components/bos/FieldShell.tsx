import Link from "next/link";
import Image from "next/image";
import type { SessionUser } from "@/lib/auth/session";
import { techRankLabel } from "@/lib/auth/tech-rank";
import { signOutAction } from "@/app/actions/auth";
import { FieldSessionKeeper } from "@/components/bos/FieldSessionKeeper";
import { FieldPwaRegister } from "@/components/bos/FieldPwaRegister";
import { FieldWeather } from "@/components/bos/FieldWeather";
import { BUSINESS_TZ } from "@/lib/datetime";

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
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
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
          <path d="M15.5 17h-7a3.5 3.5 0 0 0 7 0Z" fill="currentColor" stroke="none" opacity="0.15" />
          <path d="M6.5 17h11" />
          <path d="M7.2 17a4.8 4.8 0 0 1 9.6 0" />
          <path d="M12 4.2v1.2" />
          <circle cx="12" cy="3.4" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

const TABS: Array<{ id: TabId; href: string; label: string }> = [
  { id: "schedule", href: "/field", label: "Today" },
  { id: "calendar", href: "/field/calendar", label: "Calendar" },
  { id: "report", href: "/field/report", label: "Report" },
  { id: "stock", href: "/stock?view=tech", label: "Stock" },
  { id: "attention", href: "/field/attention", label: "Events" },
];

function displayFirstName(user: SessionUser): string {
  const full = (user.fullName || "").trim();
  if (full) return full.split(/\s+/)[0];
  const email = (user.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Tech";
}

function roleLine(user: SessionUser): string {
  if (user.role === "technician") {
    if (user.techRank) return techRankLabel(user.techRank);
    return "Field Technician";
  }
  return user.role.replace(/_/g, " ");
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

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

  const firstName = displayFirstName(user);
  const showPageTitle = activeId !== "schedule";

  return (
    <div className={`field-app field-app--glass field-app--light${wide ? " field-app--wide" : ""}`}>
      <div className="field-app-glow" aria-hidden />
      <FieldPwaRegister />
      <FieldSessionKeeper />
      <header className="field-top field-top--profile">
        <div className="field-profile">
          <div className="field-avatar" aria-hidden>
            <span>{initials(user.fullName || firstName)}</span>
            <i className="field-avatar__online" />
          </div>
          <div className="field-profile__text">
            <strong className="field-profile__name">{firstName}</strong>
            <span className="field-profile__role">{roleLine(user)}</span>
            <span className="field-profile__date">{todayLabel()}</span>
          </div>
        </div>

        <div className="field-top-right">
          <div className="field-logo-wrap">
            <Image
              src="/Pictures/Logo.png"
              alt="Garage Guys OC"
              width={118}
              height={36}
              className="field-logo"
              priority
            />
          </div>
          <FieldWeather />
          <form action={signOutAction} className="field-signout-form">
            <button type="submit" className="field-signout">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {showPageTitle ? (
        <div className="field-page-title">
          <h1>{title}</h1>
          {subtitle ? <p className="field-sub">{subtitle}</p> : null}
        </div>
      ) : null}

      <main className="field-main">{children}</main>

      <nav className="field-tabs field-tabs--5 field-tabs--dock" aria-label="Field">
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
