"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function createPrivacyNoticeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const title = formData.get("title")?.toString().trim();
  const noticeVersion = formData.get("noticeVersion")?.toString().trim();
  const content = formData.get("content")?.toString().trim();

  if (!title || !noticeVersion || !content) {
    throw new Error("Missing required fields");
  }

  const newNotice = await queryOne<{ privacy_notice_id: string }>(
    `
      INSERT INTO privacy_notices (title, notice_version, content, is_published)
      VALUES ($1, $2, $3, false)
      RETURNING privacy_notice_id
    `,
    [title, noticeVersion, content]
  );

  if (!newNotice) {
    throw new Error("Failed to create privacy notice or duplicate version");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PRIVACY_NOTICE_CREATED",
    moduleCode: "PRIVACY",
    targetTable: "privacy_notices",
    targetId: newNotice.privacy_notice_id,
    newValueJson: { title, noticeVersion, isPublished: false },
  });

  revalidatePath("/dashboard/privacy");
  redirect("/dashboard/privacy");
}

export async function updatePrivacyNoticeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const noticeId = formData.get("noticeId")?.toString();
  const title = formData.get("title")?.toString().trim();
  const noticeVersion = formData.get("noticeVersion")?.toString().trim();
  const content = formData.get("content")?.toString().trim();

  if (!noticeId || !title || !noticeVersion || !content) {
    throw new Error("Missing required fields");
  }

  const current = await queryOne<{ is_published: boolean }>(
    `SELECT is_published FROM privacy_notices WHERE privacy_notice_id = $1`,
    [noticeId]
  );

  if (!current || current.is_published) {
    throw new Error("Published notices cannot be edited. Create a new version instead.");
  }

  await query(
    `
      UPDATE privacy_notices
      SET title = $1, notice_version = $2, content = $3
      WHERE privacy_notice_id = $4 AND is_published = false
    `,
    [title, noticeVersion, content, noticeId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PRIVACY_NOTICE_UPDATED",
    moduleCode: "PRIVACY",
    targetTable: "privacy_notices",
    targetId: noticeId,
    newValueJson: { title, noticeVersion },
  });

  revalidatePath(`/dashboard/privacy/${noticeId}`);
  revalidatePath("/dashboard/privacy");
  redirect("/dashboard/privacy");
}

export async function publishPrivacyNoticeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const noticeId = formData.get("noticeId")?.toString();

  if (!noticeId) {
    throw new Error("Missing notice ID");
  }

  await withTransaction(async (client) => {
    // 1. Unpublish any active notice
    await transactionQuery(
      client,
      `UPDATE privacy_notices SET is_published = false WHERE is_published = true`
    );

    // 2. Publish target notice
    const res = await transactionQuery(
      client,
      `
        UPDATE privacy_notices
        SET is_published = true, published_at = now(), published_by = $1
        WHERE privacy_notice_id = $2
        RETURNING privacy_notice_id
      `,
      [currentUser.userId, noticeId]
    );

    if (res.rowCount === 0) {
      throw new Error("Notice not found");
    }
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PRIVACY_NOTICE_PUBLISHED",
    moduleCode: "PRIVACY",
    targetTable: "privacy_notices",
    targetId: noticeId,
    newValueJson: { isPublished: true, publishedBy: currentUser.userId },
  });

  revalidatePath(`/dashboard/privacy/${noticeId}`);
  revalidatePath("/dashboard/privacy");
}

export async function deletePrivacyNoticeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const noticeId = formData.get("noticeId")?.toString();

  if (!noticeId) {
    throw new Error("Missing notice ID");
  }

  const current = await queryOne<{ is_published: boolean }>(
    `SELECT is_published FROM privacy_notices WHERE privacy_notice_id = $1`,
    [noticeId]
  );

  if (!current || current.is_published) {
    throw new Error("Published notices cannot be deleted.");
  }

  await query(`DELETE FROM privacy_notices WHERE privacy_notice_id = $1 AND is_published = false`, [noticeId]);

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "PRIVACY_NOTICE_DELETED",
    moduleCode: "PRIVACY",
    targetTable: "privacy_notices",
    targetId: noticeId,
    newValueJson: { status: "DELETED" },
  });

  revalidatePath("/dashboard/privacy");
  redirect("/dashboard/privacy");
}
