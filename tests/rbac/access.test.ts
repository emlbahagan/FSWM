import { describe, it, expect } from "vitest";
import { canAccessFacultyRecord, hasDepartmentScope, hasRole, RoleCode } from "@/server/rbac";
import type { AuthenticatedUser } from "@/server/auth/types";

describe("RBAC Access Utilities", () => {
  const mockUser: AuthenticatedUser = {
    userId: "123",
    email: "test@fswm.edu",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    departmentId: null,
    facultyId: null,
    roles: [
      { roleCode: RoleCode.Faculty, roleName: "Faculty", scopeDepartmentId: null },
      { roleCode: RoleCode.DepartmentHead, roleName: "Department Head", scopeDepartmentId: "dept-cs" }
    ],
    permissions: []
  };

  it("should return true if user has the global role", () => {
    expect(hasRole(mockUser, RoleCode.Faculty)).toBe(true);
  });

  it("should return true if user has the role in a specific department", () => {
    expect(hasRole(mockUser, RoleCode.DepartmentHead, { departmentId: "dept-cs" })).toBe(true);
  });

  it("should return false if user does not have the role", () => {
    expect(hasRole(mockUser, RoleCode.SystemAdmin)).toBe(false);
  });

  it("should return false if user has the role but in a different department scope", () => {
    expect(hasRole(mockUser, RoleCode.DepartmentHead, { departmentId: "dept-it" })).toBe(false);
  });

  it("should return true for any department if user has a global role assignment", () => {
    const globalAdmin: AuthenticatedUser = {
      ...mockUser,
      roles: [{ roleCode: RoleCode.SystemAdmin, roleName: "System Admin", scopeDepartmentId: null }]
    };
    expect(hasRole(globalAdmin, RoleCode.SystemAdmin, { departmentId: "any-dept" })).toBe(true);
  });

  it("should enforce department scope for scoped department heads", () => {
    expect(hasDepartmentScope(mockUser, "dept-cs", { roleCode: RoleCode.DepartmentHead })).toBe(true);
    expect(hasDepartmentScope(mockUser, "dept-it", { roleCode: RoleCode.DepartmentHead })).toBe(false);
  });

  it("should allow faculty self-access without granting other faculty records", () => {
    const facultyUser: AuthenticatedUser = {
      ...mockUser,
      facultyId: "faculty-1",
      roles: [{ roleCode: RoleCode.Faculty, roleName: "Faculty", scopeDepartmentId: "dept-cs" }]
    };

    expect(canAccessFacultyRecord(facultyUser, "faculty-1")).toBe(true);
    expect(canAccessFacultyRecord(facultyUser, "faculty-2")).toBe(false);
  });
});
