import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { signOutAction } from "@/app/actions/auth";

const LINKS: Array<{ href: string; label: string; roles?: Array<SessionUser["role"]> }> = [
  { href: "/owner", label: "Overview", roles: ["owner"] },
  { href: "/employees", label: "Employees", roles: ["owner"] },
  { href: "/sheet", label: "Sheet", roles: ["owner", "office", "dispatcher"] },
  { href: "/stock", label: "Stock", roles: ["owner", "office", "dispatcher", "technician"] },
  { href: "/dispatch", label: "Dispatch", roles: ["owner", "dispatcher"] },
  { href: "/finance", label: "Finance", roles: ["owner", "accountant"] },
  { href: "/field", label: "Field", roles: ["owner", "technician", "dispatcher"] },
];

export function BosShell({
  user,
  active,
  title,
  subtitle,
  children,
}: {
  user: SessionUser;
  active: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const links = LINKS.filter((link) => !link.roles || link.roles.includes(user.role));

  return (
    <div className="bos-shell">
      <aside className="bos-nav">
        <p className="bos-brand">
          Garage Guys <span>BOS</span>
        </p>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={active === link.href ? "active" : undefined}
          >
            {link.label}
          </Link>
        ))}
        <div className="bos-user">
          <div>{user.fullName || user.email}</div>
          <div>{user.role}</div>
          <form action={signOutAction}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="bos-main">
        <header className="bos-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <Link href="/">← Website</Link>
        </header>
        {children}
      </main>
    </div>
  );
}
