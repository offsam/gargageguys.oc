import type { AppRole } from "@/lib/supabase/types";

export const ROLE_HOME: Record<AppRole, string> = {
  owner: "/owner",
  office: "/sheet",
  dispatcher: "/dispatch",
  accountant: "/finance",
  technician: "/field",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  office: "Office",
  dispatcher: "Dispatcher",
  accountant: "Accountant",
  technician: "Technician",
};

/** Roles an owner can create cabinets for */
export const CREATABLE_STAFF_ROLES: AppRole[] = [
  "technician",
  "dispatcher",
  "accountant",
  "office",
  "owner",
];

export const EMPLOYEE_SECTIONS: Array<{ role: AppRole; title: string; hint: string }> = [
  {
    role: "technician",
    title: "Technicians",
    hint: "Field app — jobs on /field",
  },
  {
    role: "dispatcher",
    title: "Dispatchers",
    hint: "Scheduling & assignment — /dispatch",
  },
  {
    role: "accountant",
    title: "Accountants",
    hint: "Billing & invoices — /finance",
  },
  {
    role: "office",
    title: "Office",
    hint: "Sheet & stock — /sheet",
  },
  {
    role: "owner",
    title: "Owners",
    hint: "Full business overview — /owner",
  },
];

export function homeForRole(role: AppRole | string | null | undefined): string {
  if (role && role in ROLE_HOME) {
    return ROLE_HOME[role as AppRole];
  }
  return "/login";
}
