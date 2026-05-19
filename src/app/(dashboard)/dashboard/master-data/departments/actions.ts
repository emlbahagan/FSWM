"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createDepartmentAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const departmentCode = formData.get("departmentCode")?.toString().trim().toUpperCase();
  const departmentName = formData.get("departmentName")?.toString().trim();

  if (!departmentCode || !departmentName) {
    throw new Error("Missing required fields");
  }

  const dept = await queryOne<{ department_id: string }>(
    `
      INSERT INTO departments (department_code, department_name, is_active)
      VALUES ($1, $2, true)
      RETURNING department_id
    `,
    [departmentCode, departmentName]
  );

  if (!dept) {
    throw new Error("Failed to create department or duplicate code");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "DEPARTMENT_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "departments",
    targetId: dept.department_id,
    newValueJson: { departmentCode, departmentName, isActive: true },
  });

  revalidatePath("/dashboard/master-data/departments");
}

export async function updateDepartmentAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const departmentId = formData.get("departmentId")?.toString();
  const departmentName = formData.get("departmentName")?.toString().trim();
  const isActive = formData.get("isActive") === "true";

  if (!departmentId || !departmentName) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE departments
      SET department_name = $1, is_active = $2, updated_at = now()
      WHERE department_id = $3
    `,
    [departmentName, isActive, departmentId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "DEPARTMENT_UPDATED",
    moduleCode: "MASTER_DATA",
    targetTable: "departments",
    targetId: departmentId,
    newValueJson: { departmentName, isActive },
  });

  revalidatePath("/dashboard/master-data/departments");
}

export async function createProgramAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const departmentId = formData.get("departmentId")?.toString();
  const programCode = formData.get("programCode")?.toString().trim().toUpperCase();
  const programName = formData.get("programName")?.toString().trim();

  if (!departmentId || !programCode || !programName) {
    throw new Error("Missing required fields");
  }

  const prog = await queryOne<{ program_id: string }>(
    `
      INSERT INTO programs (department_id, program_code, program_name, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING program_id
    `,
    [departmentId, programCode, programName]
  );

  if (!prog) {
    throw new Error("Failed to create program or duplicate code in department");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PROGRAM_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "programs",
    targetId: prog.program_id,
    newValueJson: { departmentId, programCode, programName, isActive: true },
  });

  revalidatePath("/dashboard/master-data/departments");
}

export async function updateProgramAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const programId = formData.get("programId")?.toString();
  const programName = formData.get("programName")?.toString().trim();
  const isActive = formData.get("isActive") === "true";

  if (!programId || !programName) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE programs
      SET program_name = $1, is_active = $2
      WHERE program_id = $3
    `,
    [programName, isActive, programId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PROGRAM_UPDATED",
    moduleCode: "MASTER_DATA",
    targetTable: "programs",
    targetId: programId,
    newValueJson: { programName, isActive },
  });

  revalidatePath("/dashboard/master-data/departments");
}
