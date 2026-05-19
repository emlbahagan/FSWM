import { CheckCircle2, XCircle, Clock, Check, X } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { decideUnlockRequestAction } from "@/app/(dashboard)/dashboard/unlocks/actions";

export const dynamic = "force-dynamic";

type UnlockRequestRow = {
  unlockRequestId: string;
  scheduleVersionId: string;
  versionNumber: number;
  schoolYear: string;
  termName: string;
  requestedByEmail: string;
  requestedByName: string;
  requestedAt: Date;
  requestReason: string;
  decisionStatus: string;
  decidedByEmail: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  expiresAt: Date | null;
};

export default async function UnlocksPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.SystemAdmin);

  const requests = await queryRows<UnlockRequestRow>(`
    SELECT 
      sur.schedule_unlock_request_id as "unlockRequestId",
      sur.schedule_version_id as "scheduleVersionId",
      sv.version_number as "versionNumber",
      at.school_year as "schoolYear",
      at.term_name as "termName",
      req.email as "requestedByEmail",
      req.last_name || ', ' || req.first_name as "requestedByName",
      sur.requested_at as "requestedAt",
      sur.request_reason as "requestReason",
      sur.decision_status as "decisionStatus",
      dec.email as "decidedByEmail",
      dec.last_name || ', ' || dec.first_name as "decidedByName",
      sur.decided_at as "decidedAt",
      sur.decision_reason as "decisionReason",
      sur.expires_at as "expiresAt"
    FROM schedule_unlock_requests sur
    JOIN schedule_versions sv ON sur.schedule_version_id = sv.schedule_version_id
    JOIN academic_terms at ON sv.academic_term_id = at.academic_term_id
    JOIN users req ON sur.requested_by = req.user_id
    LEFT JOIN users dec ON sur.decided_by = dec.user_id
    ORDER BY CASE WHEN sur.decision_status = 'PENDING' THEN 0 ELSE 1 END, sur.requested_at DESC
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="border-b border-[var(--line)] pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Schedule Unlock Requests</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review and approve or reject schedule revision unlock requests submitted by Registrars or Coordinators.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {requests.map((req) => (
          <div
            key={req.unlockRequestId}
            className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] bg-background/50 px-6 py-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    {req.schoolYear} - {req.termName}
                  </span>
                  <h3 className="font-semibold text-base text-foreground">Schedule Version v{req.versionNumber}</h3>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Requested by <span className="font-medium text-foreground">{req.requestedByName || req.requestedByEmail}</span> on {new Date(req.requestedAt).toLocaleString()}
                </p>
              </div>

              <div>
                {req.decisionStatus === "PENDING" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    <Clock size={14} /> Pending Approval
                  </span>
                )}
                {req.decisionStatus === "APPROVED" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    <CheckCircle2 size={14} /> Approved (Active Window)
                  </span>
                )}
                {req.decisionStatus === "REJECTED" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                    <XCircle size={14} /> Rejected Request
                  </span>
                )}
                {req.decisionStatus === "USED" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)] border border-[var(--line)]">
                    Correction Closed / Used
                  </span>
                )}
                {req.decisionStatus === "EXPIRED" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)] border border-[var(--line)]">
                    Expired Window
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              <div>
                <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Request Reason</h4>
                <p className="mt-2 text-sm leading-relaxed text-foreground bg-background p-3.5 rounded-md border border-[var(--line)]/50 font-mono">
                  {req.requestReason}
                </p>
              </div>

              {req.decisionStatus === "PENDING" ? (
                <form action={decideUnlockRequestAction} className="mt-6 border-t border-[var(--line)] pt-6 space-y-4">
                  <input type="hidden" name="unlockRequestId" value={req.unlockRequestId} />
                  <input type="hidden" name="scheduleVersionId" value={req.scheduleVersionId} />

                  <div>
                    <label htmlFor={`reason-${req.unlockRequestId}`} className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                      Decision Notes / Rejection Reason <span className="text-rose-500 font-normal lowercase">(Required if rejecting)</span>
                    </label>
                    <input
                      type="text"
                      id={`reason-${req.unlockRequestId}`}
                      name="decisionReason"
                      placeholder="Explain why this request is approved or rejected..."
                      className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="submit"
                      name="decisionStatus"
                      value="REJECTED"
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-600 bg-rose-50 text-rose-700 px-4 py-2 text-sm font-semibold hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 transition"
                    >
                      <X size={16} /> Reject Request
                    </button>
                    <button
                      type="submit"
                      name="decisionStatus"
                      value="APPROVED"
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                    >
                      <Check size={16} /> Approve Unlock
                    </button>
                  </div>
                </form>
              ) : (
                req.decidedAt && (
                  <div className="mt-6 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p>
                      Decided by <span className="font-semibold text-foreground">{req.decidedByName || req.decidedByEmail}</span> on {new Date(req.decidedAt).toLocaleString()}
                    </p>
                    {req.decisionReason && (
                      <p className="italic bg-background px-2.5 py-1 rounded border border-[var(--line)]/50">
                        Notes: &quot;{req.decisionReason}&quot;
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        ))}

        {requests.length === 0 && (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
            No schedule unlock requests have been submitted yet.
          </div>
        )}
      </div>
    </div>
  );
}
