import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";
import { homeForRole } from "./roles";
import { resolveTechRank, type TechRank } from "./tech-rank";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  techRank: TechRank | null;
  homePath: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) {
      // Transient network / refresh failures should not look identical to a
      // missing profile, but without a session we still treat as logged out.
      if (!/session|jwt|auth/i.test(error.message)) {
        console.error("[getSessionUser]", error.message);
      }
      return null;
    }
    if (!auth.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", auth.user.id)
      .maybeSingle();

    const role = (profile?.role ?? "office") as AppRole;
    const email = profile?.email || auth.user.email || "";
    const storedRank =
      (auth.user.app_metadata as { tech_rank?: unknown } | undefined)?.tech_rank;
    return {
      id: auth.user.id,
      email,
      fullName: profile?.full_name ?? null,
      role,
      techRank: resolveTechRank({ role, email, storedRank }),
      homePath: homeForRole(role),
    };
  } catch (err) {
    console.error("[getSessionUser]", err instanceof Error ? err.message : err);
    return null;
  }
}