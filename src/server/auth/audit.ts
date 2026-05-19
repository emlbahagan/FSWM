import "server-only";

import { headers } from "next/headers";
import { query } from "@/server/db";

type LoginAuditInput = {
  email: string;
  reason?: string;
  success: boolean;
  userId?: string | null;
};

function getClientIp(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

export async function recordLoginAudit(input: LoginAuditInput) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent");
  const ipAddress = getClientIp(headerList);

  await query(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        action_code,
        module_code,
        target_table,
        target_id,
        new_value_json,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, 'AUTH', 'users', $3, $4::jsonb, $5::inet, $6)
    `,
    [
      input.userId ?? null,
      input.success ? "LOGIN_SUCCESS" : "LOGIN_FAILURE",
      input.userId ?? null,
      JSON.stringify({
        email: input.email,
        reason: input.reason ?? null,
        success: input.success,
      }),
      ipAddress,
      userAgent,
    ],
  );
}

type AuditLogInput = {
  actorUserId?: string | null;
  actionCode: string;
  moduleCode: string;
  targetTable?: string;
  targetId?: string | null;
  oldValueJson?: unknown;
  newValueJson?: unknown;
};

export async function recordAuditLog(input: AuditLogInput) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent");
  const ipAddress = getClientIp(headerList);

  await query(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        action_code,
        module_code,
        target_table,
        target_id,
        old_value_json,
        new_value_json,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::inet, $9)
    `,
    [
      input.actorUserId ?? null,
      input.actionCode,
      input.moduleCode,
      input.targetTable ?? null,
      input.targetId ?? null,
      input.oldValueJson ? JSON.stringify(input.oldValueJson) : null,
      input.newValueJson ? JSON.stringify(input.newValueJson) : null,
      ipAddress,
      userAgent,
    ],
  );
}


