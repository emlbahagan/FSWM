import Link from "next/link";
import { ArrowLeft, Save, ShieldPlus, Trash2, Shield, AlertCircle } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode as RoleCodeConstants } from "@/server/rbac";
import { queryOne, queryRows } from "@/server/db";
import { updateUserAction, assignRoleAction, revokeRoleAction } from "@/app/(dashboard)/dashboard/users/actions";

export const dynamic = "force-dynamic";

type UserDetail = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

type RoleAssignmentRow = {
  assignmentId: string;
  roleCode: string;
  roleName: string;
  departmentCode: string | null;
  departmentName: string | null;
  assignedAt: Date;
};

type RoleOption = {
  roleCode: string;
  roleName: string;
};

type DepartmentOption = {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCodeConstants.SystemAdmin);

  const { userId } = await params;

  const user = await queryOne<UserDetail>(
    `
      SELECT user_id as "userId", email, first_name as "firstName", last_name as "lastName", is_active as "isActive"
      FROM users
      WHERE user_id = $1
    `,
    [userId]
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-8">
        <AlertCircle size={48} className="mx-auto text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">User Not Found</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          The requested user account does not exist or has been removed from the system.
        </p>
        <Link
          href="/dashboard/users"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal)]/90"
        >
          <ArrowLeft size={18} /> Back to User List
        </Link>
      </div>
    );
  }

  const roleAssignments = await queryRows<RoleAssignmentRow>(
    `
      SELECT 
        ura.user_role_assignment_id as "assignmentId",
        r.role_code as "roleCode",
        r.role_name as "roleName",
        d.department_code as "departmentCode",
        d.department_name as "departmentName",
        ura.assigned_at as "assignedAt"
      FROM user_role_assignments ura
      JOIN roles r ON ura.role_id = r.role_id
      LEFT JOIN departments d ON ura.scope_department_id = d.department_id
      WHERE ura.user_id = $1 AND ura.revoked_at IS NULL
      ORDER BY r.role_name
    `,
    [userId]
  );

  const roles = await queryRows<RoleOption>(`SELECT role_code as "roleCode", role_name as "roleName" FROM roles WHERE is_active = true ORDER BY role_name`);
  const departments = await queryRows<DepartmentOption>(`SELECT department_id as "departmentId", department_code as "departmentCode", department_name as "departmentName" FROM departments WHERE is_active = true ORDER BY department_name`);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/users"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage User Account</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user.email} ({user.userId})
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Account Details Form */}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Account Information</h2>
          <form action={updateUserAction} className="mt-6 space-y-6">
            <input type="hidden" name="userId" value={user.userId} />

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  defaultValue={user.firstName}
                  required
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  defaultValue={user.lastName}
                  required
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                defaultValue={user.email}
                disabled
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background/50 px-3 py-2 text-sm text-[var(--muted)] cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Email address cannot be changed after account creation.</p>
            </div>

            <div>
              <label htmlFor="isActive" className="block text-sm font-semibold">
                Account Status
              </label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={user.isActive ? "true" : "false"}
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              >
                <option value="true">Active (Allowed to sign in)</option>
                <option value="false">Inactive (Suspended account)</option>
              </select>
            </div>

            <div className="flex justify-end border-t border-[var(--line)] pt-6">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Role Assignments Panel */}
        <div className="flex flex-col gap-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Assign Role</h2>
            <form action={assignRoleAction} className="mt-6 space-y-5">
              <input type="hidden" name="userId" value={user.userId} />

              <div>
                <label htmlFor="roleCode" className="block text-sm font-semibold">
                  Select Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="roleCode"
                  name="roleCode"
                  required
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                >
                  {roles.map((role) => (
                    <option key={role.roleCode} value={role.roleCode}>
                      {role.roleName} ({role.roleCode})
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
                  <option value="">Global Scope (All Departments / Entire System)</option>
                  {departments.map((dept) => (
                    <option key={dept.departmentId} value={dept.departmentId}>
                      {dept.departmentName} ({dept.departmentCode})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  Required for department-specific roles like Department Head. Global roles should leave this blank.
                </p>
              </div>

              <div className="flex justify-end border-t border-[var(--line)] pt-5">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                >
                  <ShieldPlus size={18} /> Assign Role
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Active Role Assignments</h2>
            <div className="mt-6 space-y-3">
              {roleAssignments.map((role) => (
                <div
                  key={role.assignmentId}
                  className="flex items-center justify-between rounded-md border border-[var(--line)] bg-background p-3.5 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--teal)]/10 text-[var(--teal)]">
                      <Shield size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{role.roleName}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)] font-mono">
                        Scope: {role.departmentName ? `${role.departmentName} (${role.departmentCode})` : "Global (All Departments)"}
                      </p>
                    </div>
                  </div>
                  <form action={revokeRoleAction}>
                    <input type="hidden" name="assignmentId" value={role.assignmentId} />
                    <input type="hidden" name="userId" value={user.userId} />
                    <button
                      type="submit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--muted)] hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition"
                      title="Revoke Assignment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              ))}

              {roleAssignments.length === 0 && (
                <p className="text-sm text-[var(--muted)] italic text-center py-6 border border-dashed border-[var(--line)] rounded-md">
                  This user currently has no assigned roles.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
