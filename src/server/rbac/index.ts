import "server-only";

export {
  canAccessFacultyRecord,
  hasAnyRole,
  hasDepartmentScope,
  hasPermission,
  hasRole,
  requireAnyRole,
  requireDepartmentScope,
  requireFacultySelfOrRole,
  requirePermission,
  requireRole,
} from "@/server/rbac/access";
export {
  PermissionCode,
  RoleCode,
  type PermissionCode as PermissionCodeType,
  type RoleCode as RoleCodeType,
} from "@/server/rbac/constants";

