import "server-only";

export type RoleAssignment = {
  roleCode: string;
  roleName: string;
  scopeDepartmentId: string | null;
};

export type PermissionAssignment = {
  permissionCode: string;
  permissionGroup: string;
  permissionName: string;
  scopeDepartmentId: string | null;
};

export type AuthenticatedUser = {
  departmentId: string | null;
  email: string;
  facultyId: string | null;
  firstName: string;
  isActive: boolean;
  lastName: string;
  permissions: PermissionAssignment[];
  roles: RoleAssignment[];
  userId: string;
};

export type SessionPayload = {
  exp: number;
  sub: string;
};
