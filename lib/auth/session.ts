import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";
import { homeForRole } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  homePath: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", auth.user.id)
      .maybeSingle();

    const role = (profile?.role ?? "office") as AppRole;
    return {
      id: auth.user.id,
      email: profile?.email || auth.user.email || "",
      fullName: profile?.full_name ?? null,
      role,
      homePath: homeForRole(role),
    };
  } catch {
    return null;
  }
}