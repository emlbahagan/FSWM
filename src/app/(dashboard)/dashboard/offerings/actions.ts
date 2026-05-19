"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createSectionAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const departmentId = formData.get("departmentId")?.toString();
  const programId = formData.get("programId")?.toString();
  const sectionCode = formData.get("sectionCode")?.toString().trim().toUpperCase();
  const yearLevel = parseInt(formData.get("yearLevel")?.toString() || "1", 10);

  if (!academicTermId || !departmentId || !programId || !sectionCode || yearLevel <= 0) {
    throw new Error("Missing required fields or invalid year level");
  }

  const sec = await queryOne<{ section_id: string }>(
    `
      INSERT INTO sections (academic_term_id, department_id, program_id, section_code, year_level, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING section_id
    `,
    [academicTermId, departmentId, programId, sectionCode, yearLevel]
  );

  if (!sec) {
    throw new Error("Failed to create section or duplicate section code for term");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SECTION_CREATED",
    moduleCode: "TERMS",
    targetTable: "sections",
    targetId: sec.section_id,
    newValueJson: { academicTermId, departmentId, programId, sectionCode, yearLevel, isActive: true },
  });

  revalidatePath("/dashboard/offerings");
}

export async function createOfferingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const sectionId = formData.get("sectionId")?.toString();
  const subjectId = formData.get("subjectId")?.toString();
  const expectedEnrollment = parseInt(formData.get("expectedEnrollment")?.toString() || "40", 10);
  const roomTypeId = formData.get("roomTypeId")?.toString() || null;
  const roomFeatureId = formData.get("roomFeatureId")?.toString() || null;

  if (!academicTermId || !sectionId || !subjectId || expectedEnrollment < 0) {
    throw new Error("Missing required fields or invalid enrollment");
  }

  await withTransaction(async (client) => {
    const off = await transactionQuery<{ subject_offering_id: string }>(
      client,
      `
        INSERT INTO subject_offerings (academic_term_id, section_id, subject_id, expected_enrollment, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING subject_offering_id
      `,
      [academicTermId, sectionId, subjectId, expectedEnrollment]
    );

    if (off.rowCount === 0 || !off.rows[0]) {
      throw new Error("Failed to create offering or duplicate offering in section");
    }

    const offeringId = off.rows[0].subject_offering_id;

    if (roomTypeId || roomFeatureId) {
      await transactionQuery(
        client,
        `
          INSERT INTO subject_offering_room_requirements (subject_offering_id, room_type_id, room_feature_id, is_required)
          VALUES ($1, $2, $3, true)
        `,
        [offeringId, roomTypeId || null, roomFeatureId || null]
      );
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "OFFERING_CREATED",
      moduleCode: "TERMS",
      targetTable: "subject_offerings",
      targetId: offeringId,
      newValueJson: { academicTermId, sectionId, subjectId, expectedEnrollment, roomTypeId, roomFeatureId },
    });
  });

  revalidatePath("/dashboard/offerings");
}

export async function deleteOfferingAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const offeringId = formData.get("offeringId")?.toString();

  if (!offeringId) {
    throw new Error("Missing offering ID");
  }

  // Check if offering is currently assigned or scheduled
  const assigned = await queryOne<{ schedule_assignment_id: string }>(
    `SELECT schedule_assignment_id FROM schedule_assignments WHERE subject_offering_id = $1 LIMIT 1`,
    [offeringId]
  );

  if (assigned) {
    throw new Error("Cannot delete this subject offering because it is already referenced in an active or draft class schedule. Please unassign or remove it from the schedule editor first.");
  }

  await query(
    `DELETE FROM subject_offerings WHERE subject_offering_id = $1`,
    [offeringId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "OFFERING_DELETED",
    moduleCode: "TERMS",
    targetTable: "subject_offerings",
    targetId: offeringId,
    newValueJson: { deleted: true },
  });

  revalidatePath("/dashboard/offerings");
}
