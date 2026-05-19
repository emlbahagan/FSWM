"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createWorkloadPolicyAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const departmentId = formData.get("departmentId")?.toString() || null;
  const employmentTypeId = formData.get("employmentTypeId")?.toString() || null;
  const maxUnits = parseFloat(formData.get("maxUnits")?.toString() || "0");
  const maxHours = parseFloat(formData.get("maxHours")?.toString() || "0");

  if (!academicTermId || maxUnits < 0 || maxHours < 0) {
    throw new Error("Missing required fields or invalid values");
  }

  const pol = await queryOne<{ workload_policy_id: string }>(
    `
      INSERT INTO workload_policies (academic_term_id, department_id, employment_type_id, max_units, max_hours, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING workload_policy_id
    `,
    [academicTermId, departmentId, employmentTypeId, maxUnits, maxHours]
  );

  if (!pol) {
    throw new Error("Failed to create workload policy");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "WORKLOAD_POLICY_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "workload_policies",
    targetId: pol.workload_policy_id,
    newValueJson: { academicTermId, departmentId, employmentTypeId, maxUnits, maxHours, isActive: true },
  });

  revalidatePath("/dashboard/master-data/workload");
}

export async function updateWorkloadPolicyAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const policyId = formData.get("policyId")?.toString();
  const maxUnits = parseFloat(formData.get("maxUnits")?.toString() || "0");
  const maxHours = parseFloat(formData.get("maxHours")?.toString() || "0");
  const isActive = formData.get("isActive") === "true";

  if (!policyId || maxUnits < 0 || maxHours < 0) {
    throw new Error("Missing required fields or invalid values");
  }

  await query(
    `
      UPDATE workload_policies
      SET max_units = $1, max_hours = $2, is_active = $3
      WHERE workload_policy_id = $4
    `,
    [maxUnits, maxHours, isActive, policyId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "WORKLOAD_POLICY_UPDATED",
    moduleCode: "MASTER_DATA",
    targetTable: "workload_policies",
    targetId: policyId,
    newValueJson: { maxUnits, maxHours, isActive },
  });

  revalidatePath("/dashboard/master-data/workload");
}
