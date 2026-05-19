"use server";

import { redirect } from "next/navigation";
import { query } from "@/server/db";
import { requireCurrentUser, hashPassword, recordAuditLog } from "@/server/auth";

export async function changePasswordAction(formData: FormData) {
  // 1. Fetch current user, permitting them if force password reset is true
  const currentUser = await requireCurrentUser({ allowForceResetPage: true });

  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!password || !confirmPassword) {
    redirect("/change-password?error=missing");
  }

  // 2. Validate password strength
  if (password.length < 8) {
    redirect("/change-password?error=length");
  }

  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);

  if (!hasNumber || !hasUpper || !hasLower) {
    redirect("/change-password?error=strength");
  }

  if (password !== confirmPassword) {
    redirect("/change-password?error=match");
  }

  // 3. Hash the new password and update in database
  const passwordHash = await hashPassword(password);

  await query(
    `
      UPDATE users
      SET password_hash = $1, force_password_reset = false, updated_at = now()
      WHERE user_id = $2
    `,
    [passwordHash, currentUser.userId]
  );

  // 4. Log change audit event
  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "USER_PASSWORD_RESET_FORCE",
    moduleCode: "AUTH",
    targetTable: "users",
    targetId: currentUser.userId,
    newValueJson: { message: "Password updated successfully in force reset workflow" },
  });

  redirect("/dashboard");
}
