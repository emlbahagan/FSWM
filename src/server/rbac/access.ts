import "server-only";

import { redirect } from "next/navigation";
import type { AuthenticatedUser } from "@/server/auth";
import type { PermissionCode, RoleCode } from "@/server/rbac/constants";

type ScopedAccessOptions = {
  allowGlobal?: boolean;
  anyScope?: boolean;
  departmentId?: string | null;
};

type DepartmentScopeOptions = {
  includeFacultyDepartment?: boolean;
  roleCode?: RoleCode;
};

function isScopeMatch(
  scopeDepartmentId: string | null,
  departmentId: string | null | undefined,
  allowGlobal = true,
  anyScope = false,
) {
  if (anyScope) {
    return true;
  }

  if (!departmentId) {
    return scopeDepartmentId === null;
  }

  return scopeDepartmentId === departmentId || (allowGlobal && scopeDepartmentId === null);
}

export function hasRole(
  user: AuthenticatedUser,
  roleCode: RoleCode,
  options: ScopedAccessOptions = {},
) {
  return user.roles.some(
    (role) =>
      role.roleCode === roleCode &&
      isScopeMatch(
        role.scopeDepartmentId,
        options.departmentId,
        options.allowGlobal ?? true,
        options.anyScope ?? false,
      ),
  );
}

export function hasAnyRole(
  user: AuthenticatedUser,
  roleCodes: readonly RoleCode[],
  options: ScopedAccessOptions = {},
) {
  return roleCodes.some((roleCode) => hasRole(user, roleCode, options));
}

export function hasPermission(
  user: AuthenticatedUser,
  permissionCode: PermissionCode,
  options: ScopedAccessOptions = {},
) {
  return user.permissions.some(
    (permission) =>
      permission.permissionCode === permissionCode &&
      isScopeMatch(
        permission.scopeDepartmentId,
        options.departmentId,
        options.allowGlobal ?? true,
        options.anyScope ?? false,
      ),
  );
}

export function hasDepartmentScope(
  user: AuthenticatedUser,
  departmentId: string,
  options: DepartmentScopeOptions = {},
) {
  if (options.includeFacultyDepartment && user.departmentId === departmentId) {
    return true;
  }

  return user.roles.some((role) => {
    if (options.roleCode && role.roleCode !== options.roleCode) {
      return false;
    }

    return role.scopeDepartmentId === null || role.scopeDepartmentId === departmentId;
  });
}

export function canAccessFacultyRecord(
  user: AuthenticatedUser,
  facultyId: string,
  roleCodes: readonly RoleCode[] = [],
  options: ScopedAccessOptions = {},
) {
  return user.facultyId === facultyId || hasAnyRole(user, roleCodes, options);
}

export function requireRole(
  user: AuthenticatedUser,
  roleCode: RoleCode,
  options: ScopedAccessOptions = {},
) {
  if (!hasRole(user, roleCode, options)) {
    redirect("/unauthorized");
  }

  return user;
}

export function requireAnyRole(
  user: AuthenticatedUser,
  roleCodes: readonly RoleCode[],
  options: ScopedAccessOptions = {},
) {
  if (!hasAnyRole(user, roleCodes, options)) {
    redirect("/unauthorized");
  }

  return user;
}

export function requirePermission(
  user: AuthenticatedUser,
  permissionCode: PermissionCode,
  options: ScopedAccessOptions = {},
) {
  if (!hasPermission(user, permissionCode, options)) {
    redirect("/unauthorized");
  }

  return user;
}

export function requireDepartmentScope(
  user: AuthenticatedUser,
  departmentId: string,
  options: DepartmentScopeOptions = {},
) {
  if (!hasDepartmentScope(user, departmentId, options)) {
    redirect("/unauthorized");
  }

  return user;
}

export function requireFacultySelfOrRole(
  user: AuthenticatedUser,
  facultyId: string,
  roleCodes: readonly RoleCode[] = [],
  options: ScopedAccessOptions = {},
) {
  if (!canAccessFacultyRecord(user, facultyId, roleCodes, options)) {
    redirect("/unauthorized");
  }

  return user;
}

