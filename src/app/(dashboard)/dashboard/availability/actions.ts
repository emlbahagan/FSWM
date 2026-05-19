"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { hasRole, requireAnyRole, requireRole, RoleCode } from "@/server/rbac";

type FacultyTermProfileOwner = {
  academicTermId: string;
  departmentId: string;
  facultyId: string;
};

export async function createWindowAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const scopeDepartmentId = formData.get("scopeDepartmentId")?.toString() || null;
  const opensAt = formData.get("opensAt")?.toString();
  const closesAt = formData.get("closesAt")?.toString();

  if (!academicTermId || !opensAt || !closesAt) {
    throw new Error("Missing required fields");
  }

  if (new Date(opensAt) >= new Date(closesAt)) {
    throw new Error("Close time must be after open time");
  }

  const status = await queryOne<{ availability_window_status_id: string }>(
    `SELECT availability_window_status_id FROM availability_window_statuses WHERE availability_window_status_code = 'OPEN'`
  );

  if (!status) throw new Error("Status lookup failed");

  const win = await queryOne<{ availability_submission_window_id: string }>(
    `
      INSERT INTO availability_submission_windows (academic_term_id, scope_department_id, window_status_id, opens_at, closes_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING availability_submission_window_id
    `,
    [academicTermId, scopeDepartmentId || null, status.availability_window_status_id, opensAt, closesAt, currentUser.userId]
  );

  if (!win) {
    throw new Error("Failed to create submission window or duplicate active window exists");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "AVAILABILITY_WINDOW_CREATED",
    moduleCode: "AVAILABILITY",
    targetTable: "availability_submission_windows",
    targetId: win.availability_submission_window_id,
    newValueJson: { academicTermId, scopeDepartmentId, opensAt, closesAt },
  });

  revalidatePath("/dashboard/availability");
}

export async function updateWindowStatusAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const windowId = formData.get("windowId")?.toString();
  const statusCode = formData.get("statusCode")?.toString();

  if (!windowId || !statusCode) {
    throw new Error("Missing required fields");
  }

  const status = await queryOne<{ availability_window_status_id: string }>(
    `SELECT availability_window_status_id FROM availability_window_statuses WHERE availability_window_status_code = $1`,
    [statusCode]
  );

  if (!status) throw new Error("Invalid status code");

  await query(
    `
      UPDATE availability_submission_windows
      SET window_status_id = $1
      WHERE availability_submission_window_id = $2
    `,
    [status.availability_window_status_id, windowId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "AVAILABILITY_WINDOW_UPDATED",
    moduleCode: "AVAILABILITY",
    targetTable: "availability_submission_windows",
    targetId: windowId,
    newValueJson: { statusCode },
  });

  revalidatePath("/dashboard/availability");
}

export async function saveAvailabilityAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Faculty, RoleCode.Registrar], { anyScope: true });

  const facultyTermProfileId = formData.get("facultyTermProfileId")?.toString();

  if (!facultyTermProfileId) {
    throw new Error("Missing faculty profile ID");
  }

  const targetProfile = await queryOne<FacultyTermProfileOwner>(
    `
      SELECT
        ftp.academic_term_id as "academicTermId",
        fp.department_id as "departmentId",
        fp.faculty_id as "facultyId"
      FROM faculty_term_profiles ftp
      JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
      WHERE ftp.faculty_term_profile_id = $1
      LIMIT 1
    `,
    [facultyTermProfileId]
  );

  if (!targetProfile) {
    throw new Error("Faculty term profile not found");
  }

  const isRegistrar = hasRole(currentUser, RoleCode.Registrar, { anyScope: true });
  const isSelfSubmission = currentUser.facultyId === targetProfile.facultyId;

  if (!isRegistrar && !isSelfSubmission) {
    throw new Error("You can only submit your own availability");
  }

  if (!isRegistrar) {
    const openWindow = await queryOne<{ windowId: string }>(
      `
        SELECT w.availability_submission_window_id as "windowId"
        FROM availability_submission_windows w
        JOIN availability_window_statuses s ON w.window_status_id = s.availability_window_status_id
        WHERE w.academic_term_id = $1
          AND s.availability_window_status_code = 'OPEN'
          AND w.opens_at <= now()
          AND w.closes_at > now()
          AND (w.scope_department_id IS NULL OR w.scope_department_id = $2)
        LIMIT 1
      `,
      [targetProfile.academicTermId, targetProfile.departmentId]
    );

    if (!openWindow) {
      throw new Error("Availability submission window is closed");
    }
  }

  const isAdminEncoded = isRegistrar && !isSelfSubmission;

  // Find all status codes mapped
  const statuses = await query<{ availability_status_id: string; availability_status_code: string }>(
    `SELECT availability_status_id, availability_status_code FROM availability_statuses`
  );

  const statusMap = new Map(statuses.rows.map((s) => [s.availability_status_code, s.availability_status_id]));

  await withTransaction(async (client) => {
    // Clear previous availability for this profile
    await transactionQuery(
      client,
      `DELETE FROM faculty_availability WHERE faculty_term_profile_id = $1`,
      [facultyTermProfileId]
    );

    // Insert submitted entries
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("slot_")) {
        const termTimeSlotId = key.replace("slot_", "");
        const statusCode = value.toString();
        const statusId = statusMap.get(statusCode);

        if (!statusId) {
          throw new Error("Invalid availability status");
        }

        if (statusId && statusCode !== "UNAVAILABLE") {
          const inserted = await transactionQuery(
            client,
            `
              INSERT INTO faculty_availability (faculty_term_profile_id, term_time_slot_id, availability_status_id, submitted_by, is_admin_encoded)
              SELECT $1, tts.term_time_slot_id, $3, $4, $5
              FROM term_time_slots tts
              WHERE tts.term_time_slot_id = $2
                AND tts.academic_term_id = $6
            `,
            [
              facultyTermProfileId,
              termTimeSlotId,
              statusId,
              currentUser.userId,
              isAdminEncoded,
              targetProfile.academicTermId,
            ]
          );

          if (inserted.rowCount !== 1) {
            throw new Error("Invalid availability time slot");
          }
        }
      }
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "AVAILABILITY_SUBMITTED",
      moduleCode: "AVAILABILITY",
      targetTable: "faculty_term_profiles",
      targetId: facultyTermProfileId,
      newValueJson: { isAdminEncoded, submittedAt: new Date().toISOString() },
    });
  });

  revalidatePath("/dashboard/availability");
}

export async function acceptPrivacyNoticeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const noticeId = formData.get("privacyNoticeId")?.toString();

  if (!noticeId) throw new Error("Missing notice ID");

  await query(
    `
      INSERT INTO privacy_notice_acceptances (user_id, privacy_notice_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [currentUser.userId, noticeId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PRIVACY_ACCEPTED",
    moduleCode: "PRIVACY",
    targetTable: "privacy_notice_acceptances",
    targetId: currentUser.userId,
    newValueJson: { noticeId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/availability");
}
