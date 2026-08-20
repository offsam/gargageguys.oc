"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { CREATABLE_STAFF_ROLES } from "@/lib/auth/roles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";
import { isDefaultSeniorTechEmail, normalizeTechRank, type TechRank } from "@/lib/auth/tech-rank";

function mergeAppMeta(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
) {
  return { ...(existing || {}), ...patch };
}

export async function updateEmployeeTechRankAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return;

  const id = String(formData.get("id") || "");
  const rank = normalizeTechRank(formData.get("techRank")) || "technician";
  if (!id) return;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();
  if (!profile || profile.role !== "technician") return;

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const nextRank: TechRank = isDefaultSeniorTechEmail(profile.email) ? "senior" : rank;
  await admin.auth.admin.updateUserById(id, {
    app_metadata: mergeAppMeta(
      authUser.user?.app_metadata as Record<string, unknown> | undefined,
      { tech_rank: nextRank },
    ),
  });

  revalidatePath("/employees");
  revalidatePath("/field");
}

export async function ensureDefaultSeniorTechs() {
  const admin = getSupabaseAdmin();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("role", "technician");
  for (const profile of profiles || []) {
    if (!isDefaultSeniorTechEmail(profile.email)) continue;
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    const stored = (authUser.user?.app_metadata as { tech_rank?: unknown } | undefined)?.tech_rank;
    if (normalizeTechRank(stored) === "senior") continue;
    await admin.auth.admin.updateUserById(profile.id, {
      app_metadata: mergeAppMeta(
        authUser.user?.app_metadata as Record<string, unknown> | undefined,
        { tech_rank: "senior" },
      ),
    });
  }
}

export async function loadTechRanks(): Promise<Record<string, TechRank>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.admin.listUsers({ perPage: 200, page: 1 });
  const ranks: Record<string, TechRank> = {};
  for (const user of data.users || []) {
    const email = user.email || "";
    const stored = (user.app_metadata as { tech_rank?: unknown } | undefined)?.tech_rank;
    if (isDefaultSeniorTechEmail(email)) {
      ranks[user.id] = "senior";
      continue;
    }
    const rank = normalizeTechRank(stored);
    if (rank) ranks[user.id] = rank;
  }
  return ranks;
}

/** Telegram chat ids from auth app_metadata (numeric chat id after tech /start). */
export async function loadTelegramChatIds(): Promise<Record<string, string>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.admin.listUsers({ perPage: 200, page: 1 });
  const out: Record<string, string> = {};
  for (const user of data.users || []) {
    const raw = (user.app_metadata as { telegram_chat_id?: unknown } | undefined)
      ?.telegram_chat_id;
    if (typeof raw === "string" && raw.trim()) out[user.id] = raw.trim();
  }
  return out;
}

export async function updateEmployeeTelegramAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return;

  const id = String(formData.get("id") || "").trim();
  const chatId = String(formData.get("telegramChatId") || "").trim();
  if (!id) return;
  if (chatId && !/^-?\d{5,20}$/.test(chatId)) return;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (!profile || profile.role !== "technician") return;

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  await admin.auth.admin.updateUserById(id, {
    app_metadata: mergeAppMeta(
      authUser.user?.app_metadata as Record<string, unknown> | undefined,
      { telegram_chat_id: chatId || null },
    ),
  });

  revalidatePath("/employees");
}

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
      app_metadata: {
        role,
        ...(role === "technician"
          ? {
              tech_rank: isDefaultSeniorTechEmail(email)
                ? "senior"
                : normalizeTechRank(formData.get("techRank")) || "technician",
            }
          : {}),
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
