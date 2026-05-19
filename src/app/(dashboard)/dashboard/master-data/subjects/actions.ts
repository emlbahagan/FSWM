"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createSubjectAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const subjectCode = formData.get("subjectCode")?.toString().trim().toUpperCase();
  const subjectTitle = formData.get("subjectTitle")?.toString().trim();
  const lectureUnits = parseFloat(formData.get("lectureUnits")?.toString() || "0");
  const laboratoryUnits = parseFloat(formData.get("laboratoryUnits")?.toString() || "0");
  const lectureHours = parseFloat(formData.get("lectureHours")?.toString() || "0");
  const laboratoryHours = parseFloat(formData.get("laboratoryHours")?.toString() || "0");

  if (!subjectCode || !subjectTitle) {
    throw new Error("Subject Code and Title are required");
  }

  if (lectureUnits < 0 || laboratoryUnits < 0 || lectureHours < 0 || laboratoryHours < 0) {
    throw new Error("Units and hours cannot be negative");
  }

  if (lectureUnits === 0 && laboratoryUnits === 0) {
    throw new Error("Subject must have at least some lecture or laboratory units");
  }

  if (lectureHours === 0 && laboratoryHours === 0) {
    throw new Error("Subject must have at least some lecture or laboratory weekly hours");
  }

  const subj = await queryOne<{ subject_id: string }>(
    `
      INSERT INTO subjects (subject_code, subject_title, lecture_units, laboratory_units, lecture_hours, laboratory_hours, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING subject_id
    `,
    [subjectCode, subjectTitle, lectureUnits, laboratoryUnits, lectureHours, laboratoryHours]
  );

  if (!subj) {
    throw new Error("Failed to create subject or duplicate code");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SUBJECT_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "subjects",
    targetId: subj.subject_id,
    newValueJson: { subjectCode, subjectTitle, lectureUnits, laboratoryUnits, lectureHours, laboratoryHours, isActive: true },
  });

  revalidatePath("/dashboard/master-data/subjects");
}

export async function updateSubjectAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const subjectId = formData.get("subjectId")?.toString();
  const subjectTitle = formData.get("subjectTitle")?.toString().trim();
  const lectureUnits = parseFloat(formData.get("lectureUnits")?.toString() || "0");
  const laboratoryUnits = parseFloat(formData.get("laboratoryUnits")?.toString() || "0");
  const lectureHours = parseFloat(formData.get("lectureHours")?.toString() || "0");
  const laboratoryHours = parseFloat(formData.get("laboratoryHours")?.toString() || "0");
  const isActive = formData.get("isActive") === "true";

  if (!subjectId || !subjectTitle) {
    throw new Error("Subject ID and Title are required");
  }

  if (lectureUnits < 0 || laboratoryUnits < 0 || lectureHours < 0 || laboratoryHours < 0) {
    throw new Error("Units and hours cannot be negative");
  }

  if (lectureUnits === 0 && laboratoryUnits === 0) {
    throw new Error("Subject must have at least some lecture or laboratory units");
  }

  if (lectureHours === 0 && laboratoryHours === 0) {
    throw new Error("Subject must have at least some lecture or laboratory weekly hours");
  }

  await query(
    `
      UPDATE subjects
      SET subject_title = $1, lecture_units = $2, laboratory_units = $3, lecture_hours = $4, laboratory_hours = $5, is_active = $6
      WHERE subject_id = $7
    `,
    [subjectTitle, lectureUnits, laboratoryUnits, lectureHours, laboratoryHours, isActive, subjectId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SUBJECT_UPDATED",
    moduleCode: "MASTER_DATA",
    targetTable: "subjects",
    targetId: subjectId,
    newValueJson: { subjectTitle, lectureUnits, laboratoryUnits, lectureHours, laboratoryHours, isActive },
  });

  revalidatePath("/dashboard/master-data/subjects");
}
