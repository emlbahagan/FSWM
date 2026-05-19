"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createTimeSlotAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const startTime = formData.get("startTime")?.toString();
  const endTime = formData.get("endTime")?.toString();
  const label = formData.get("label")?.toString().trim();

  if (!startTime || !endTime || !label) {
    throw new Error("Missing required fields");
  }

  if (startTime >= endTime) {
    throw new Error("Start time must be before end time");
  }

  const slot = await queryOne<{ time_slot_id: string }>(
    `
      INSERT INTO time_slots (start_time, end_time, label)
      VALUES ($1, $2, $3)
      RETURNING time_slot_id
    `,
    [startTime, endTime, label]
  );

  if (!slot) {
    throw new Error("Failed to create time slot or duplicate slot exists");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "TIME_SLOT_CREATED",
    moduleCode: "MASTER_DATA",
    targetTable: "time_slots",
    targetId: slot.time_slot_id,
    newValueJson: { startTime, endTime, label },
  });

  revalidatePath("/dashboard/master-data/time-slots");
}

export async function toggleTermTimeSlotAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const dayOfWeekId = formData.get("dayOfWeekId")?.toString();
  const timeSlotId = formData.get("timeSlotId")?.toString();
  const isEnabled = formData.get("isEnabled") === "true";

  if (!academicTermId || !dayOfWeekId || !timeSlotId) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      INSERT INTO term_time_slots (academic_term_id, day_of_week_id, time_slot_id, is_enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (academic_term_id, day_of_week_id, time_slot_id)
      DO UPDATE SET is_enabled = EXCLUDED.is_enabled
    `,
    [academicTermId, dayOfWeekId, timeSlotId, isEnabled]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "TERM_TIME_SLOT_TOGGLED",
    moduleCode: "TERMS",
    targetTable: "term_time_slots",
    targetId: timeSlotId,
    newValueJson: { academicTermId, dayOfWeekId, isEnabled },
  });

  revalidatePath("/dashboard/master-data/time-slots");
}
