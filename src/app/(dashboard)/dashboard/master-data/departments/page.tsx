import Link from "next/link";
import { ArrowLeft, Building2, Plus, GraduationCap } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { createDepartmentAction, updateDepartmentAction, createProgramAction, updateProgramAction } from "@/app/(dashboard)/dashboard/master-data/departments/actions";

export const dynamic = "force-dynamic";

type DepartmentRow = {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  programs: {
    programId: string;
    programCode: string;
    programName: string;
    isActive: boolean;
  }[];
};

export default async function DepartmentsPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const departments = await queryRows<DepartmentRow>(`
    SELECT 
      d.department_id as "departmentId",
      d.department_code as "departmentCode",
      d.department_name as "departmentName",
      d.is_active as "isActive",
      COALESCE(
        json_agg(
          json_build_object(
            'programId', p.program_id,
            'programCode', p.program_code,
            'programName', p.program_name,
            'isActive', p.is_active
          )
        ) FILTER (WHERE p.program_id IS NOT NULL),
        '[]'::json
      ) as "programs"
    FROM departments d
    LEFT JOIN programs p ON d.department_id = p.department_id
    GROUP BY d.department_id, d.department_code, d.department_name, d.is_active
    ORDER BY d.department_code
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/master-data"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments & Programs</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configure institutional academic units and mapped degree programs.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2fr]">
        {/* Create Department Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Building2 size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Department</h2>
            </div>
            <form action={createDepartmentAction} className="mt-6 space-y-5">
              <div>
                <label htmlFor="departmentCode" className="block text-sm font-semibold">
                  Department Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="departmentCode"
                  name="departmentCode"
                  required
                  placeholder="CS"
                  className="mt-2 w-full font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">Unique uppercase code (e.g., CS, IT, MATH).</p>
              </div>

              <div>
                <label htmlFor="departmentName" className="block text-sm font-semibold">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="departmentName"
                  name="departmentName"
                  required
                  placeholder="Computer Science Department"
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                >
                  <Plus size={18} /> Create Department
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Existing Departments & Programs List */}
        <div className="space-y-6">
          {departments.map((dept) => (
            <div
              key={dept.departmentId}
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm"
            >
              <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                      {dept.departmentCode}
                    </span>
                    <h3 className="font-bold text-lg text-foreground">{dept.departmentName}</h3>
                  </div>
                </div>

                <form action={updateDepartmentAction} className="flex items-center gap-2">
                  <input type="hidden" name="departmentId" value={dept.departmentId} />
                  <input type="hidden" name="departmentName" value={dept.departmentName} />
                  <select
                    name="isActive"
                    defaultValue={dept.isActive ? "true" : "false"}
                    className="rounded border border-[var(--line)] bg-background px-2.5 py-1 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                  >
                    <option value="true">Active Dept</option>
                    <option value="false">Inactive Dept</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                  >
                    Update
                  </button>
                </form>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap size={16} /> Mapped Degree Programs ({dept.programs.length})
                  </h4>
                </div>

                <div className="mt-4 space-y-3">
                  {dept.programs.map((prog) => (
                    <div
                      key={prog.programId}
                      className="flex items-center justify-between rounded-md border border-[var(--line)] bg-background p-3.5 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--teal)]">
                            {prog.programCode}
                          </span>
                          <p className="font-semibold text-sm text-foreground">{prog.programName}</p>
                        </div>
                      </div>

                      <form action={updateProgramAction} className="flex items-center gap-2">
                        <input type="hidden" name="programId" value={prog.programId} />
                        <input type="hidden" name="programName" value={prog.programName} />
                        <select
                          name="isActive"
                          defaultValue={prog.isActive ? "true" : "false"}
                          className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-xs font-medium focus:border-[var(--teal)] focus:outline-none"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-xs font-medium text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                        >
                          Update
                        </button>
                      </form>
                    </div>
                  ))}

                  {dept.programs.length === 0 && (
                    <p className="text-xs text-[var(--muted)] italic text-center py-4 border border-dashed border-[var(--line)] rounded-md">
                      No degree programs added to this department yet.
                    </p>
                  )}
                </div>

                {/* Add Program Inline Form */}
                <form action={createProgramAction} className="mt-6 border-t border-[var(--line)] pt-4 flex flex-col sm:flex-row gap-3">
                  <input type="hidden" name="departmentId" value={dept.departmentId} />
                  <input
                    type="text"
                    name="programCode"
                    required
                    placeholder="Program Code (e.g. BSCS)"
                    className="w-full sm:w-48 font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  />
                  <input
                    type="text"
                    name="programName"
                    required
                    placeholder="Program Name (e.g. Bachelor of Science in Computer Science)"
                    className="flex-1 rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90"
                  >
                    <Plus size={14} /> Add Program
                  </button>
                </form>
              </div>
            </div>
          ))}

          {departments.length === 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              No academic departments configured yet. Use the form on the left to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
