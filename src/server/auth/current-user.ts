import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { queryRows, queryOne } from "@/server/db";
import { readSession } from "@/server/auth/session";
import type {
  AuthenticatedUser,
  PermissionAssignment,
  RoleAssignment,
} from "@/server/auth/types";

type UserRow = {
  department_id: string | null;
  email: string;
  faculty_id: string | null;
  first_name: string;
  is_active: boolean;
  last_name: string;
  user_id: string;
  force_password_reset: boolean;
};

type RoleRow = {
  role_code: string;
  role_name: string;
  scope_department_id: string | null;
};

type PermissionRow = {
  permission_code: string;
  permission_group: string;
  permission_name: string;
  scope_department_id: string | null;
};

export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const session = await readSession();

  if (!session) {
    return null;
  }

  const user = await queryOne<UserRow>(
    `
      SELECT
        u.user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.force_password_reset,
        fp.faculty_id,
        fp.department_id
      FROM users u
      LEFT JOIN faculty_profiles fp ON fp.faculty_id = u.user_id
      WHERE u.user_id = $1
    `,
    [session.sub],
  );

  if (!user?.is_active) {
    return null;
  }

  const roles = await queryRows<RoleRow>(
    `
      SELECT
        r.role_code,
        r.role_name,
        ura.scope_department_id
      FROM user_role_assignments ura
      JOIN roles r ON r.role_id = ura.role_id
      WHERE ura.user_id = $1
        AND ura.revoked_at IS NULL
        AND r.is_active = TRUE
      ORDER BY r.role_code, ura.scope_department_id NULLS FIRST
    `,
    [session.sub],
  );

  const permissions = await queryRows<PermissionRow>(
    `
      SELECT DISTINCT
        p.permission_code,
        p.permission_name,
        p.permission_group,
        ura.scope_department_id
      FROM user_role_assignments ura
      JOIN roles r ON r.role_id = ura.role_id
      JOIN role_permissions rp ON rp.role_id = r.role_id
      JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE ura.user_id = $1
        AND ura.revoked_at IS NULL
        AND r.is_active = TRUE
      ORDER BY p.permission_group, p.permission_code, ura.scope_department_id NULLS FIRST
    `,
    [session.sub],
  );

  return {
    departmentId: user.department_id,
    email: user.email,
    facultyId: user.faculty_id,
    firstName: user.first_name,
    isActive: user.is_active,
    lastName: user.last_name,
    permissions: permissions.map<PermissionAssignment>((permission) => ({
      permissionCode: permission.permission_code,
      permissionGroup: permission.permission_group,
      permissionName: permission.permission_name,
      scopeDepartmentId: permission.scope_department_id,
    })),
    roles: roles.map<RoleAssignment>((role) => ({
      roleCode: role.role_code,
      roleName: role.role_name,
      scopeDepartmentId: role.scope_department_id,
    })),
    userId: user.user_id,
    forcePasswordReset: user.force_password_reset,
  };
});

export async function requireCurrentUser(options?: { allowForceResetPage?: boolean }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.forcePasswordReset && !options?.allowForceResetPage) {
    redirect("/change-password");
  }

  return user;
}
