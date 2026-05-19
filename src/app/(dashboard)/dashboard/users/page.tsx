import Link from "next/link";
import { Plus, UserCheck, UserX, Shield } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";

export const dynamic = "force-dynamic";

type UserRow = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleAssignments: {
    assignmentId: string;
    roleCode: string;
    roleName: string;
    departmentCode: string | null;
  }[];
};

export default async function UsersPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const users = await queryRows<UserRow>(`
    SELECT 
      u.user_id as "userId",
      u.email,
      u.first_name as "firstName",
      u.last_name as "lastName",
      u.is_active as "isActive",
      COALESCE(
        json_agg(
          json_build_object(
            'assignmentId', ura.user_role_assignment_id,
            'roleCode', r.role_code,
            'roleName', r.role_name,
            'departmentCode', d.department_code
          )
        ) FILTER (WHERE ura.user_role_assignment_id IS NOT NULL AND ura.revoked_at IS NULL),
        '[]'::json
      ) as "roleAssignments"
    FROM users u
    LEFT JOIN user_role_assignments ura ON u.user_id = ura.user_id AND ura.revoked_at IS NULL
    LEFT JOIN roles r ON ura.role_id = r.role_id
    LEFT JOIN departments d ON ura.scope_department_id = d.department_id
    GROUP BY u.user_id, u.email, u.first_name, u.last_name, u.is_active
    ORDER BY u.last_name, u.first_name
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage system accounts, active status, and role assignments.
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
        >
          <Plus size={18} />
          Add New User
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
            <thead className="bg-background/50 font-semibold text-[var(--muted)]">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Assigned Roles</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {users.map((user) => (
                <tr key={user.userId} className="transition hover:bg-background/30">
                  <td className="px-6 py-4 font-medium">
                    {user.lastName}, {user.firstName}
                  </td>
                  <td className="px-6 py-4 text-[var(--muted)]">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <UserCheck size={14} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                        <UserX size={14} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roleAssignments.length > 0 ? (
                        user.roleAssignments.map((role) => (
                          <span
                            key={role.assignmentId}
                            className="inline-flex items-center gap-1 rounded bg-[var(--teal)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20"
                          >
                            <Shield size={12} /> {role.roleName}
                            {role.departmentCode && ` (${role.departmentCode})`}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--muted)] italic">No roles assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/users/${user.userId}`}
                      className="inline-flex rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold hover:bg-[var(--line)]/50 transition"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[var(--muted)]">
                    No users found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
