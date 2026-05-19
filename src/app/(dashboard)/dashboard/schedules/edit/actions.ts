"use server";

import { revalidatePath } from "next/cache";
import { queryOne, withTransaction, transactionQuery, type TransactionClient } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

async function assertScheduleVersionEditable(client: TransactionClient, scheduleVersionId: string) {
  await transactionQuery(client, `SELECT assert_schedule_version_editable($1::uuid)`, [scheduleVersionId]);
}

async function assertOfferingInScheduleTerm(client: TransactionClient, scheduleVersionId: string, subjectOfferingId: string) {
  const offering = await transactionQuery<{ subject_offering_id: string }>(
    client,
    `
      SELECT so.subject_offering_id
      FROM schedule_versions sv
      JOIN subject_offerings so ON so.academic_term_id = sv.academic_term_id
      WHERE sv.schedule_version_id = $1
        AND so.subject_offering_id = $2
      LIMIT 1
    `,
    [scheduleVersionId, subjectOfferingId]
  );

  if (offering.rowCount !== 1) {
    throw new Error("Subject offering does not belong to the schedule version academic term");
  }
}

async function assertFacultyProfileInScheduleTerm(
  client: TransactionClient,
  scheduleVersionId: string,
  facultyTermProfileId: string | null,
) {
  if (!facultyTermProfileId) return;

  const profile = await transactionQuery<{ faculty_term_profile_id: string }>(
    client,
    `
      SELECT ftp.faculty_term_profile_id
      FROM schedule_versions sv
      JOIN faculty_term_profiles ftp ON ftp.academic_term_id = sv.academic_term_id
      WHERE sv.schedule_version_id = $1
        AND ftp.faculty_term_profile_id = $2
      LIMIT 1
    `,
    [scheduleVersionId, facultyTermProfileId]
  );

  if (profile.rowCount !== 1) {
    throw new Error("Faculty term profile does not belong to the schedule version academic term");
  }
}

export async function createVersionAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  if (!academicTermId) throw new Error("Missing academic term ID");

  await withTransaction(async (client) => {
    // Check highest version number
    const maxVer = await transactionQuery<{ version_number: number; schedule_status_code: string; schedule_version_id: string }>(
      client,
      `
        SELECT sv.version_number, ss.schedule_status_code, sv.schedule_version_id
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        WHERE sv.academic_term_id = $1
        ORDER BY sv.version_number DESC LIMIT 1
      `,
      [academicTermId]
    );

    const draftStatus = await transactionQuery<{ schedule_status_id: string }>(
      client,
      `SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'DRAFT'`
    );
    if (!draftStatus.rows[0]) throw new Error("Missing DRAFT status");

    let newVersionNum = 1;
    let parentVersionId: string | null = null;

    if (maxVer.rows[0]) {
      const curr = maxVer.rows[0];
      if (["DRAFT", "SUBMITTED", "CORRECTION_OPEN"].includes(curr.schedule_status_code)) {
        throw new Error(`An editable version v${curr.version_number} (${curr.schedule_status_code}) already exists.`);
      }
      newVersionNum = curr.version_number + 1;
      parentVersionId = curr.schedule_version_id;
    }

    const newVer = await transactionQuery<{ schedule_version_id: string }>(
      client,
      `
        INSERT INTO schedule_versions (academic_term_id, version_number, schedule_status_id, created_by, parent_schedule_version_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING schedule_version_id
      `,
      [academicTermId, newVersionNum, draftStatus.rows[0].schedule_status_id, currentUser.userId, parentVersionId]
    );

    if (!newVer.rows[0]) throw new Error("Failed to create version");

    // Copy assignments from parent version if exists
    if (parentVersionId) {
      await transactionQuery(
        client,
        `
          INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, faculty_term_profile_id, assignment_status_id, created_by)
          SELECT $1, subject_offering_id, faculty_term_profile_id, assignment_status_id, $2
          FROM schedule_assignments
          WHERE schedule_version_id = $3
        `,
        [newVer.rows[0].schedule_version_id, currentUser.userId, parentVersionId]
      );
    } else {
      // Seed initial assignments for all offerings in term
      const assignedStatus = await transactionQuery<{ assignment_status_id: string }>(
        client,
        `SELECT assignment_status_id FROM assignment_statuses WHERE assignment_status_code = 'UNRESOLVED'`
      );

      if (assignedStatus.rows[0]) {
        await transactionQuery(
          client,
          `
            INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, assignment_status_id, created_by)
            SELECT $1, subject_offering_id, $2, $3
            FROM subject_offerings
            WHERE academic_term_id = $4
          `,
          [newVer.rows[0].schedule_version_id, assignedStatus.rows[0].assignment_status_id, currentUser.userId, academicTermId]
        );
      }
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "SCHEDULE_VERSION_CREATED",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: newVer.rows[0].schedule_version_id,
      newValueJson: { versionNumber: newVersionNum, academicTermId },
    });
  });

  revalidatePath("/dashboard/schedules/edit");
}

export async function assignFacultyAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const subjectOfferingId = formData.get("subjectOfferingId")?.toString();
  const facultyTermProfileId = formData.get("facultyTermProfileId")?.toString() || null;

  if (!scheduleVersionId || !subjectOfferingId) {
    throw new Error("Missing required fields");
  }

  const assignedStatus = await queryOne<{ assignment_status_id: string }>(
    `SELECT assignment_status_id FROM assignment_statuses WHERE assignment_status_code = $1`,
    [facultyTermProfileId ? "ASSIGNED" : "UNRESOLVED"]
  );

  if (!assignedStatus) throw new Error("Status lookup failed");

  const result = await withTransaction(async (client) => {
    await assertScheduleVersionEditable(client, scheduleVersionId);
    await assertOfferingInScheduleTerm(client, scheduleVersionId, subjectOfferingId);
    await assertFacultyProfileInScheduleTerm(client, scheduleVersionId, facultyTermProfileId);

    const assignment = await transactionQuery<{ schedule_assignment_id: string }>(
      client,
      `SELECT schedule_assignment_id FROM schedule_assignments WHERE schedule_version_id = $1 AND subject_offering_id = $2`,
      [scheduleVersionId, subjectOfferingId]
    );

    let assignmentId: string;

    if (assignment.rowCount === 0 || !assignment.rows[0]) {
      const newAssig = await transactionQuery<{ schedule_assignment_id: string }>(
        client,
        `
          INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, faculty_term_profile_id, assignment_status_id, created_by)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING schedule_assignment_id
        `,
        [scheduleVersionId, subjectOfferingId, facultyTermProfileId, assignedStatus.assignment_status_id, currentUser.userId]
      );
      if (newAssig.rowCount === 0 || !newAssig.rows[0]) throw new Error("Failed to insert assignment");
      assignmentId = newAssig.rows[0].schedule_assignment_id;
    } else {
      assignmentId = assignment.rows[0].schedule_assignment_id;
      await transactionQuery(
        client,
        `
          UPDATE schedule_assignments
          SET faculty_term_profile_id = $1, assignment_status_id = $2, updated_at = now()
          WHERE schedule_assignment_id = $3
        `,
        [facultyTermProfileId, assignedStatus.assignment_status_id, assignmentId]
      );
    }

    // Insert revision history
    const actionType = await transactionQuery<{ revision_action_type_id: number }>(
      client,
      `SELECT revision_action_type_id FROM revision_action_types WHERE revision_action_code = 'ASSIGNMENT_UPDATED'`
    );

    if (actionType.rows[0]) {
      await transactionQuery(
        client,
        `
          INSERT INTO schedule_revision_history (schedule_version_id, schedule_assignment_id, revision_action_type_id, new_value_json, changed_by)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [scheduleVersionId, assignmentId, actionType.rows[0].revision_action_type_id, JSON.stringify({ facultyTermProfileId }), currentUser.userId]
      );
    }

    return { assignmentId };
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SCHEDULE_ASSIGNMENT_UPDATED",
    moduleCode: "SCHEDULING",
    targetTable: "schedule_assignments",
    targetId: result.assignmentId,
    newValueJson: { scheduleVersionId, subjectOfferingId, facultyTermProfileId },
  });

  revalidatePath("/dashboard/schedules/edit");
}

export async function saveMeetingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const subjectOfferingId = formData.get("subjectOfferingId")?.toString();
  const roomId = formData.get("roomId")?.toString();
  const termTimeSlotId = formData.get("termTimeSlotId")?.toString();
  const meetingType = formData.get("meetingType")?.toString() || "LECTURE";

  if (!scheduleVersionId || !subjectOfferingId || !roomId || !termTimeSlotId) {
    throw new Error("Missing required fields");
  }

  const result = await withTransaction(async (client) => {
    await assertScheduleVersionEditable(client, scheduleVersionId);
    await assertOfferingInScheduleTerm(client, scheduleVersionId, subjectOfferingId);

    const validSlot = await transactionQuery<{ term_time_slot_id: string }>(
      client,
      `
        SELECT tts.term_time_slot_id
        FROM schedule_versions sv
        JOIN term_time_slots tts ON tts.academic_term_id = sv.academic_term_id
        WHERE sv.schedule_version_id = $1
          AND tts.term_time_slot_id = $2
          AND tts.is_enabled = true
        LIMIT 1
      `,
      [scheduleVersionId, termTimeSlotId]
    );

    if (validSlot.rowCount !== 1) {
      throw new Error("Time slot does not belong to the schedule version academic term");
    }

    // Get assignment id
    const assignment = await transactionQuery<{ schedule_assignment_id: string }>(
      client,
      `SELECT schedule_assignment_id FROM schedule_assignments WHERE schedule_version_id = $1 AND subject_offering_id = $2`,
      [scheduleVersionId, subjectOfferingId]
    );

    let assignmentId: string;

    if (assignment.rowCount === 0 || !assignment.rows[0]) {
      const assignedStatus = await transactionQuery<{ assignment_status_id: string }>(
        client,
        `SELECT assignment_status_id FROM assignment_statuses WHERE assignment_status_code = 'UNRESOLVED'`
      );
      if (!assignedStatus.rows[0]) throw new Error("Status lookup failed");

      const newAssig = await transactionQuery<{ schedule_assignment_id: string }>(
        client,
        `
          INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, assignment_status_id, created_by)
          VALUES ($1, $2, $3, $4)
          RETURNING schedule_assignment_id
        `,
        [scheduleVersionId, subjectOfferingId, assignedStatus.rows[0].assignment_status_id, currentUser.userId]
      );
      if (newAssig.rowCount === 0 || !newAssig.rows[0]) throw new Error("Failed to create assignment");
      assignmentId = newAssig.rows[0].schedule_assignment_id;
    } else {
      assignmentId = assignment.rows[0].schedule_assignment_id;
    }

    const meeting = await transactionQuery<{ schedule_meeting_id: string }>(
      client,
      `
        INSERT INTO schedule_meetings (schedule_assignment_id, term_time_slot_id, room_id, meeting_type)
        VALUES ($1, $2, $3, $4)
        RETURNING schedule_meeting_id
      `,
      [assignmentId, termTimeSlotId, roomId, meetingType]
    );

    if (meeting.rows[0]) {
      const actionType = await transactionQuery<{ revision_action_type_id: number }>(
        client,
        `SELECT revision_action_type_id FROM revision_action_types WHERE revision_action_code = 'MEETING_CREATED'`
      );

      if (actionType.rows[0]) {
        await transactionQuery(
          client,
          `
            INSERT INTO schedule_revision_history (schedule_version_id, schedule_assignment_id, schedule_meeting_id, revision_action_type_id, new_value_json, changed_by)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [scheduleVersionId, assignmentId, meeting.rows[0].schedule_meeting_id, actionType.rows[0].revision_action_type_id, JSON.stringify({ roomId, termTimeSlotId, meetingType }), currentUser.userId]
        );
      }

      return { meetingId: meeting.rows[0].schedule_meeting_id, assignmentId };
    }

    throw new Error("Failed to create meeting");
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SCHEDULE_MEETING_CREATED",
    moduleCode: "SCHEDULING",
    targetTable: "schedule_meetings",
    targetId: result.meetingId,
    newValueJson: { scheduleVersionId, subjectOfferingId, roomId, termTimeSlotId, meetingType, assignmentId: result.assignmentId },
  });

  revalidatePath("/dashboard/schedules/edit");
}

export async function deleteMeetingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const meetingId = formData.get("meetingId")?.toString();

  if (!scheduleVersionId || !meetingId) {
    throw new Error("Missing required fields");
  }

  const result = await withTransaction(async (client) => {
    await assertScheduleVersionEditable(client, scheduleVersionId);

    const meeting = await transactionQuery<{
      schedule_assignment_id: string;
      schedule_meeting_id: string;
    }>(
      client,
      `
        SELECT
          sm.schedule_meeting_id,
          sm.schedule_assignment_id
        FROM schedule_meetings sm
        JOIN schedule_assignments sa ON sm.schedule_assignment_id = sa.schedule_assignment_id
        WHERE sm.schedule_meeting_id = $1
          AND sa.schedule_version_id = $2
      `,
      [meetingId, scheduleVersionId]
    );

    if (!meeting.rows[0]) {
      throw new Error("Meeting does not belong to the selected schedule version");
    }

    const actionType = await transactionQuery<{ revision_action_type_id: number }>(
      client,
      `SELECT revision_action_type_id FROM revision_action_types WHERE revision_action_code = 'MEETING_DELETED'`
    );

    if (actionType.rows[0]) {
      await transactionQuery(
        client,
        `
          INSERT INTO schedule_revision_history (schedule_version_id, schedule_assignment_id, revision_action_type_id, old_value_json, changed_by)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [scheduleVersionId, meeting.rows[0].schedule_assignment_id, actionType.rows[0].revision_action_type_id, JSON.stringify({ meetingId }), currentUser.userId]
      );
    }

    await transactionQuery(
      client,
      `DELETE FROM schedule_meetings WHERE schedule_meeting_id = $1`,
      [meetingId]
    );

    return { assignmentId: meeting.rows[0].schedule_assignment_id };
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SCHEDULE_MEETING_DELETED",
    moduleCode: "SCHEDULING",
    targetTable: "schedule_meetings",
    targetId: meetingId,
    oldValueJson: { scheduleVersionId, assignmentId: result.assignmentId },
  });

  revalidatePath("/dashboard/schedules/edit");
}

export async function submitVersionAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const submissionNotes = formData.get("submissionNotes")?.toString() || "Submitted for departmental review.";

  if (!scheduleVersionId) throw new Error("Missing schedule version ID");

  const status = await queryOne<{ schedule_status_id: string }>(
    `SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'SUBMITTED'`
  );
  if (!status) throw new Error("Status lookup failed");

  await withTransaction(async (client) => {
    // Close out any active correction session / unlock request
    await transactionQuery(
      client,
      `
        UPDATE schedule_unlock_requests
        SET decision_status = 'USED',
            used_at = COALESCE(used_at, now()),
            correction_submitted_at = now(),
            correction_closed_at = COALESCE(correction_closed_at, now())
        WHERE schedule_version_id = $1
          AND decision_status = 'APPROVED'
      `,
      [scheduleVersionId]
    );

    const submitted = await transactionQuery<{ schedule_version_id: string }>(
      client,
      `
        UPDATE schedule_versions
        SET schedule_status_id = $1, submitted_by = $2, submitted_at = now()
        WHERE schedule_version_id = $3
          AND schedule_status_id IN (
            SELECT schedule_status_id
            FROM schedule_statuses
            WHERE schedule_status_code IN ('DRAFT', 'CORRECTION_OPEN')
          )
        RETURNING schedule_version_id
      `,
      [status.schedule_status_id, currentUser.userId, scheduleVersionId]
    );

    if (submitted.rowCount !== 1) {
      throw new Error("Only draft or correction-open schedule versions can be submitted for review");
    }

    await transactionQuery(
      client,
      `
        INSERT INTO schedule_review_records (schedule_version_id, submitted_by, decision_status, decision_reason)
        VALUES ($1, $2, 'PENDING', $3)
      `,
      [scheduleVersionId, currentUser.userId, submissionNotes]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "SCHEDULE_SUBMITTED",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { submissionNotes, status: "SUBMITTED", correctionSessionClosed: true },
    });
  });

  revalidatePath("/dashboard/schedules/edit");
  revalidatePath("/dashboard/approval");
}

import { runAutoScheduler, type AutoScheduleResultSummary } from "@/server/validation/auto-scheduling";

export async function autoScheduleAction(
  scheduleVersionId: string,
  prioritizeDept: boolean,
  maximizeRoomEfficiency: boolean
): Promise<AutoScheduleResultSummary> {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  if (!scheduleVersionId) throw new Error("Missing schedule version ID");

  const result = await withTransaction(async (client) => {
    // 1. Fetch original version info
    const version = await transactionQuery<{
      academic_term_id: string;
      version_number: number;
      schedule_status_code: string;
    }>(
      client,
      `
        SELECT sv.academic_term_id, sv.version_number, ss.schedule_status_code
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        WHERE sv.schedule_version_id = $1
      `,
      [scheduleVersionId]
    );

    if (version.rowCount === 0 || !version.rows[0]) {
      throw new Error("Schedule version not found");
    }

    const ver = version.rows[0];
    const academicTermId = ver.academic_term_id;
    const backupVersionNum = -1000 - ver.version_number;

    // Check if editable
    if (!["DRAFT", "CORRECTION_OPEN"].includes(ver.schedule_status_code)) {
      throw new Error("Only draft or correction-open schedule versions can be auto-scheduled");
    }

    // 2. Clear any existing backup for this version
    await transactionQuery(
      client,
      `
        DELETE FROM schedule_versions 
        WHERE academic_term_id = $1 AND version_number = $2
      `,
      [academicTermId, backupVersionNum]
    );

    const draftStatus = await transactionQuery<{ schedule_status_id: string }>(
      client,
      `SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'DRAFT'`
    );
    if (!draftStatus.rows[0]) throw new Error("Draft status lookup failed");

    // 3. Create Backup Version
    const backupVer = await transactionQuery<{ schedule_version_id: string }>(
      client,
      `
        INSERT INTO schedule_versions (academic_term_id, version_number, schedule_status_id, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING schedule_version_id
      `,
      [academicTermId, backupVersionNum, draftStatus.rows[0].schedule_status_id, currentUser.userId]
    );
    const backupVersionId = backupVer.rows[0].schedule_version_id;

    // 4. Copy current assignments to backup
    await transactionQuery(
      client,
      `
        INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, faculty_term_profile_id, assignment_status_id, overload_override_request_id, created_by)
        SELECT $1, subject_offering_id, faculty_term_profile_id, assignment_status_id, overload_override_request_id, $2
        FROM schedule_assignments
        WHERE schedule_version_id = $3
      `,
      [backupVersionId, currentUser.userId, scheduleVersionId]
    );

    // 5. Copy current meetings to backup
    await transactionQuery(
      client,
      `
        INSERT INTO schedule_meetings (schedule_assignment_id, term_time_slot_id, room_id, meeting_type)
        SELECT 
          (
            SELECT sa_new.schedule_assignment_id 
            FROM schedule_assignments sa_new 
            WHERE sa_new.schedule_version_id = $1 AND sa_new.subject_offering_id = sa_old.subject_offering_id
            LIMIT 1
          ), 
          sm.term_time_slot_id, sm.room_id, sm.meeting_type
        FROM schedule_meetings sm
        JOIN schedule_assignments sa_old ON sm.schedule_assignment_id = sa_old.schedule_assignment_id
        WHERE sa_old.schedule_version_id = $2
      `,
      [backupVersionId, scheduleVersionId]
    );

    // 6. Run the Auto-Scheduler Solver
    const solverResult = await runAutoScheduler(
      scheduleVersionId,
      { prioritizeDept, maximizeRoomEfficiency },
      currentUser.userId
    );

    return {
      ...solverResult,
      backupVersionId,
    };
  });

  revalidatePath("/dashboard/schedules/edit");
  return result;
}

export async function rollbackAutoScheduleAction(
  scheduleVersionId: string,
  backupVersionId: string
): Promise<{ success: boolean }> {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  if (!scheduleVersionId || !backupVersionId) {
    throw new Error("Missing required parameters");
  }

  await withTransaction(async (client) => {
    // 1. Verify backup belongs to correct term/version
    const originalVer = await transactionQuery<{ version_number: number; academic_term_id: string }>(
      client,
      `SELECT version_number, academic_term_id FROM schedule_versions WHERE schedule_version_id = $1`,
      [scheduleVersionId]
    );
    const backupVer = await transactionQuery<{ version_number: number; academic_term_id: string }>(
      client,
      `SELECT version_number, academic_term_id FROM schedule_versions WHERE schedule_version_id = $1`,
      [backupVersionId]
    );

    if (!originalVer.rows[0] || !backupVer.rows[0]) {
      throw new Error("Invalid original or backup version");
    }

    const orig = originalVer.rows[0];
    const back = backupVer.rows[0];

    if (back.version_number !== -1000 - orig.version_number || back.academic_term_id !== orig.academic_term_id) {
      throw new Error("Backup mismatch with original version");
    }

    // 2. Delete all current meetings and assignments on original
    await transactionQuery(
      client,
      `
        DELETE FROM schedule_meetings 
        WHERE schedule_assignment_id IN (
          SELECT schedule_assignment_id FROM schedule_assignments WHERE schedule_version_id = $1
        )
      `,
      [scheduleVersionId]
    );

    await transactionQuery(
      client,
      `DELETE FROM schedule_assignments WHERE schedule_version_id = $1`,
      [scheduleVersionId]
    );

    // 3. Copy back assignments from backup
    await transactionQuery(
      client,
      `
        INSERT INTO schedule_assignments (schedule_version_id, subject_offering_id, faculty_term_profile_id, assignment_status_id, overload_override_request_id, created_by)
        SELECT $1, subject_offering_id, faculty_term_profile_id, assignment_status_id, overload_override_request_id, $2
        FROM schedule_assignments
        WHERE schedule_version_id = $3
      `,
      [scheduleVersionId, currentUser.userId, backupVersionId]
    );

    // 4. Copy back meetings from backup
    await transactionQuery(
      client,
      `
        INSERT INTO schedule_meetings (schedule_assignment_id, term_time_slot_id, room_id, meeting_type)
        SELECT 
          (
            SELECT sa_new.schedule_assignment_id 
            FROM schedule_assignments sa_new 
            WHERE sa_new.schedule_version_id = $1 AND sa_new.subject_offering_id = sa_old.subject_offering_id
            LIMIT 1
          ), 
          sm.term_time_slot_id, sm.room_id, sm.meeting_type
        FROM schedule_meetings sm
        JOIN schedule_assignments sa_old ON sm.schedule_assignment_id = sa_old.schedule_assignment_id
        WHERE sa_old.schedule_version_id = $2
      `,
      [scheduleVersionId, backupVersionId]
    );

    // 5. Delete backup version
    await transactionQuery(
      client,
      `DELETE FROM schedule_versions WHERE schedule_version_id = $1`,
      [backupVersionId]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "SCHEDULE_AUTO_GENERATED_ROLLBACK",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { rolledBack: true, backupVersionId },
    });
  });

  revalidatePath("/dashboard/schedules/edit");
  return { success: true };
}

export async function commitAutoScheduleAction(
  scheduleVersionId: string,
  backupVersionId: string
): Promise<{ success: boolean }> {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  if (!scheduleVersionId || !backupVersionId) {
    throw new Error("Missing required parameters");
  }

  await withTransaction(async (client) => {
    // Delete the backup version
    await transactionQuery(
      client,
      `DELETE FROM schedule_versions WHERE schedule_version_id = $1`,
      [backupVersionId]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "SCHEDULE_AUTO_GENERATED_COMMITTED",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { committed: true, backupVersionId },
    });
  });

  revalidatePath("/dashboard/schedules/edit");
  return { success: true };
}

