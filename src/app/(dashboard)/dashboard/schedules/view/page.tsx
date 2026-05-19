import { Calendar, CheckCircle2, Send, UserCheck, Users } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { hasDepartmentScope, requireAnyRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { releaseScheduleAction, acknowledgeScheduleAction, recordScheduleViewAction } from "@/app/(dashboard)/dashboard/schedules/view/actions";

export const dynamic = "force-dynamic";

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type ScheduleVersion = {
  scheduleVersionId: string;
  versionNumber: number;
  statusCode: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
};

type AcknowledgementRow = {
  ackId: string;
  departmentId: string;
  facultyId: string;
  fullName: string;
  deptCode: string;
  viewedAt: string | null;
  acknowledgedAt: string | null;
  note: string | null;
};

type ScheduledClassRow = {
  meetingId: string;
  departmentId: string;
  subjectCode: string;
  subjectTitle: string;
  sectionCode: string;
  deptCode: string;
  facultyId: string | null;
  facultyName: string | null;
  roomCode: string;
  roomName: string;
  meetingType: string;
  dayName: string;
  sortOrder: number;
  startTime: string;
  endTime: string;
};

type DayOfWeek = {
  dayOfWeekId: string;
  dayName: string;
};

type TimeSlot = {
  timeSlotId: string;
  label: string;
  startTime: string;
  endTime: string;
};

export default async function ScheduleViewPage({
  searchParams,
}: {
  searchParams?: Promise<{ v?: string; faculty?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Faculty, RoleCode.DepartmentHead, RoleCode.Registrar], { anyScope: true });
  const isRegistrar = currentUser.roles.some((r) => r.roleCode === RoleCode.Registrar);
  const isDeptHead = currentUser.roles.some((r) => r.roleCode === RoleCode.DepartmentHead);
  const isFaculty = currentUser.roles.some((r) => r.roleCode === RoleCode.Faculty);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  let versions: ScheduleVersion[] = [];
  let currentVersion: ScheduleVersion | null = null;
  let acknowledgements: AcknowledgementRow[] = [];
  let myAck: AcknowledgementRow | null = null;
  let classes: ScheduledClassRow[] = [];
  let facultyMembers: { id: string; name: string; deptCode: string }[] = [];

  const targetVersionId = params?.v || null;

  if (activeTerm) {
    versions = await queryRows<ScheduleVersion>(
      `
        SELECT 
          sv.schedule_version_id as "scheduleVersionId",
          sv.version_number as "versionNumber",
          ss.schedule_status_code as "statusCode",
          sv.created_at::text as "createdAt",
          app_u.first_name || ' ' || app_u.last_name as "approvedBy",
          sv.approved_at::text as "approvedAt",
          rel_u.first_name || ' ' || rel_u.last_name as "releasedBy",
          sv.released_at::text as "releasedAt"
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        LEFT JOIN users app_u ON sv.approved_by = app_u.user_id
        LEFT JOIN users rel_u ON sv.released_by = rel_u.user_id
        WHERE sv.academic_term_id = $1 AND ss.schedule_status_code IN ('APPROVED', 'RELEASED', 'ARCHIVED')
        ORDER BY sv.version_number DESC
      `,
      [activeTerm.academicTermId]
    );

    currentVersion = targetVersionId
      ? versions.find((v) => v.scheduleVersionId === targetVersionId) || null
      : versions.find((v) => v.statusCode === "RELEASED") || versions[0] || null;

    if (currentVersion) {
      // Acknowledgements for released schedule
      if (currentVersion.statusCode === "RELEASED") {
        acknowledgements = await queryRows<AcknowledgementRow>(
          `
            SELECT 
              fsa.faculty_schedule_acknowledgement_id as "ackId",
              d.department_id as "departmentId",
              fsa.faculty_id as "facultyId",
              u.first_name || ' ' || u.last_name as "fullName",
              d.department_code as "deptCode",
              fsa.viewed_at::text as "viewedAt",
              fsa.acknowledged_at::text as "acknowledgedAt",
              fsa.acknowledgement_note as "note"
            FROM faculty_schedule_acknowledgements fsa
            JOIN faculty_profiles fp ON fsa.faculty_id = fp.faculty_id
            JOIN users u ON fp.faculty_id = u.user_id
            JOIN departments d ON fp.department_id = d.department_id
            WHERE fsa.schedule_version_id = $1
            ORDER BY d.department_code, u.last_name
          `,
          [currentVersion.scheduleVersionId]
        );

        if (isFaculty && !isRegistrar && !isDeptHead) {
          acknowledgements = acknowledgements.filter((a) => a.facultyId === currentUser.facultyId);
        } else if (isDeptHead && !isRegistrar) {
          acknowledgements = acknowledgements.filter((a) =>
            hasDepartmentScope(currentUser, a.departmentId, { roleCode: RoleCode.DepartmentHead })
          );
        }

        myAck = acknowledgements.find((a) => a.facultyId === currentUser.facultyId) || null;

        if (myAck && !myAck.viewedAt) {
          await recordScheduleViewAction(myAck.ackId);
          myAck.viewedAt = new Date().toISOString();
        }
      }

      // Scheduled Classes for version
      classes = await queryRows<ScheduledClassRow>(
        `
          SELECT 
            sm.schedule_meeting_id as "meetingId",
            d.department_id as "departmentId",
            subj.subject_code as "subjectCode",
            subj.subject_title as "subjectTitle",
            sec.section_code as "sectionCode",
            d.department_code as "deptCode",
            fp.faculty_id as "facultyId",
            fac_u.first_name || ' ' || fac_u.last_name as "facultyName",
            r.room_code as "roomCode",
            r.room_name as "roomName",
            sm.meeting_type as "meetingType",
            dw.day_name as "dayName",
            dw.sort_order as "sortOrder",
            ts.start_time as "startTime",
            ts.end_time as "endTime"
          FROM schedule_meetings sm
          JOIN schedule_assignments sa ON sm.schedule_assignment_id = sa.schedule_assignment_id
          JOIN subject_offerings so ON sa.subject_offering_id = so.subject_offering_id
          JOIN subjects subj ON so.subject_id = subj.subject_id
          JOIN sections sec ON so.section_id = sec.section_id
          JOIN departments d ON sec.department_id = d.department_id
          JOIN rooms r ON sm.room_id = r.room_id
          JOIN term_time_slots tts ON sm.term_time_slot_id = tts.term_time_slot_id
          JOIN days_of_week dw ON tts.day_of_week_id = dw.day_of_week_id
          JOIN time_slots ts ON tts.time_slot_id = ts.time_slot_id
          LEFT JOIN faculty_term_profiles ftp ON sa.faculty_term_profile_id = ftp.faculty_term_profile_id
          LEFT JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
          LEFT JOIN users fac_u ON fp.faculty_id = fac_u.user_id
          WHERE sa.schedule_version_id = $1
          ORDER BY dw.sort_order, ts.start_time
        `,
        [currentVersion.scheduleVersionId]
      );

      if (isFaculty && !isRegistrar && !isDeptHead) {
        classes = classes.filter((c) => c.facultyId === currentUser.facultyId);
      } else if (isDeptHead && !isRegistrar) {
        classes = classes.filter((c) =>
          hasDepartmentScope(currentUser, c.departmentId, { roleCode: RoleCode.DepartmentHead })
        );
      }

      // Extract unique faculty list
      const facMap = new Map<string, { id: string; name: string; deptCode: string }>();
      for (const c of classes) {
        if (c.facultyId && c.facultyName) {
          facMap.set(c.facultyId, { id: c.facultyId, name: c.facultyName, deptCode: c.deptCode });
        }
      }
      facultyMembers = Array.from(facMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const days = await queryRows<DayOfWeek>(`SELECT day_of_week_id as "dayOfWeekId", day_name as "dayName" FROM days_of_week ORDER BY sort_order`);
  const timeSlots = await queryRows<TimeSlot>(`SELECT time_slot_id as "timeSlotId", label, start_time as "startTime", end_time as "endTime" FROM time_slots ORDER BY start_time`);

  const activeFacultyFilterId =
    isFaculty && !isRegistrar && !isDeptHead
      ? currentUser.facultyId
      : params?.faculty || facultyMembers[0]?.id || null;
  const myClasses = activeFacultyFilterId ? classes.filter((c) => c.facultyId === activeFacultyFilterId) : classes;

  const totalAck = acknowledgements.filter((a) => a.acknowledgedAt).length;
  const ackPercentage = acknowledgements.length ? Math.round((totalAck / acknowledgements.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Final Master Schedule & Faculty Timetables</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review approved instructional schedules, release final term timetables, and track instructor acknowledgements.
          </p>
        </div>

        {activeTerm && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
              <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
            </div>

            {versions.length > 0 && (
              <form method="get" className="flex items-center gap-2">
                {params?.faculty && !(isFaculty && !isRegistrar && !isDeptHead) && <input type="hidden" name="faculty" value={params.faculty} />}
                <select
                  name="v"
                  defaultValue={currentVersion?.scheduleVersionId || ""}
                  className="rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                >
                  {versions.map((v) => (
                    <option key={v.scheduleVersionId} value={v.scheduleVersionId}>
                      Version v{v.versionNumber} ({v.statusCode})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                >
                  Load
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Release Banner (For Registrar when viewing APPROVED schedule) */}
      {currentVersion && currentVersion.statusCode === "APPROVED" && isRegistrar && (
        <div className="rounded-xl border border-[var(--teal)] bg-[var(--teal)]/10 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--teal)]/20 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/30">
                  READY FOR RELEASE
                </span>
                <h2 className="text-lg font-bold text-foreground">Release Schedule Version v{currentVersion.versionNumber}</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Approved by {currentVersion.approvedBy} on {currentVersion.approvedAt ? new Date(currentVersion.approvedAt).toLocaleString() : ""}. Releasing will notify instructors and trigger formal schedule acknowledgement tracking.
              </p>
            </div>

            <form action={releaseScheduleAction} className="flex flex-wrap items-center gap-3 shrink-0">
              <input type="hidden" name="scheduleVersionId" value={currentVersion.scheduleVersionId} />
              <input
                type="text"
                name="releaseNotes"
                required
                placeholder="Release announcement notes..."
                className="w-64 rounded-md border border-[var(--line)] bg-background px-3 py-2 text-xs focus:border-[var(--teal)] focus:outline-none font-mono"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-6 py-2 font-semibold text-white shadow-md transition hover:bg-[var(--teal)]/90 hover:scale-105 cursor-pointer text-xs"
              >
                <Send size={16} /> Release Master Schedule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledgement Status / Banner (For Faculty when viewing RELEASED schedule) */}
      {currentVersion && currentVersion.statusCode === "RELEASED" && myAck && (
        <div className={`rounded-xl border p-6 shadow-sm ${myAck.acknowledgedAt ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30 animate-pulse"}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-3 text-white shadow-sm ${myAck.acknowledgedAt ? "bg-emerald-600" : "bg-amber-600"}`}>
                <UserCheck size={28} />
              </div>
              <div>
                <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${myAck.acknowledgedAt ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"}`}>
                  {myAck.acknowledgedAt ? "SCHEDULE ACKNOWLEDGED" : "ACKNOWLEDGEMENT REQUIRED"}
                </span>
                <h2 className="mt-1 text-lg font-bold text-foreground">
                  {myAck.acknowledgedAt ? "You have formally acknowledged your timetable." : "Please review and acknowledge your assigned instructional workload."}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                  {myAck.viewedAt ? `Initial review logged on ${new Date(myAck.viewedAt).toLocaleString()}` : "Viewing timetable for the first time."}
                </p>
              </div>
            </div>

            {!myAck.acknowledgedAt && (
              <form action={acknowledgeScheduleAction} className="flex flex-wrap items-center gap-3 shrink-0">
                <input type="hidden" name="acknowledgementId" value={myAck.ackId} />
                <input
                  type="text"
                  name="acknowledgementNote"
                  placeholder="Optional note / comment..."
                  className="w-56 rounded-md border border-[var(--line)] bg-background px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-2 font-semibold text-white shadow-md transition hover:bg-emerald-700 hover:scale-105 cursor-pointer text-xs"
                >
                  <CheckCircle2 size={16} /> Acknowledge Schedule
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Admin Acknowledgement Tracking Summary Progress Bar */}
      {currentVersion && currentVersion.statusCode === "RELEASED" && !isFaculty && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users size={20} className="text-[var(--teal)]" /> Faculty Acknowledgement Progress
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">Formal compliance and schedule acceptance tracking across academic departments.</p>
            </div>

            <div className="font-mono text-sm font-bold text-foreground bg-background px-3.5 py-1.5 rounded-full border border-[var(--line)] shadow-2xs">
              {totalAck} / {acknowledgements.length} Instructors ({ackPercentage}%)
            </div>
          </div>

          <div className="w-full bg-[var(--line)] rounded-full h-3 overflow-hidden border border-[var(--line)]">
            <div className="bg-[var(--teal)] h-full transition-all duration-500 rounded-full" style={{ width: `${ackPercentage}%` }} />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 max-h-48 overflow-y-auto">
            {acknowledgements.map((ack) => (
              <div key={ack.ackId} className="flex items-center justify-between p-2 rounded border border-[var(--line)] bg-background text-xs">
                <div>
                  <span className="font-bold text-foreground block">{ack.fullName}</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">{ack.deptCode}</span>
                </div>
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${ack.acknowledgedAt ? "bg-emerald-100 text-emerald-800" : ack.viewedAt ? "bg-amber-100 text-amber-800" : "bg-[var(--line)] text-[var(--muted)]"}`}>
                  {ack.acknowledgedAt ? "Acknowledged" : ack.viewedAt ? "Viewed" : "Unread"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timetable / Schedule Display Matrix */}
      {currentVersion ? (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Instructor Timetable:</span>
              {isFaculty && !isRegistrar && !isDeptHead ? (
                <span className="rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold">
                  My scheduled classes
                </span>
              ) : (
                <form method="get" className="flex items-center gap-2">
                  {targetVersionId && <input type="hidden" name="v" value={targetVersionId} />}
                  <select
                    name="faculty"
                    defaultValue={activeFacultyFilterId || ""}
                    className="rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                  >
                    <option value="">All Scheduled Classes / Master View</option>
                    {facultyMembers.map((fm) => (
                      <option key={fm.id} value={fm.id}>
                        {fm.name} ({fm.deptCode})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                  >
                    Filter
                  </button>
                </form>
              )}
            </div>

            <div className="text-xs text-[var(--muted)] font-mono">
              Displaying {myClasses.length} Scheduled Meetings
            </div>
          </div>

          {/* Timetable Grid Matrix */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm overflow-hidden font-mono">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
                <thead className="bg-background font-semibold text-[var(--muted)] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left w-36 border-r border-[var(--line)]">Time Interval</th>
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
                        const slotMeetings = myClasses.filter((mc) => mc.dayName === d.dayName && mc.startTime === ts.startTime);

                        return (
                          <td key={d.dayOfWeekId} className="p-2 border-r border-[var(--line)] last:border-r-0 align-top">
                            {slotMeetings.length > 0 ? (
                              <div className="space-y-2">
                                {slotMeetings.map((mtg) => (
                                  <div key={mtg.meetingId} className="rounded p-2 bg-[var(--teal)]/10 border border-[var(--teal)]/30 text-left space-y-1 shadow-2xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-foreground text-xs">{mtg.subjectCode}</span>
                                      <span className="text-[10px] font-bold text-[var(--teal)] bg-[var(--teal)]/10 px-1 rounded">
                                        {mtg.meetingType}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-foreground font-sans line-clamp-1">{mtg.subjectTitle}</p>
                                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-0.5 border-t border-[var(--teal)]/10">
                                      <span>Sec: {mtg.sectionCode}</span>
                                      <span className="font-bold text-foreground">{mtg.roomCode}</span>
                                    </div>
                                    {!activeFacultyFilterId && mtg.facultyName && (
                                      <div className="text-[10px] text-[var(--teal)] font-bold pt-0.5">
                                        Prof: {mtg.facultyName}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="h-12 flex items-center justify-center text-[10px] text-[var(--muted)]/40 italic">
                                -- Open Slot --
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
          No approved or released master schedule versions available for viewing yet.
        </div>
      )}
    </div>
  );
}
