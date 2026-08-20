import { BosShell } from "@/components/bos/BosShell";
import { CreateEmployeeForm } from "@/components/bos/CreateEmployeeForm";
import { requireRouteAccess } from "@/lib/auth/require";
import { EMPLOYEE_SECTIONS, ROLE_HOME, ROLE_LABELS } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  updateEmployeeRoleAction,
  updateEmployeeTechRankAction,
  updateEmployeeTelegramAction,
  loadTechRanks,
  loadTelegramChatIds,
  ensureDefaultSeniorTechs,
} from "@/app/actions/employees";
import { techRankLabel, type TechRank } from "@/lib/auth/tech-rank";
import type { AppRole } from "@/lib/supabase/types";
import Link from "next/link";

export default async function EmployeesPage() {
  const user = await requireRouteAccess("/employees");

  const supabase = await createSupabaseServerClient();
  await ensureDefaultSeniorTechs().catch(() => null);
  const [{ data: profiles }, techRanks, telegramIds] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true }),
    loadTechRanks().catch(() => ({} as Record<string, TechRank>)),
    loadTelegramChatIds().catch(() => ({} as Record<string, string>)),
  ]);

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

      <p className="emp-telegram-hint bos-card">
        <strong>Telegram for techs:</strong> each technician opens your Garage Guys bot and sends{" "}
        <code>/start</code>. Then paste their numeric chat id here (from @userinfobot or BotFather
        getUpdates). When a job is Scheduled to them, they get a Telegram message.
      </p>

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
                      {section.role === "technician" ? <th>Telegram chat id</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={person.id}>
                        <td>
                          {person.full_name || "—"}
                          {person.role === "technician" && techRanks[person.id] === "senior" ? (
                            <div className="emp-rank">{techRankLabel("senior")}</div>
                          ) : null}
                        </td>
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
                          {person.role === "technician" ? (
                            <form action={updateEmployeeTechRankAction} className="emp-role-form">
                              <input type="hidden" name="id" value={person.id} />
                              <select
                                name="techRank"
                                defaultValue={techRanks[person.id] || "technician"}
                              >
                                <option value="technician">Technician</option>
                                <option value="senior">Senior technician</option>
                              </select>
                              <button type="submit">Save rank</button>
                            </form>
                          ) : null}
                        </td>
                        {section.role === "technician" ? (
                          <td>
                            <form action={updateEmployeeTelegramAction} className="emp-role-form emp-telegram-form">
                              <input type="hidden" name="id" value={person.id} />
                              <input
                                name="telegramChatId"
                                defaultValue={telegramIds[person.id] || ""}
                                placeholder="e.g. 728807017"
                                inputMode="numeric"
                                autoComplete="off"
                              />
                              <button type="submit">
                                {telegramIds[person.id] ? "Update" : "Link"}
                              </button>
                            </form>
                            {telegramIds[person.id] ? (
                              <div className="emp-rank emp-telegram-ok">Linked</div>
                            ) : (
                              <div className="emp-rank emp-telegram-miss">Not linked</div>
                            )}
                          </td>
                        ) : null}
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
