import "server-only";

export { recordAuditLog, recordLoginAudit } from "@/server/auth/audit";
export { getCurrentUser, requireCurrentUser } from "@/server/auth/current-user";
export { hashPassword, verifyPassword } from "@/server/auth/password";
export {
  clearSession,
  createSession,
  readSession,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
export type {
  AuthenticatedUser,
  PermissionAssignment,
  RoleAssignment,
  SessionPayload,
} from "@/server/auth/types";
