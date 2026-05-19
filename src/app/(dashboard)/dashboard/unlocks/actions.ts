"use server";

import { revalidatePath } from "next/cache";
import { withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";

export async function decideUnlockRequestAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const unlockRequestId = formData.get("unlockRequestId")?.toString();
  const scheduleVersionId = formData.get("scheduleVersionId")?.toString();
  const decisionStatus = formData.get("decisionStatus")?.toString(); // APPROVED or REJECTED
  const decisionReason = formData.get("decisionReason")?.toString().trim();

  if (!unlockRequestId || !scheduleVersionId || !decisionStatus) {
    throw new Error("Missing required fields");
  }

  if (decisionStatus === "REJECTED" && (!decisionReason || !decisionReason.trim())) {
    throw new Error("Rejection reason is required");
  }

  await withTransaction(async (client) => {
    if (decisionStatus === "APPROVED") {
      await transactionQuery(
        client,
        `
          UPDATE schedule_unlock_requests
          SET decision_status = 'APPROVED', decided_by = $1, decided_at = now(), expires_at = now() + interval '24 hours', correction_started_at = now()
          WHERE schedule_unlock_request_id = $2 AND decision_status = 'PENDING'
        `,
        [currentUser.userId, unlockRequestId]
      );

      await transactionQuery(
        client,
        `
          UPDATE schedule_versions
          SET active_unlock_request_id = $1,
              schedule_status_id = (SELECT schedule_status_id FROM schedule_statuses WHERE schedule_status_code = 'CORRECTION_OPEN')
          WHERE schedule_version_id = $2
        `,
        [unlockRequestId, scheduleVersionId]
      );
    } else {
      await transactionQuery(
        client,
        `
          UPDATE schedule_unlock_requests
          SET decision_status = 'REJECTED', decided_by = $1, decided_at = now(), decision_reason = $2
          WHERE schedule_unlock_request_id = $3 AND decision_status = 'PENDING'
        `,
        [currentUser.userId, decisionReason, unlockRequestId]
      );
    }
  });

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: `UNLOCK_REQUEST_${decisionStatus}`,
    moduleCode: "SCHEDULING",
    targetTable: "schedule_unlock_requests",
    targetId: unlockRequestId,
    newValueJson: { decisionStatus, decisionReason },
  });

  revalidatePath("/dashboard/unlocks");
}
