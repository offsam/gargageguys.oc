"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/roles";
import { safeInternalPath } from "@/lib/security/safe-redirect";
import type { AppRole } from "@/lib/supabase/types";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "").trim();
  // Persist is the default: durable cookies are always written via authCookieOptions.
  // FieldSessionKeeper keeps the JWT fresh on phones while Field is open.
  void formData.get("persist");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  let role: AppRole = "office";
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    role = (profile?.role as AppRole) || "office";
  }

  redirect(safeInternalPath(next, homeForRole(role)));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Soft refresh used so server cookies stay warm alongside the browser client. */
export async function refreshSessionAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
