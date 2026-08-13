"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { CREATABLE_STAFF_ROLES } from "@/lib/auth/roles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";

export type CreateEmployeeState = {
  ok?: boolean;
  error?: string;
  email?: string;
  password?: string;
  role?: string;
};

function generatePassword(): string {
  const chunk = () => Math.random().toString(36).slice(2, 8);
  return `Gg-${chunk()}-${chunk()}!`;
}

export async function createEmployeeAction(
  _prev: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const session = await getSessionUser();
  if (!session) return { error: "Not signed in" };
  if (session.role !== "owner") return { error: "Only the owner can create cabinets" };

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const role = String(formData.get("role") || "").trim() as AppRole;
  const customPassword = String(formData.get("password") || "").trim();

  if (!email || !email.includes("@")) return { error: "Valid email is required" };
  if (!CREATABLE_STAFF_ROLES.includes(role)) return { error: "Invalid role" };

  const password = customPassword.length >= 8 ? customPassword : generatePassword();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        role,
      },
    });

    if (error) return { error: error.message };
    if (!data.user?.id) return { error: "User was not created" };

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName || email.split("@")[0],
      role,
      updated_at: new Date().toISOString(),
    });

    if (profileError) return { error: profileError.message };

    revalidatePath("/employees");
    revalidatePath("/owner");

    return {
      ok: true,
      email,
      password,
      role,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create employee" };
  }
}

export async function updateEmployeeRoleAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return;

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "") as AppRole;
  if (!id || !CREATABLE_STAFF_ROLES.includes(role)) return;

  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/employees");
}
