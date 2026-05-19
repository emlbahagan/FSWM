"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/server/db";
import { createSession, recordLoginAudit, verifyPassword } from "@/server/auth";

const DUMMY_PASSWORD_HASH =
  "scrypt:64:Bjl0FA7lM-B0UgEK2in65w:tTJl1czsuutxRW8zgShoApLUkJUtQKmTMXWd7HswGm4n3RNdnvrlSI_PChbKT0vidsm2KKEYOiIAh2Weeu5XZA";

type LoginUserRow = {
  email: string;
  is_active: boolean;
  password_hash: string | null;
  user_id: string;
};

function normalizeEmail(value: FormDataEntryValue | null) {
  return value?.toString().trim().toLowerCase() ?? "";
}

function getPassword(value: FormDataEntryValue | null) {
  return value?.toString() ?? "";
}

function getSafeRedirectPath(value: FormDataEntryValue | null) {
  const path = value?.toString().trim();

  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/dashboard";
  }

  return path;
}

async function failLogin(email: string, reason: string, nextPath: string, userId?: string | null) {
  await recordLoginAudit({
    email,
    reason,
    success: false,
    userId,
  });

  redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
}

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = getPassword(formData.get("password"));
  const nextPath = getSafeRedirectPath(formData.get("next"));

  if (!email || !password) {
    await failLogin(email, "missing_credentials", nextPath);
  }

  const user = await queryOne<LoginUserRow>(
    `
      SELECT user_id, email, password_hash, is_active
      FROM users
      WHERE lower(email) = $1
      LIMIT 1
    `,
    [email],
  );

  if (!user) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    await failLogin(email, "invalid_credentials", nextPath);
  }

  if (!user.is_active) {
    await verifyPassword(password, user.password_hash);
    await failLogin(email, "inactive_user", nextPath, user.user_id);
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);

  if (!passwordMatches) {
    await failLogin(email, "invalid_credentials", nextPath, user.user_id);
  }

  await recordLoginAudit({
    email: user.email,
    success: true,
    userId: user.user_id,
  });
  await createSession(user.user_id);

  redirect(nextPath);
}
