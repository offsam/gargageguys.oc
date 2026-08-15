import { BosShell } from "@/components/bos/BosShell";
import { CreateEmployeeForm } from "@/components/bos/CreateEmployeeForm";
import { requireRouteAccess } from "@/lib/auth/require";
import { EMPLOYEE_SECTIONS, ROLE_HOME, ROLE_LABELS } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateEmployeeRoleAction } from "@/app/actions/employees";
import type { AppRole } from "@/lib/supabase/types";
import Link from "next/link";

export default async function EmployeesPage() {
  const user = await requireRouteAccess("/employees");

  const supabase = await createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  const staff = profiles || [];

  return (
    <BosShell
      user={user}
      active="/employees"
      title="Employees"
      subtitle="Cabinets for technicians, dispatchers, office, and finance"
    >
      <div className="emp-toolbar">
        <CreateEmployeeForm />
      </div>

      <div className="emp-sections">
        {EMPLOYEE_SECTIONS.map((section) => {
          const people = staff.filter((p) => p.role === section.role);
          return (
            <section key={section.role} className="emp-section bos-card">
              <div className="emp-section-head">
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.hint}</p>
                </div>
                <div className="emp-section-actions">
                  <span className="bos-badge">{people.length}</span>
                  <CreateEmployeeForm defaultRole={section.role} />
                </div>
              </div>

              {people.length === 0 ? (
                <p className="emp-empty">No {section.title.toLowerCase()} yet. Use + to create a cabinet.</p>
              ) : (
                <table className="bos-table emp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / login</th>
                      <th>Cabinet</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={person.id}>
                        <td>{person.full_name || "—"}</td>
                        <td>{person.email}</td>
                        <td>
                          <Link href={ROLE_HOME[person.role as AppRole]}>
                            {ROLE_HOME[person.role as AppRole]}
                          </Link>
                        </td>
                        <td>
                          <form action={updateEmployeeRoleAction} className="emp-role-form">
                            <input type="hidden" name="id" value={person.id} />
                            <select name="role" defaultValue={person.role}>
                              {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            <button type="submit">Save</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </BosShell>
  );
}
