"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { signOutAction } from "@/app/actions/auth";

const LINKS: Array<{ href: string; label: string; roles?: Array<SessionUser["role"]> }> = [
  { href: "/owner", label: "Overview", roles: ["owner"] },
  { href: "/employees", label: "Employees", roles: ["owner"] },
  { href: "/partners", label: "Partners", roles: ["owner", "office"] },
  { href: "/crm", label: "CRM", roles: ["owner", "office", "dispatcher"] },
  { href: "/clients", label: "Clients", roles: ["owner", "office", "dispatcher", "accountant"] },
  { href: "/sheet", label: "Sheet", roles: ["owner", "office", "dispatcher"] },
  { href: "/stock", label: "Stock", roles: ["owner", "office", "dispatcher", "technician"] },
  { href: "/ads", label: "Ads", roles: ["owner", "office"] },
  { href: "/reviews", label: "Reviews", roles: ["owner", "office"] },
  { href: "/serm", label: "Search", roles: ["owner", "office"] },
  { href: "/dispatch", label: "Dispatch", roles: ["owner", "dispatcher"] },
  { href: "/finance", label: "Finance", roles: ["owner", "accountant"] },
  { href: "/field", label: "Field", roles: ["owner", "technician", "dispatcher"] },
];

const NAV_COLLAPSED_KEY = "bos-nav-collapsed";

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
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    try {
      setNavCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleNav() {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className={`bos-shell${navCollapsed ? " bos-shell--nav-collapsed" : ""}`}>
      <aside className="bos-nav" aria-hidden={navCollapsed}>
        <p className="bos-brand">
          Garage Guys <span>BOS</span>
        </p>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={active === link.href ? "active" : undefined}
            tabIndex={navCollapsed ? -1 : undefined}
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
          <div className="bos-header-title">
            <button
              type="button"
              className="bos-nav-toggle"
              onClick={toggleNav}
              aria-pressed={navCollapsed}
              aria-label={navCollapsed ? "Show navigation" : "Hide navigation"}
              title={navCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {navCollapsed ? "☰ Menu" : "« Hide menu"}
            </button>
            <div>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <Link href="/">← Website</Link>
        </header>
        {children}
      </main>
    </div>
  );
}
