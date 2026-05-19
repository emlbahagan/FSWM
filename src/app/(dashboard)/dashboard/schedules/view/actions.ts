"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireAnyRole, RoleCode } from "@/server/rbac";

export async function releaseScheduleAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Registrar], { anyScope: true });

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const releaseNotes = formData.get("releaseNotes")?.toString() || "Final schedule released for instructional term.";

  if (!scheduleVersionId) throw new Error("Missing schedule version ID");

  const status = await queryOne<{ schedule_status_id: string }>(
    `SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'RELEASED'`
  );
  if (!status) throw new Error("Status lookup failed");

  await withTransaction(async (client) => {
    const released = await transactionQuery<{ schedule_version_id: string }>(
      client,
      `
        UPDATE schedule_versions
        SET schedule_status_id = $1, released_by = $2, released_at = now()
        WHERE schedule_version_id = $3
          AND schedule_status_id = (
            SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'APPROVED'
          )
        RETURNING schedule_version_id
      `,
      [status.schedule_status_id, currentUser.userId, scheduleVersionId]
    );

    if (released.rowCount !== 1) {
      throw new Error("Only approved schedule versions can be released");
    }

    const relLog = await transactionQuery<{ schedule_release_log_id: string }>(
      client,
      `
        INSERT INTO schedule_release_logs (schedule_version_id, released_by, release_notes)
        VALUES ($1, $2, $3)
        RETURNING schedule_release_log_id
      `,
      [scheduleVersionId, currentUser.userId, releaseNotes]
    );

    if (relLog.rows[0]) {
      const releaseLogId = relLog.rows[0].schedule_release_log_id;

      // Seed acknowledgements for all faculty assigned in this version
      await transactionQuery(
        client,
        `
          INSERT INTO faculty_schedule_acknowledgements (schedule_release_log_id, schedule_version_id, faculty_id)
          SELECT DISTINCT $1, $2, fp.faculty_id
          FROM schedule_assignments sa
          JOIN faculty_term_profiles ftp ON sa.faculty_term_profile_id = ftp.faculty_term_profile_id
          JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
          WHERE sa.schedule_version_id = $2 AND sa.faculty_term_profile_id IS NOT NULL
          ON CONFLICT (schedule_release_log_id, faculty_id) DO NOTHING
        `,
        [releaseLogId, scheduleVersionId]
      );
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "SCHEDULE_RELEASED",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { releaseNotes, status: "RELEASED" },
    });
  });

  revalidatePath("/dashboard/schedules/view");
}

export async function acknowledgeScheduleAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Faculty], { anyScope: true });
  const facultyId = currentUser.facultyId;

  const acknowledgementId = formData.get("acknowledgementId")?.toString();
  const acknowledgementNote = formData.get("acknowledgementNote")?.toString().trim() || null;

  if (!acknowledgementId) throw new Error("Missing acknowledgement ID");
  if (!facultyId) throw new Error("Faculty profile is required to acknowledge a schedule");

  const updated = await query<{ faculty_schedule_acknowledgement_id: string }>(
    `
      UPDATE faculty_schedule_acknowledgements
      SET acknowledged_at = now(), acknowledgement_note = $1
      WHERE faculty_schedule_acknowledgement_id = $2
        AND faculty_id = $3
      RETURNING faculty_schedule_acknowledgement_id
    `,
    [acknowledgementNote, acknowledgementId, facultyId]
  );

  if (updated.rowCount !== 1) {
    throw new Error("Schedule acknowledgement is not assigned to the current faculty user");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SCHEDULE_ACKNOWLEDGED",
    moduleCode: "SCHEDULING",
    targetTable: "faculty_schedule_acknowledgements",
    targetId: acknowledgementId,
    newValueJson: { acknowledgementNote },
  });

  revalidatePath("/dashboard/schedules/view");
}

export async function recordScheduleViewAction(acknowledgementId: string) {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Faculty], { anyScope: true });
  const facultyId = currentUser.facultyId;

  if (!facultyId) {
    throw new Error("Faculty profile is required to record schedule view");
  }

  await query(
    `
      UPDATE faculty_schedule_acknowledgements
      SET viewed_at = now()
      WHERE faculty_schedule_acknowledgement_id = $1
        AND faculty_id = $2
        AND viewed_at IS NULL
    `,
    [acknowledgementId, facultyId]
  );
}
