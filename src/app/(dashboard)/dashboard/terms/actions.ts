"use server";

import { revalidatePath } from "next/cache";
import { query, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createTermAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const schoolYear = formData.get("schoolYear")?.toString().trim();
  const termName = formData.get("termName")?.toString().trim();
  const startDate = formData.get("startDate")?.toString();
  const endDate = formData.get("endDate")?.toString();
  const termStatusId = formData.get("termStatusId")?.toString();

  if (!schoolYear || !termName || !startDate || !endDate || !termStatusId) {
    throw new Error("Missing required fields");
  }

  if (startDate >= endDate) {
    throw new Error("End date must be after start date");
  }

  await withTransaction(async (client) => {
    const shouldMakeActive = formData.get("isActive") === "true";

    if (shouldMakeActive) {
      await transactionQuery(
        client,
        `UPDATE academic_terms SET is_active = false WHERE is_active = true`
      );
    }

    const term = await transactionQuery<{ academic_term_id: string }>(
      client,
      `
        INSERT INTO academic_terms (school_year, term_name, start_date, end_date, term_status_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING academic_term_id
      `,
      [schoolYear, termName, startDate, endDate, termStatusId, shouldMakeActive]
    );

    if (term.rowCount === 0 || !term.rows[0]) {
      throw new Error("Failed to create academic term or duplicate term exists");
    }

    const termId = term.rows[0].academic_term_id;

    // Automatically seed enabled term_time_slots for standard Mon-Fri matrix
    await transactionQuery(
      client,
      `
        INSERT INTO term_time_slots (academic_term_id, day_of_week_id, time_slot_id, is_enabled)
        SELECT $1, d.day_of_week_id, ts.time_slot_id, true
        FROM days_of_week d
        CROSS JOIN time_slots ts
        WHERE d.day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
        ON CONFLICT (academic_term_id, day_of_week_id, time_slot_id) DO NOTHING
      `,
      [termId]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "TERM_CREATED",
      moduleCode: "TERMS",
      targetTable: "academic_terms",
      targetId: termId,
      newValueJson: { schoolYear, termName, startDate, endDate, isActive: shouldMakeActive },
    });
  });

  revalidatePath("/dashboard/terms");
  revalidatePath("/dashboard");
}

export async function updateTermAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const termId = formData.get("termId")?.toString();
  const schoolYear = formData.get("schoolYear")?.toString().trim();
  const termName = formData.get("termName")?.toString().trim();
  const startDate = formData.get("startDate")?.toString();
  const endDate = formData.get("endDate")?.toString();
  const termStatusId = formData.get("termStatusId")?.toString();
  const isActive = formData.get("isActive") === "true";

  if (!termId || !schoolYear || !termName || !startDate || !endDate || !termStatusId) {
    throw new Error("Missing required fields");
  }

  if (startDate >= endDate) {
    throw new Error("End date must be after start date");
  }

  await withTransaction(async (client) => {
    if (isActive) {
      await transactionQuery(
        client,
        `UPDATE academic_terms SET is_active = false WHERE is_active = true AND academic_term_id <> $1`,
        [termId]
      );
    }

    await transactionQuery(
      client,
      `
        UPDATE academic_terms
        SET school_year = $1, term_name = $2, start_date = $3, end_date = $4, term_status_id = $5, is_active = $6
        WHERE academic_term_id = $7
      `,
      [schoolYear, termName, startDate, endDate, termStatusId, isActive, termId]
    );

    // Automatically seed enabled term_time_slots if missing
    await transactionQuery(
      client,
      `
        INSERT INTO term_time_slots (academic_term_id, day_of_week_id, time_slot_id, is_enabled)
        SELECT $1, d.day_of_week_id, ts.time_slot_id, true
        FROM days_of_week d
        CROSS JOIN time_slots ts
        WHERE d.day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
        ON CONFLICT (academic_term_id, day_of_week_id, time_slot_id) DO NOTHING
      `,
      [termId]
    );

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "TERM_UPDATED",
      moduleCode: "TERMS",
      targetTable: "academic_terms",
      targetId: termId,
      newValueJson: { schoolYear, termName, startDate, endDate, termStatusId, isActive },
    });
  });

  revalidatePath("/dashboard/terms");
  revalidatePath("/dashboard");
}

export async function updateTermStatusAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const termId = formData.get("termId")?.toString();
  const termStatusId = formData.get("termStatusId")?.toString();

  if (!termId || !termStatusId) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE academic_terms
      SET term_status_id = $1
      WHERE academic_term_id = $2
    `,
    [termStatusId, termId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "TERM_STATUS_UPDATED",
    moduleCode: "TERMS",
    targetTable: "academic_terms",
    targetId: termId,
    newValueJson: { termStatusId },
  });

  revalidatePath("/dashboard/terms");
}

export async function setActiveTermAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const termId = formData.get("termId")?.toString();

  if (!termId) {
    throw new Error("Missing term ID");
  }

  await withTransaction(async (client) => {
    await transactionQuery(
      client,
      `UPDATE academic_terms SET is_active = false WHERE is_active = true`
    );

    await transactionQuery(
      client,
      `UPDATE academic_terms SET is_active = true WHERE academic_term_id = $1`,
      [termId]
    );
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "ACTIVE_TERM_SET",
    moduleCode: "TERMS",
    targetTable: "academic_terms",
    targetId: termId,
    newValueJson: { isActive: true },
  });

  revalidatePath("/dashboard/terms");
  revalidatePath("/dashboard");
}
