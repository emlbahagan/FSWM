import { CheckSquare, Clock, AlertTriangle, Check, X, ShieldAlert, Plus } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { hasDepartmentScope, requireAnyRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { validateScheduleVersion, ValidationReport } from "@/server/validation/scheduling";
import { decideScheduleAction, decideOverloadAction, createUnlockRequestAction } from "@/app/(dashboard)/dashboard/approval/actions";

export const dynamic = "force-dynamic";

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type SubmittedScheduleRow = {
  reviewRecordId: string;
  scheduleVersionId: string;
  versionNumber: number;
  submittedByName: string;
  submittedAt: string;
  submissionNotes: string;
  statusCode: string;
};

type OverloadRequestRow = {
  overloadRequestId: string;
  scheduleVersionId: string;
  versionNumber: number;
  departmentId: string;
  facultyName: string;
  deptCode: string;
  assignedUnits: number;
  assignedHours: number;
  maxUnits: number;
  maxHours: number;
  requestedByName: string;
  requestedAt: string;
  requestReason: string;
  decisionStatus: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
};

export default async function ApprovalsPage() {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.DepartmentHead, RoleCode.Registrar], { anyScope: true });
  const isDeptHead = currentUser.roles.some((r) => r.roleCode === RoleCode.DepartmentHead);
  const isRegistrar = currentUser.roles.some((r) => r.roleCode === RoleCode.Registrar);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  const submittedSchedules: (SubmittedScheduleRow & { validationReport: ValidationReport })[] = [];
  let overloadRequests: OverloadRequestRow[] = [];
  let approvedVersions: { scheduleVersionId: string; versionNumber: number; statusCode: string }[] = [];

  if (activeTerm) {
    // Submitted schedules awaiting review
    const rows = await queryRows<SubmittedScheduleRow>(
      `
        SELECT 
          srr.schedule_review_record_id as "reviewRecordId",
          sv.schedule_version_id as "scheduleVersionId",
          sv.version_number as "versionNumber",
          u.first_name || ' ' || u.last_name as "submittedByName",
          srr.submitted_at::text as "submittedAt",
          srr.decision_reason as "submissionNotes",
          ss.schedule_status_code as "statusCode"
        FROM schedule_review_records srr
        JOIN schedule_versions sv ON srr.schedule_version_id = sv.schedule_version_id
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        JOIN users u ON srr.submitted_by = u.user_id
        WHERE sv.academic_term_id = $1 AND srr.decision_status = 'PENDING'
        ORDER BY srr.submitted_at DESC
      `,
      [activeTerm.academicTermId]
    );

    const visibleRows =
      isDeptHead && !isRegistrar
        ? (
            await Promise.all(
              rows.map(async (row) => {
                const departments = await queryRows<{ departmentId: string }>(
                  `
                    SELECT DISTINCT d.department_id as "departmentId"
                    FROM schedule_assignments sa
                    JOIN subject_offerings so ON sa.subject_offering_id = so.subject_offering_id
                    JOIN sections sec ON so.section_id = sec.section_id
                    JOIN departments d ON sec.department_id = d.department_id
                    WHERE sa.schedule_version_id = $1
                  `,
                  [row.scheduleVersionId]
                );

                return departments.length > 0 &&
                  departments.every((department) =>
                    hasDepartmentScope(currentUser, department.departmentId, { roleCode: RoleCode.DepartmentHead })
                  )
                  ? row
                  : null;
              })
            )
          ).filter((row): row is SubmittedScheduleRow => row !== null)
        : rows;

    for (const r of visibleRows) {
      const rep = await validateScheduleVersion(r.scheduleVersionId);
      submittedSchedules.push({ ...r, validationReport: rep });
    }

    // Overload requests
    overloadRequests = await queryRows<OverloadRequestRow>(
      `
        SELECT 
          oor.overload_override_request_id as "overloadRequestId",
          oor.schedule_version_id as "scheduleVersionId",
          sv.version_number as "versionNumber",
          d.department_id as "departmentId",
          fac_u.first_name || ' ' || fac_u.last_name as "facultyName",
          d.department_code as "deptCode",
          vw.assigned_units::float as "assignedUnits",
          vw.assigned_hours::float as "assignedHours",
          ftp.max_units::float as "maxUnits",
          ftp.max_hours::float as "maxHours",
          req_u.first_name || ' ' || req_u.last_name as "requestedByName",
          oor.requested_at::text as "requestedAt",
          oor.request_reason as "requestReason",
          oor.decision_status as "decisionStatus",
          dec_u.first_name || ' ' || dec_u.last_name as "decidedByName",
          oor.decided_at::text as "decidedAt",
          oor.decision_reason as "decisionReason"
        FROM overload_override_requests oor
        JOIN schedule_versions sv ON oor.schedule_version_id = sv.schedule_version_id
        JOIN faculty_term_profiles ftp ON oor.faculty_term_profile_id = ftp.faculty_term_profile_id
        JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
        JOIN users fac_u ON fp.faculty_id = fac_u.user_id
        JOIN departments d ON fp.department_id = d.department_id
        JOIN users req_u ON oor.requested_by = req_u.user_id
        LEFT JOIN users dec_u ON oor.decided_by = dec_u.user_id
        LEFT JOIN v_faculty_workload_by_version vw ON vw.schedule_version_id = oor.schedule_version_id AND vw.faculty_term_profile_id = oor.faculty_term_profile_id
        WHERE oor.academic_term_id = $1
        ORDER BY CASE WHEN oor.decision_status = 'PENDING' THEN 0 ELSE 1 END, oor.requested_at DESC
      `,
      [activeTerm.academicTermId]
    );

    if (isDeptHead && !isRegistrar) {
      overloadRequests = overloadRequests.filter((req) =>
        hasDepartmentScope(currentUser, req.departmentId, { roleCode: RoleCode.DepartmentHead })
      );
    }

    // Approved or Released versions for unlock request modal
    approvedVersions = await queryRows<{ scheduleVersionId: string; versionNumber: number; statusCode: string }>(
      `
        SELECT sv.schedule_version_id as "scheduleVersionId", sv.version_number as "versionNumber", ss.schedule_status_code as "statusCode"
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        WHERE sv.academic_term_id = $1 AND ss.schedule_status_code IN ('APPROVED', 'RELEASED')
        ORDER BY sv.version_number DESC
      `,
      [activeTerm.academicTermId]
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departmental Approvals & Overload Requests</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review submitted class schedule versions and evaluate faculty instructional overload exceptions.
          </p>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Clock size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      {/* Section 1: Submitted Schedule Versions */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
          <CheckSquare size={20} className="text-[var(--teal)]" />
          <h2 className="text-lg font-bold">Pending Schedule Reviews ({submittedSchedules.length})</h2>
        </div>

        {submittedSchedules.map((sub) => (
          <div key={sub.reviewRecordId} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] bg-background/50 px-6 py-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    VERSION v{sub.versionNumber}
                  </span>
                  <h3 className="font-semibold text-base text-foreground">Submitted for Review</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${sub.validationReport.isValid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"}`}>
                    {sub.validationReport.isValid ? "Valid / Zero Conflicts" : "Validation Errors Present"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)] font-mono">
                  Submitted by <span className="font-medium text-foreground">{sub.submittedByName}</span> on {new Date(sub.submittedAt).toLocaleString()}
                </p>
              </div>

              {isDeptHead && (
                <div className="flex items-center gap-3">
                  <form action={decideScheduleAction}>
                    <input type="hidden" name="scheduleVersionId" value={sub.scheduleVersionId} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs cursor-pointer">
                      <Check size={16} /> Approve Schedule
                    </button>
                  </form>

                  <form action={decideScheduleAction} className="flex items-center gap-2">
                    <input type="hidden" name="scheduleVersionId" value={sub.scheduleVersionId} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <input
                      type="text"
                      name="decisionReason"
                      required
                      placeholder="Reason for rejection..."
                      className="w-48 rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--rose)] focus:outline-none"
                    />
                    <button type="submit" className="inline-flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer">
                      <X size={14} /> Reject
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Submission Notes</h4>
                <p className="mt-2 text-sm leading-relaxed text-foreground bg-background p-3.5 rounded-md border border-[var(--line)] font-mono">
                  &quot;{sub.submissionNotes}&quot;
                </p>
              </div>

              {/* Validation Breakdown */}
              {!sub.validationReport.isValid && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Validation Warning Breakdown
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sub.validationReport.facultyConflicts.map((fc, i) => (
                      <div key={i} className="rounded border border-rose-200 bg-rose-50/50 p-2.5 text-xs dark:bg-rose-950/20 dark:border-rose-800">
                        <strong className="text-rose-800 dark:text-rose-400">Faculty Conflict:</strong> {fc.firstName} {fc.lastName} double-booked.
                      </div>
                    ))}
                    {sub.validationReport.roomConflicts.map((rc, i) => (
                      <div key={i} className="rounded border border-rose-200 bg-rose-50/50 p-2.5 text-xs dark:bg-rose-950/20 dark:border-rose-800">
                        <strong className="text-rose-800 dark:text-rose-400">Room Conflict:</strong> Room {rc.roomCode} double-booked.
                      </div>
                    ))}
                    {sub.validationReport.workloadExceeded.map((we, i) => (
                      <div key={i} className="rounded border border-rose-200 bg-rose-50/50 p-2.5 text-xs dark:bg-rose-950/20 dark:border-rose-800">
                        <strong className="text-rose-800 dark:text-rose-400">Workload Exceeded:</strong> {we.firstName} {we.lastName} ({we.assignedUnits} &gt; {we.maxUnits}U).
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {submittedSchedules.length === 0 && (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)] font-mono">
            No schedule versions currently pending departmental review.
          </div>
        )}
      </div>

      {/* Section 2: Overload Override Requests */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
          <AlertTriangle size={20} className="text-[var(--teal)]" />
          <h2 className="text-lg font-bold">Faculty Overload Override Requests ({overloadRequests.length})</h2>
        </div>

        <div className="space-y-4">
          {overloadRequests.map((req) => (
            <div key={req.overloadRequestId} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    {req.deptCode} - v{req.versionNumber}
                  </span>
                  <h3 className="font-bold text-base text-foreground">{req.facultyName}</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${req.decisionStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" : req.decisionStatus === "REJECTED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800 font-mono"}`}>
                    Status: {req.decisionStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-[var(--muted)] pt-1">
                  <span>Assigned Load: <strong className="text-foreground">{req.assignedUnits} Units</strong> ({req.assignedHours}h)</span>
                  <span>-</span>
                  <span>Ceiling: <strong className="text-foreground">{req.maxUnits} Units</strong> ({req.maxHours}h)</span>
                  <span>-</span>
                  <span>Requested by {req.requestedByName} on {new Date(req.requestedAt).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-foreground bg-background p-2.5 rounded border border-[var(--line)] font-mono mt-2">
                  <strong>Reason:</strong> &quot;{req.requestReason}&quot;
                </p>

                {req.decidedAt && (
                  <p className="text-[11px] text-[var(--muted)] font-mono italic">
                    Reviewed by {req.decidedByName} on {new Date(req.decidedAt).toLocaleDateString()} {req.decisionReason ? `(Notes: "${req.decisionReason}")` : ""}
                  </p>
                )}
              </div>

              {isDeptHead && req.decisionStatus === "PENDING" && (
                <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-4 lg:pt-0">
                  <form action={decideOverloadAction}>
                    <input type="hidden" name="overloadRequestId" value={req.overloadRequestId} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <button type="submit" className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer">
                      <Check size={14} /> Approve Overload
                    </button>
                  </form>

                  <form action={decideOverloadAction} className="flex items-center gap-2">
                    <input type="hidden" name="overloadRequestId" value={req.overloadRequestId} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <input
                      type="text"
                      name="decisionReason"
                      required
                      placeholder="Rejection reason..."
                      className="w-36 rounded border border-[var(--line)] bg-background px-2 py-1 text-xs focus:border-[var(--rose)] focus:outline-none"
                    />
                    <button type="submit" className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer">
                      <X size={14} /> Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}

          {overloadRequests.length === 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)] font-mono">
              No faculty overload override requests currently submitted.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Revision Unlock Request Submission Form */}
      {isRegistrar && approvedVersions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Schedule Correction & Revision Unlock Request</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Submit an emergency unlock request to System Administrators to edit an approved or released schedule.</p>
            </div>
          </div>

          <form action={createUnlockRequestAction} className="mt-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--muted)] uppercase mb-1">Target Version</label>
              <select name="scheduleVersionId" required className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none">
                {approvedVersions.map((av) => (
                  <option key={av.scheduleVersionId} value={av.scheduleVersionId}>
                    Version v{av.versionNumber} ({av.statusCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[280px]">
              <label className="block text-xs font-bold text-[var(--muted)] uppercase mb-1">Justification / Emergency Reason <span className="text-rose-500">*</span></label>
              <input
                type="text"
                name="requestReason"
                required
                placeholder="Explain the urgent correction needed (e.g. unexpected instructor leave, room damage)..."
                className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none font-mono"
              />
            </div>

            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-6 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition shadow-xs cursor-pointer h-[34px]">
              <Plus size={16} /> Request Unlock
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
