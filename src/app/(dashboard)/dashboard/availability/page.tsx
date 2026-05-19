import Link from "next/link";
import { ShieldAlert, CheckCircle2, Clock, Calendar, Plus, User } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireAnyRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { createWindowAction, updateWindowStatusAction, saveAvailabilityAction, acceptPrivacyNoticeAction } from "@/app/(dashboard)/dashboard/availability/actions";

export const dynamic = "force-dynamic";

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type PrivacyCheck = {
  noticeId: string;
  versionTag: string;
  title: string;
  content: string;
  acceptedAt: string | null;
};

type WindowRow = {
  windowId: string;
  opensAt: string;
  closesAt: string;
  statusCode: string;
  deptCode: string | null;
};

type FacultyOption = {
  profileId: string;
  facultyId: string;
  fullName: string;
  deptCode: string;
};

type DayOfWeek = {
  dayOfWeekId: string;
  dayName: string;
  dayCode: string;
};

type TimeSlot = {
  timeSlotId: string;
  label: string;
  startTime: string;
  endTime: string;
};

type TermSlotMap = {
  termTimeSlotId: string;
  dayId: string;
  timeId: string;
};

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<{ faculty?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Faculty, RoleCode.Registrar], { anyScope: true });
  const hasAdminAccess = currentUser.roles.some((r) => r.roleCode === RoleCode.Registrar);

  const now = new Date();
  const defaultOpens = now.toISOString().slice(0, 16);
  const defaultCloses = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 16);

  // 1. Check Forced Privacy Acceptance
  const privacy = await queryOne<PrivacyCheck>(
    `
      SELECT 
        pn.privacy_notice_id as "noticeId",
        pn.notice_version as "versionTag",
        pn.title,
        pn.content,
        upa.accepted_at::text as "acceptedAt"
      FROM privacy_notices pn
      LEFT JOIN privacy_notice_acceptances upa ON pn.privacy_notice_id = upa.privacy_notice_id AND upa.user_id = $1
      WHERE pn.is_published = true
      ORDER BY pn.published_at DESC LIMIT 1
    `,
    [currentUser.userId]
  );

  const needsPrivacyAcceptance = privacy && !privacy.acceptedAt;

  // 2. Fetch Active Term
  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  let windows: WindowRow[] = [];
  let facultyList: FacultyOption[] = [];
  let selectedFacultyProfile: { profileId: string; fullName: string; deptCode: string; maxUnits: number; maxHours: number } | null = null;
  let termSlots: TermSlotMap[] = [];
  const userAvailabilityMap = new Map<string, string>();

  if (activeTerm) {
    // Windows
    windows = await queryRows<WindowRow>(
      `
        SELECT 
          w.availability_submission_window_id as "windowId",
          w.opens_at::text as "opensAt",
          w.closes_at::text as "closesAt",
          s.availability_window_status_code as "statusCode",
          d.department_code as "deptCode"
        FROM availability_submission_windows w
        JOIN availability_window_statuses s ON w.window_status_id = s.availability_window_status_id
        LEFT JOIN departments d ON w.scope_department_id = d.department_id
        WHERE w.academic_term_id = $1
        ORDER BY w.opens_at DESC
      `,
      [activeTerm.academicTermId]
    );

    // Faculty options for this term. Faculty users are locked to their own profile.
    facultyList = await queryRows<FacultyOption>(
      `
        SELECT 
          ftp.faculty_term_profile_id as "profileId",
          fp.faculty_id as "facultyId",
          u.first_name || ' ' || u.last_name as "fullName",
          d.department_code as "deptCode"
        FROM faculty_term_profiles ftp
        JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
        JOIN users u ON fp.faculty_id = u.user_id
        JOIN departments d ON fp.department_id = d.department_id
        WHERE ftp.academic_term_id = $1
          AND ($2::boolean OR fp.faculty_id = $3::uuid)
        ORDER BY u.last_name, u.first_name
      `,
      [activeTerm.academicTermId, hasAdminAccess, currentUser.facultyId]
    );

    // Determine target faculty profile
    const ownProfileId = facultyList.find((f) => f.facultyId === currentUser.facultyId)?.profileId;
    const targetProfileId = hasAdminAccess ? params?.faculty || ownProfileId || facultyList[0]?.profileId : ownProfileId;

    const fullProfile = targetProfileId
      ? await queryOne<{ profileId: string; fullName: string; deptCode: string; maxUnits: number; maxHours: number }>(
          `
            SELECT 
              ftp.faculty_term_profile_id as "profileId",
              u.first_name || ' ' || u.last_name as "fullName",
              d.department_code as "deptCode",
              ftp.max_units::float as "maxUnits",
              ftp.max_hours::float as "maxHours"
            FROM faculty_term_profiles ftp
            JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
            JOIN users u ON fp.faculty_id = u.user_id
            JOIN departments d ON fp.department_id = d.department_id
            WHERE ftp.faculty_term_profile_id = $1
          `,
          [targetProfileId]
        )
      : null;

    if (fullProfile) selectedFacultyProfile = fullProfile;

    // Fetch matrix slot definitions
    termSlots = await queryRows<TermSlotMap>(
      `
        SELECT term_time_slot_id as "termTimeSlotId", day_of_week_id as "dayId", time_slot_id as "timeId"
        FROM term_time_slots WHERE academic_term_id = $1 AND is_enabled = true
      `,
      [activeTerm.academicTermId]
    );

    // If target profile selected, get existing submissions
    if (selectedFacultyProfile) {
      const avail = await queryRows<{ slotId: string; statusCode: string }>(
        `
          SELECT term_time_slot_id as "slotId", s.availability_status_code as "statusCode"
          FROM faculty_availability fa
          JOIN availability_statuses s ON fa.availability_status_id = s.availability_status_id
          WHERE fa.faculty_term_profile_id = $1
        `,
        [selectedFacultyProfile.profileId]
      );

      for (const a of avail) {
        userAvailabilityMap.set(a.slotId, a.statusCode);
      }
    }
  }

  const days = await queryRows<DayOfWeek>(`SELECT day_of_week_id as "dayOfWeekId", day_name as "dayName", day_code as "dayCode" FROM days_of_week ORDER BY sort_order`);
  const timeSlots = await queryRows<TimeSlot>(`SELECT time_slot_id as "timeSlotId", label, start_time as "startTime", end_time as "endTime" FROM time_slots ORDER BY start_time`);
  const departments = await queryRows<{ id: string; name: string }>(`SELECT department_id as "id", department_name as "name" FROM departments WHERE is_active = true`);

  const isWindowOpen = windows.some((w) => w.statusCode === "OPEN" && new Date(w.closesAt) > new Date());

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-8">
      {/* Forced Privacy Banner */}
      {needsPrivacyAcceptance && (
        <div className="rounded-xl border-2 border-[var(--rose)] bg-[var(--rose)]/10 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[var(--rose)] p-3 text-white shadow-sm">
                <ShieldAlert size={28} />
              </div>
              <div>
                <span className="rounded bg-[var(--rose)]/20 px-2 py-0.5 font-mono text-xs font-bold text-[var(--rose)] border border-[var(--rose)]/30">
                  ACTION REQUIRED - {privacy.versionTag}
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">{privacy.title}</h2>
                <p className="mt-1 text-sm text-foreground/80 max-w-3xl line-clamp-2">{privacy.content}</p>
              </div>
            </div>

            <form action={acceptPrivacyNoticeAction} className="shrink-0">
              <input type="hidden" name="privacyNoticeId" value={privacy.noticeId} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--rose)] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[var(--rose)]/90 hover:scale-105 transform cursor-pointer"
              >
                <CheckCircle2 size={20} /> I Read & Accept Terms
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Availability Submission</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Declare available and preferred instructional time windows for the active academic term.
          </p>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      {/* Admin Window Controls */}
      {hasAdminAccess && activeTerm && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[var(--line)] pb-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Clock size={20} className="text-[var(--teal)]" /> Availability Submission Windows
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1">Open time intervals during which instructors can encode and update their preferences.</p>
            </div>

            {/* Create Window Form */}
            <form action={createWindowAction} className="flex flex-wrap items-end gap-3 bg-background p-3.5 rounded-lg border border-[var(--line)]">
              <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />

              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">Scope</label>
                <select name="scopeDepartmentId" className="rounded border bg-[var(--panel)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--teal)]">
                  <option value="">Global / All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">Opens At</label>
                <input type="datetime-local" name="opensAt" defaultValue={defaultOpens} required className="rounded border bg-[var(--panel)] px-2 py-1 text-xs focus:outline-none font-mono" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">Closes At</label>
                <input type="datetime-local" name="closesAt" defaultValue={defaultCloses} required className="rounded border bg-[var(--panel)] px-2 py-1 text-xs focus:outline-none font-mono" />
              </div>

              <button type="submit" className="inline-flex items-center gap-1 rounded bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[var(--teal)]/90 transition">
                <Plus size={14} /> Open Window
              </button>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            {windows.map((win) => (
              <div key={win.windowId} className="flex items-center gap-4 rounded-md border border-[var(--line)] bg-background px-4 py-2 text-xs shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span className={`inline-flex rounded-full h-2 w-2 ${win.statusCode === "OPEN" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    <span>Status: {win.statusCode}</span>
                    <span className="text-[var(--muted)] font-mono">({win.deptCode || "Global"})</span>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--muted)] mt-0.5">
                    {win.opensAt.slice(0, 16)} to {win.closesAt.slice(0, 16)}
                  </p>
                </div>

                <form action={updateWindowStatusAction}>
                  <input type="hidden" name="windowId" value={win.windowId} />
                  <input type="hidden" name="statusCode" value={win.statusCode === "OPEN" ? "CLOSED" : "OPEN"} />
                  <button type="submit" className="rounded border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-semibold text-foreground hover:border-[var(--teal)] transition">
                    {win.statusCode === "OPEN" ? "Close" : "Reopen"}
                  </button>
                </form>
              </div>
            ))}

            {windows.length === 0 && <p className="text-xs text-[var(--muted)] italic">No submission windows configured yet.</p>}
          </div>
        </div>
      )}

      {/* Target Faculty Switcher (For Admins) */}
      {hasAdminAccess && facultyList.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[var(--teal)]/30 bg-[var(--panel)] p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[var(--teal)]/10 p-2 text-[var(--teal)]">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--teal)] uppercase tracking-wide">Admin Mode - Instructor Selection</p>
              <p className="text-sm font-semibold text-foreground">
                {selectedFacultyProfile ? `${selectedFacultyProfile.fullName} (${selectedFacultyProfile.deptCode})` : "Select an instructor to view/encode availability"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Switch Faculty:</span>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 border rounded bg-background">
              {facultyList.map((f) => (
                <Link
                  key={f.profileId}
                  href={`/dashboard/availability?faculty=${f.profileId}`}
                  className={`rounded px-2.5 py-1 text-xs font-semibold border transition ${
                    f.profileId === selectedFacultyProfile?.profileId
                      ? "bg-[var(--teal)] text-white border-[var(--teal)] shadow-2xs"
                      : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)] hover:border-[var(--teal)]"
                  }`}
                >
                  {f.fullName}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Matrix Form */}
      {selectedFacultyProfile ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm overflow-hidden">
          <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span>{selectedFacultyProfile.fullName}</span>
                <span className="font-mono text-xs rounded bg-[var(--teal)]/10 px-2 py-0.5 text-[var(--teal)] border border-[var(--teal)]/20 font-bold">
                  {selectedFacultyProfile.deptCode}
                </span>
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Workload Ceiling: <span className="font-semibold text-foreground font-mono">{selectedFacultyProfile.maxUnits} Units</span> / <span className="font-semibold text-foreground font-mono">{selectedFacultyProfile.maxHours} Hours</span>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-400 dark:bg-emerald-950/80 dark:border-emerald-600" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-teal-100 border border-teal-400 dark:bg-teal-950/80 dark:border-teal-600 flex items-center justify-center text-teal-700 dark:text-teal-400">*</span>
                <span>Preferred</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[var(--line)] border border-[var(--muted)]" />
                <span>Unavailable</span>
              </div>
            </div>
          </div>

          <form action={saveAvailabilityAction} className="p-6 space-y-6">
            <input type="hidden" name="facultyTermProfileId" value={selectedFacultyProfile.profileId} />

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
                <thead className="bg-background font-semibold text-[var(--muted)] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left w-32 border-r border-[var(--line)]">Time Interval</th>
                    {days.map((d) => (
                      <th key={d.dayOfWeekId} className="px-4 py-3 text-center border-r border-[var(--line)] last:border-r-0">
                        {d.dayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-xs font-mono">
                  {timeSlots.map((ts) => (
                    <tr key={ts.timeSlotId} className="hover:bg-background/40 transition">
                      <td className="px-4 py-3 font-semibold text-foreground bg-background/20 border-r border-[var(--line)] whitespace-nowrap">
                        {ts.label} ({ts.startTime.slice(0, 5)} - {ts.endTime.slice(0, 5)})
                      </td>

                      {days.map((d) => {
                        const termSlot = termSlots.find((s) => s.dayId === d.dayOfWeekId && s.timeId === ts.timeSlotId);
                        const currStatus = termSlot ? userAvailabilityMap.get(termSlot.termTimeSlotId) || "UNAVAILABLE" : "UNAVAILABLE";

                        return (
                          <td key={d.dayOfWeekId} className="p-2 border-r border-[var(--line)] last:border-r-0 text-center">
                            {termSlot ? (
                              <div>
                                <select
                                  name={`slot_${termSlot.termTimeSlotId}`}
                                  defaultValue={currStatus}
                                  disabled={needsPrivacyAcceptance || (!isWindowOpen && !hasAdminAccess)}
                                  className={`w-full rounded p-1.5 text-xs font-bold text-center cursor-pointer transition focus:outline-none shadow-2xs ${
                                    currStatus === "AVAILABLE"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700"
                                      : currStatus === "PREFERRED"
                                      ? "bg-teal-100 text-teal-800 border border-teal-400 dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-700 font-extrabold"
                                      : "bg-background text-[var(--muted)] border border-[var(--line)] hover:border-foreground/30"
                                  }`}
                                >
                                  <option value="UNAVAILABLE">Unavailable</option>
                                  <option value="AVAILABLE">Available</option>
                                  <option value="PREFERRED">Preferred</option>
                                </select>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] block p-1 italic bg-[var(--line)]/30 rounded">Slot Disabled</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--line)] pt-5">
              <p className="text-xs text-[var(--muted)] italic">
                {needsPrivacyAcceptance ? "Accept privacy notice above to unlock availability submission." : !isWindowOpen && !hasAdminAccess ? "Submission window is currently closed. Contact the Registrar's Office." : "Changes take effect immediately upon submission."}
              </p>

              <button
                type="submit"
                disabled={needsPrivacyAcceptance || (!isWindowOpen && !hasAdminAccess)}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-[var(--teal)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={18} /> Save Availability Preferences
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
          No faculty profile found for the active academic term. Please enroll your workload profile in the Faculty Profiles module first.
        </div>
      )}
    </div>
  );
}
