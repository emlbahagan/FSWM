"use server";

import { revalidatePath } from "next/cache";
import { query, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createRoomBlockAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const academicTermId = formData.get("academicTermId")?.toString();
  const roomId = formData.get("roomId")?.toString();
  const dayOfWeekId = formData.get("dayOfWeekId")?.toString();
  const timeSlotId = formData.get("timeSlotId")?.toString();
  const reason = formData.get("reason")?.toString().trim();

  if (!academicTermId || !roomId || !dayOfWeekId || !timeSlotId || !reason) {
    throw new Error("Missing required fields");
  }

  await withTransaction(async (client) => {
    // Ensure term_time_slot exists
    await transactionQuery(
      client,
      `
        INSERT INTO term_time_slots (academic_term_id, day_of_week_id, time_slot_id, is_enabled)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (academic_term_id, day_of_week_id, time_slot_id) DO NOTHING
      `,
      [academicTermId, dayOfWeekId, timeSlotId]
    );

    const blk = await transactionQuery<{ room_blocked_time_id: string }>(
      client,
      `
        INSERT INTO room_blocked_times (academic_term_id, room_id, day_of_week_id, time_slot_id, reason, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING room_blocked_time_id
      `,
      [academicTermId, roomId, dayOfWeekId, timeSlotId, reason, currentUser.userId]
    );

    if (blk.rowCount === 0 || !blk.rows[0]) {
      throw new Error("Failed to block room time or duplicate block exists");
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "ROOM_BLOCKED",
      moduleCode: "TERMS",
      targetTable: "room_blocked_times",
      targetId: blk.rows[0].room_blocked_time_id,
      newValueJson: { academicTermId, roomId, dayOfWeekId, timeSlotId, reason },
    });
  });

  revalidatePath("/dashboard/blocking");
}

export async function deleteRoomBlockAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const blockId = formData.get("blockId")?.toString();

  if (!blockId) {
    throw new Error("Missing block ID");
  }

  await query(
    `DELETE FROM room_blocked_times WHERE room_blocked_time_id = $1`,
    [blockId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "ROOM_UNBLOCKED",
    moduleCode: "TERMS",
    targetTable: "room_blocked_times",
    targetId: blockId,
    newValueJson: { unblocked: true },
  });

  revalidatePath("/dashboard/blocking");
}
