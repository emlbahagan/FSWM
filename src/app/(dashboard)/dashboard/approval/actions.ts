"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireDepartmentScope, requireRole, RoleCode } from "@/server/rbac";
import { validateScheduleVersion } from "@/server/validation/scheduling";

type ScheduleDepartmentRow = {
  departmentId: string;
};

async function requireScheduleDepartmentScope(
  currentUser: Awaited<ReturnType<typeof requireCurrentUser>>,
  scheduleVersionId: string,
) {
  const departments = await query<ScheduleDepartmentRow>(
    `
      SELECT DISTINCT d.department_id as "departmentId"
      FROM schedule_assignments sa
      JOIN subject_offerings so ON sa.subject_offering_id = so.subject_offering_id
      JOIN sections sec ON so.section_id = sec.section_id
      JOIN departments d ON sec.department_id = d.department_id
      WHERE sa.schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  if (departments.rowCount === 0) {
    throw new Error("Schedule version has no department-scoped assignments");
  }

  for (const department of departments.rows) {
    requireDepartmentScope(currentUser, department.departmentId, { roleCode: RoleCode.DepartmentHead });
  }
}

export async function decideScheduleAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.DepartmentHead, { anyScope: true });

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const decision = formData.get("decision")?.toString(); // APPROVED or REJECTED
  const decisionReason = formData.get("decisionReason")?.toString().trim();

  if (!scheduleVersionId || !decision) {
    throw new Error("Missing required fields");
  }

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw new Error("Invalid schedule review decision");
  }

  if (decision === "REJECTED" && (!decisionReason || !decisionReason.trim())) {
    throw new Error("Rejection reason is required");
  }

  await requireScheduleDepartmentScope(currentUser, scheduleVersionId);

  if (decision === "APPROVED") {
    const validationReport = await validateScheduleVersion(scheduleVersionId);
    const blockingResults = validationReport.results.filter((result) => result.severity === "ERROR");

    if (blockingResults.length > 0) {
      throw new Error(`Schedule cannot be approved with blocking validation results: ${blockingResults.map((result) => result.code).join(", ")}`);
    }
  }

  const targetStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
  const status = await queryOne<{ schedule_status_id: string }>(
    `SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = $1`,
    [targetStatus]
  );
  if (!status) throw new Error("Status lookup failed");

  await withTransaction(async (client) => {
    const currentVersion = await transactionQuery<{ schedule_status_code: string }>(
      client,
      `
        SELECT ss.schedule_status_code
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        WHERE sv.schedule_version_id = $1
      `,
      [scheduleVersionId]
    );

    if (currentVersion.rows[0]?.schedule_status_code !== "SUBMITTED") {
      throw new Error("Only submitted schedule versions can be reviewed");
    }

    if (decision === "APPROVED") {
      const approved = await transactionQuery<{ schedule_version_id: string }>(
        client,
        `
          UPDATE schedule_versions
          SET schedule_status_id = $1, approved_by = $2, approved_at = now()
          WHERE schedule_version_id = $3
          RETURNING schedule_version_id
        `,
        [status.schedule_status_id, currentUser.userId, scheduleVersionId]
      );

      if (approved.rowCount !== 1) {
        throw new Error("Failed to approve schedule version");
      }
    } else {
      const rejected = await transactionQuery<{ schedule_version_id: string }>(
        client,
        `
          UPDATE schedule_versions
          SET schedule_status_id = $1, submitted_by = null, submitted_at = null
          WHERE schedule_version_id = $2
          RETURNING schedule_version_id
        `,
        [status.schedule_status_id, scheduleVersionId]
      );

      if (rejected.rowCount !== 1) {
        throw new Error("Failed to reject schedule version");
      }
    }

    await transactionQuery(
      client,
      `
        UPDATE schedule_review_records
        SET decision_status = $1, reviewed_by = $2, reviewed_at = now(), decision_reason = $3
        WHERE schedule_version_id = $4 AND decision_status = 'PENDING'
      `,
      [decision, currentUser.userId, decisionReason || null, scheduleVersionId]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: `SCHEDULE_${decision}`,
      moduleCode: "APPROVAL",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { decision, decisionReason },
    });
  });

  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/schedules/view");
}

export async function decideOverloadAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.DepartmentHead, { anyScope: true });

  const overloadRequestId = formData.get("overloadRequestId")?.toString();
  const decision = formData.get("decision")?.toString(); // APPROVED or REJECTED
  const decisionReason = formData.get("decisionReason")?.toString().trim();

  if (!overloadRequestId || !decision) {
    throw new Error("Missing required fields");
  }

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw new Error("Invalid overload decision");
  }

  if (decision === "REJECTED" && (!decisionReason || !decisionReason.trim())) {
    throw new Error("Rejection reason is required");
  }

  const target = await queryOne<{ departmentId: string }>(
    `
      SELECT fp.department_id as "departmentId"
      FROM overload_override_requests oor
      JOIN faculty_term_profiles ftp ON oor.faculty_term_profile_id = ftp.faculty_term_profile_id
      JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
      WHERE oor.overload_override_request_id = $1
      LIMIT 1
    `,
    [overloadRequestId]
  );

  if (!target) throw new Error("Overload request not found");
  requireDepartmentScope(currentUser, target.departmentId, { roleCode: RoleCode.DepartmentHead });

  const updated = await query<{ overload_override_request_id: string }>(
    `
      UPDATE overload_override_requests
      SET decision_status = $1, decided_by = $2, decided_at = now(), decision_reason = $3
      WHERE overload_override_request_id = $4 AND decision_status = 'PENDING'
      RETURNING overload_override_request_id
    `,
    [decision, currentUser.userId, decisionReason || null, overloadRequestId]
  );

  if (updated.rowCount !== 1) {
    throw new Error("Only pending overload requests can be decided");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: `OVERLOAD_${decision}`,
    moduleCode: "APPROVAL",
    targetTable: "overload_override_requests",
    targetId: overloadRequestId,
    newValueJson: { decision, decisionReason },
  });

  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/schedules/edit");
}

export async function createOverloadRequestAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const academicTermId = formData.get("academicTermId")?.toString();
  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const facultyTermProfileId = formData.get("facultyTermProfileId")?.toString();
  const requestReason = formData.get("requestReason")?.toString().trim();

  if (!academicTermId || !scheduleVersionId || !facultyTermProfileId || !requestReason) {
    throw new Error("Missing required fields");
  }

  const target = await queryOne<{ facultyTermProfileId: string }>(
    `
      SELECT ftp.faculty_term_profile_id as "facultyTermProfileId"
      FROM faculty_term_profiles ftp
      JOIN schedule_versions sv ON sv.academic_term_id = ftp.academic_term_id
      WHERE ftp.faculty_term_profile_id = $1
        AND sv.schedule_version_id = $2
        AND ftp.academic_term_id = $3
      LIMIT 1
    `,
    [facultyTermProfileId, scheduleVersionId, academicTermId]
  );

  if (!target) {
    throw new Error("Overload request must target a faculty profile in the same academic term as the schedule version");
  }

  const req = await queryOne<{ overload_override_request_id: string }>(
    `
      INSERT INTO overload_override_requests (academic_term_id, schedule_version_id, faculty_term_profile_id, requested_by, request_reason, decision_status)
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING overload_override_request_id
    `,
    [academicTermId, scheduleVersionId, facultyTermProfileId, currentUser.userId, requestReason]
  );

  if (!req) throw new Error("Failed or duplicate overload request");

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "OVERLOAD_REQUESTED",
    moduleCode: "APPROVAL",
    targetTable: "overload_override_requests",
    targetId: req.overload_override_request_id,
    newValueJson: { requestReason, facultyTermProfileId },
  });

  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/schedules/edit");
}

export async function createUnlockRequestAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const requestReason = formData.get("requestReason")?.toString().trim();

  if (!scheduleVersionId || !requestReason) {
    throw new Error("Missing required fields");
  }

  const target = await queryOne<{ scheduleVersionId: string }>(
    `
      SELECT sv.schedule_version_id as "scheduleVersionId"
      FROM schedule_versions sv
      JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
      WHERE sv.schedule_version_id = $1
        AND ss.schedule_status_code IN ('APPROVED', 'RELEASED')
      LIMIT 1
    `,
    [scheduleVersionId]
  );

  if (!target) {
    throw new Error("Unlock requests can only target approved or released schedule versions");
  }

  const req = await queryOne<{ schedule_unlock_request_id: string }>(
    `
      INSERT INTO schedule_unlock_requests (schedule_version_id, requested_by, request_reason, decision_status)
      VALUES ($1, $2, $3, 'PENDING')
      RETURNING schedule_unlock_request_id
    `,
    [scheduleVersionId, currentUser.userId, requestReason]
  );

  if (!req) throw new Error("Failed or duplicate pending unlock request");

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "UNLOCK_REQUESTED",
    moduleCode: "SCHEDULING",
    targetTable: "schedule_unlock_requests",
    targetId: req.schedule_unlock_request_id,
    newValueJson: { requestReason, scheduleVersionId },
  });

  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/unlocks");
}
