import Link from "next/link";
import { ArrowLeft, Briefcase, Plus, Calendar, Building, UserCheck } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { createWorkloadPolicyAction, updateWorkloadPolicyAction } from "@/app/(dashboard)/dashboard/master-data/workload/actions";

export const dynamic = "force-dynamic";

type Department = {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
};

type EmploymentType = {
  employmentTypeId: string;
  employmentTypeCode: string;
  employmentTypeName: string;
};

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type WorkloadPolicyRow = {
  workloadPolicyId: string;
  academicTermId: string;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  employmentTypeId: string | null;
  employmentTypeName: string | null;
  maxUnits: number;
  maxHours: number;
  isActive: boolean;
};

export default async function WorkloadPoliciesPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  const departments = await queryRows<Department>(`
    SELECT department_id as "departmentId", department_code as "departmentCode", department_name as "departmentName"
    FROM departments WHERE is_active = true ORDER BY department_name
  `);

  const employmentTypes = await queryRows<EmploymentType>(`
    SELECT employment_type_id as "employmentTypeId", employment_type_code as "employmentTypeCode", employment_type_name as "employmentTypeName"
    FROM employment_types ORDER BY employment_type_name
  `);

  let policies: WorkloadPolicyRow[] = [];
  if (activeTerm) {
    policies = await queryRows<WorkloadPolicyRow>(
      `
        SELECT 
          wp.workload_policy_id as "workloadPolicyId",
          wp.academic_term_id as "academicTermId",
          wp.department_id as "departmentId",
          d.department_code as "departmentCode",
          d.department_name as "departmentName",
          wp.employment_type_id as "employmentTypeId",
          et.employment_type_name as "employmentTypeName",
          wp.max_units::float as "maxUnits",
          wp.max_hours::float as "maxHours",
          wp.is_active as "isActive"
        FROM workload_policies wp
        LEFT JOIN departments d ON wp.department_id = d.department_id
        LEFT JOIN employment_types et ON wp.employment_type_id = et.employment_type_id
        WHERE wp.academic_term_id = $1
        ORDER BY d.department_name NULLS FIRST, et.employment_type_name
      `,
      [activeTerm.academicTermId]
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/master-data"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Faculty Workload Policies</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Establish maximum unit ceilings and weekly teaching hours by employment type and department.
            </p>
          </div>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Create Workload Policy Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Briefcase size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Policy</h2>
            </div>

            {activeTerm ? (
              <form action={createWorkloadPolicyAction} className="mt-6 space-y-5">
                <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />

                <div>
                  <label htmlFor="employmentTypeId" className="block text-sm font-semibold">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="employmentTypeId"
                    name="employmentTypeId"
                    required
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {employmentTypes.map((et) => (
                      <option key={et.employmentTypeId} value={et.employmentTypeId}>
                        {et.employmentTypeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="departmentId" className="block text-sm font-semibold">
                    Department Scope
                  </label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    <option value="">Global (All Departments)</option>
                    {departments.map((dept) => (
                      <option key={dept.departmentId} value={dept.departmentId}>
                        {dept.departmentName} ({dept.departmentCode})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted)]">If blank, applies as default across all departments.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="maxUnits" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      Max Units / Sem <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      id="maxUnits"
                      name="maxUnits"
                      defaultValue="24.0"
                      required
                      className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxHours" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      Max Hrs / Wk <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      id="maxHours"
                      name="maxHours"
                      defaultValue="30.0"
                      required
                      className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                  >
                    <Plus size={18} /> Save Policy
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-6 text-sm text-[var(--muted)]">An active academic term is required to create workload policies.</p>
            )}
          </div>
        </div>

        {/* Policies List */}
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
              <thead className="bg-background/50 font-semibold text-[var(--muted)]">
                <tr>
                  <th className="px-6 py-4">Scope / Department</th>
                  <th className="px-6 py-4">Employment Type</th>
                  <th className="px-6 py-4 text-center">Max Units / Sem</th>
                  <th className="px-6 py-4 text-center">Max Hours / Wk</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {policies.map((pol) => (
                  <tr key={pol.workloadPolicyId} className="transition hover:bg-background/30">
                    <td className="px-6 py-4">
                      {pol.departmentName ? (
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-[var(--teal)]" />
                          <span className="font-semibold text-foreground">{pol.departmentName} ({pol.departmentCode})</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded bg-[var(--line)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                          Global Institution Scope
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck size={14} className="text-[var(--muted)]" /> {pol.employmentTypeName}
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-[var(--teal)]">{pol.maxUnits}</td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-[var(--teal)]">{pol.maxHours}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pol.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                        }`}
                      >
                        {pol.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={updateWorkloadPolicyAction} className="inline-flex items-center gap-2">
                        <input type="hidden" name="policyId" value={pol.workloadPolicyId} />
                        <input type="hidden" name="maxUnits" value={pol.maxUnits} />
                        <input type="hidden" name="maxHours" value={pol.maxHours} />
                        <input type="hidden" name="isActive" value={pol.isActive ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded border border-[var(--line)] bg-background px-2.5 py-1 text-xs font-semibold hover:bg-[var(--line)]/50 transition"
                        >
                          Toggle Status
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}

                {policies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[var(--muted)]">
                      No workload policies configured for this academic term yet. Use the form to set policies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
