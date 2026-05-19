"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/server/db";
import { requireCurrentUser, recordAuditLog, hashPassword } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createUserAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const rawPassword = formData.get("password")?.toString();

  if (!email || !firstName || !lastName || !rawPassword) {
    throw new Error("Missing required fields");
  }

  const passwordHash = await hashPassword(rawPassword);

  const newUser = await queryOne<{ user_id: string }>(
    `
      INSERT INTO users (email, first_name, last_name, password_hash, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING user_id
    `,
    [email, firstName, lastName, passwordHash]
  );

  if (!newUser) {
    throw new Error("Failed to create user");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "USER_CREATED",
    moduleCode: "USERS",
    targetTable: "users",
    targetId: newUser.user_id,
    newValueJson: { email, firstName, lastName, isActive: true },
  });

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const userId = formData.get("userId")?.toString();
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const isActive = formData.get("isActive") === "true";

  if (!userId || !firstName || !lastName) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE users
      SET first_name = $1, last_name = $2, is_active = $3, updated_at = now()
      WHERE user_id = $4
    `,
    [firstName, lastName, isActive, userId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "USER_UPDATED",
    moduleCode: "USERS",
    targetTable: "users",
    targetId: userId,
    newValueJson: { firstName, lastName, isActive },
  });

  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

export async function assignRoleAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const userId = formData.get("userId")?.toString();
  const roleCode = formData.get("roleCode")?.toString();
  const rawDeptId = formData.get("departmentId")?.toString();
  const departmentId = rawDeptId ? rawDeptId : null;

  if (!userId || !roleCode) {
    throw new Error("Missing required fields");
  }

  const role = await queryOne<{ role_id: string }>(
    `SELECT role_id FROM roles WHERE role_code = $1`,
    [roleCode]
  );

  if (!role) {
    throw new Error("Invalid role code");
  }

  const scopeCondition = departmentId ? `scope_department_id = $3` : `scope_department_id IS NULL`;
  const queryParams = departmentId ? [userId, role.role_id, departmentId] : [userId, role.role_id];

  const existing = await queryOne<{ user_role_assignment_id: string }>(
    `
      SELECT user_role_assignment_id
      FROM user_role_assignments
      WHERE user_id = $1 AND role_id = $2 AND ${scopeCondition} AND revoked_at IS NULL
    `,
    queryParams
  );

  if (existing) {
    throw new Error(`User already has active role assignment for ${roleCode} in this scope.`);
  }

  const assignment = await queryOne<{ user_role_assignment_id: string }>(
    `
      INSERT INTO user_role_assignments (user_id, role_id, scope_department_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING user_role_assignment_id
    `,
    [userId, role.role_id, departmentId, currentUser.userId]
  );

  if (!assignment) {
    throw new Error("Failed to assign role or duplicate assignment exists");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "ROLE_ASSIGNED",
    moduleCode: "USERS",
    targetTable: "user_role_assignments",
    targetId: assignment.user_role_assignment_id,
    newValueJson: { userId, roleCode, departmentId },
  });

  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath("/dashboard/users");
}

export async function revokeRoleAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const assignmentId = formData.get("assignmentId")?.toString();
  const userId = formData.get("userId")?.toString();

  if (!assignmentId || !userId) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE user_role_assignments
      SET revoked_at = now()
      WHERE user_role_assignment_id = $1 AND revoked_at IS NULL
    `,
    [assignmentId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "ROLE_REVOKED",
    moduleCode: "USERS",
    targetTable: "user_role_assignments",
    targetId: assignmentId,
    newValueJson: { status: "REVOKED" },
  });

  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath("/dashboard/users");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const userId = formData.get("userId")?.toString();

  if (!userId) {
    throw new Error("Missing required fields");
  }

  if (userId === currentUser.userId) {
    redirect(`/dashboard/users/${userId}?error=${encodeURIComponent("You cannot hard delete your own active administrator account.")}`);
  }

  try {
    // 1. Relational database integrity pre-flight checks
    const checkSchedules = await queryOne<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1 FROM schedule_assignments 
          WHERE created_by = $1 
          OR faculty_term_profile_id IN (
            SELECT faculty_term_profile_id FROM faculty_term_profiles WHERE faculty_id = $1
          )
        ) as "exists"
      `,
      [userId]
    );

    const checkLockedTerms = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM academic_terms WHERE locked_by = $1) as "exists"`,
      [userId]
    );

    const checkRevisions = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schedule_revision_history WHERE changed_by = $1) as "exists"`,
      [userId]
    );

    const checkApprovals = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schedule_review_records WHERE reviewed_by = $1 OR submitted_by = $1) as "exists"`,
      [userId]
    );

    const checkOverloads = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM overload_override_requests WHERE requested_by = $1 OR decided_by = $1) as "exists"`,
      [userId]
    );

    const checkUnlocks = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schedule_unlock_requests WHERE requested_by = $1 OR decided_by = $1) as "exists"`,
      [userId]
    );

    const checkReleases = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schedule_release_logs WHERE released_by = $1) as "exists"`,
      [userId]
    );

    if (
      checkSchedules?.exists ||
      checkLockedTerms?.exists ||
      checkRevisions?.exists ||
      checkApprovals?.exists ||
      checkOverloads?.exists ||
      checkUnlocks?.exists ||
      checkReleases?.exists
    ) {
      redirect(
        `/dashboard/users/${userId}?error=${encodeURIComponent(
          "This account has active academic footprint data (schedules, revision logs, reviews, overload requests, unlocks, or locked terms) and cannot be hard deleted. Set their status to Inactive to suspend access."
        )}`
      );
    }

    // 2. Cascade delete minor scoped references in transactional boundary
    await query(`DELETE FROM user_role_assignments WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM faculty_availability WHERE faculty_term_profile_id IN (SELECT faculty_term_profile_id FROM faculty_term_profiles WHERE faculty_id = $1)`, [userId]);
    await query(`DELETE FROM faculty_specializations WHERE faculty_id = $1`, [userId]);
    await query(`DELETE FROM faculty_term_profiles WHERE faculty_id = $1`, [userId]);
    await query(`DELETE FROM faculty_profiles WHERE faculty_id = $1`, [userId]);
    await query(`DELETE FROM audit_logs WHERE actor_user_id = $1`, [userId]); // clear their logs to allow foreign key delete
    await query(`DELETE FROM users WHERE user_id = $1`, [userId]);

    // 3. Log deletion audit record from the Admin actor's perspective
    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "USER_HARD_DELETED",
      moduleCode: "USERS",
      targetTable: "users",
      targetId: userId,
      newValueJson: { status: "DELETED_PERMANENTLY" },
    });
  } catch (err: unknown) {
    const errorObject = err as { message?: string; digest?: string };
    if (errorObject.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const msg = errorObject.message || "An unexpected error occurred during permanent deletion.";
    redirect(`/dashboard/users/${userId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

