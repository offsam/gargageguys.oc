import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/supabase/types";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/** Mirrors BosShell nav access — keep in sync with components/bos/BosShell.tsx */
export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/owner": ["owner"],
  "/employees": ["owner"],
  "/partners": ["owner", "office"],
  "/crm": ["owner", "office", "dispatcher"],
  "/clients": ["owner", "office", "dispatcher", "accountant"],
  "/sheet": ["owner", "office", "dispatcher"],
  "/stock": ["owner", "office", "dispatcher", "technician"],
  "/services": ["owner", "office", "dispatcher"],
  "/ads": ["owner", "office"],
  "/reviews": ["owner", "office"],
  "/serm": ["owner", "office"],
  "/dispatch": ["owner", "dispatcher"],
  "/finance": ["owner", "accountant"],
  "/field": ["owner", "technician", "dispatcher"],
};

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRoles(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) redirect(user.homePath);
  return user;
}

export async function requireRouteAccess(pathname: string): Promise<SessionUser> {
  const allowed = ROUTE_ROLES[pathname];
  if (!allowed) return requireSession();
  return requireRoles(...allowed);
}
