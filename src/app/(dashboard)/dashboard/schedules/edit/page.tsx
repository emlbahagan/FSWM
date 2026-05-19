import { Calendar, Plus, CheckCircle2, AlertTriangle, UserPlus, Clock, X, Check, AlertCircle } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { validateScheduleVersion, ValidationReport } from "@/server/validation/scheduling";
import { createVersionAction, assignFacultyAction, saveMeetingAction, deleteMeetingAction, submitVersionAction } from "@/app/(dashboard)/dashboard/schedules/edit/actions";
import AutoScheduleAssistant from "@/app/(dashboard)/dashboard/schedules/edit/AutoScheduleAssistant";

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
  createdBy: string;
};

type SubjectOfferingRow = {
  offeringId: string;
  subjectCode: string;
  subjectTitle: string;
  lecUnits: number;
  labUnits: number;
  sectionCode: string;
  expectedEnrollment: number;
  deptCode: string;
  assignmentId: string | null;
  facultyProfileId: string | null;
  facultyName: string | null;
  statusCode: string | null;
  requiredRoomTypeName: string | null;
  requiredFeatures: string[];
};

type FacultyOption = {
  profileId: string;
  facultyId: string;
  fullName: string;
  deptCode: string;
  maxUnits: number;
  maxHours: number;
};

type RoomOption = {
  roomId: string;
  roomCode: string;
  roomName: string;
  capacity: number;
  roomTypeName: string;
  buildingName: string;
};

type TimeSlotOption = {
  termTimeSlotId: string;
  dayName: string;
  label: string;
  startTime: string;
  endTime: string;
};

type MeetingRow = {
  meetingId: string;
  assignmentId: string;
  termTimeSlotId: string;
  roomId: string;
  meetingType: string;
  roomCode: string;
  roomName: string;
  dayName: string;
  startTime: string;
  endTime: string;
};

export default async function ScheduleEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ dept?: string; q?: string; offering?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  let versions: ScheduleVersion[] = [];
  let currentVersion: ScheduleVersion | null = null;
  let validationReport: ValidationReport | null = null;
  let offerings: SubjectOfferingRow[] = [];
  let facultyList: FacultyOption[] = [];
  let roomList: RoomOption[] = [];
  let timeSlots: TimeSlotOption[] = [];
  let meetings: MeetingRow[] = [];

  const selectedDept = params?.dept || "";
  const queryText = params?.q?.trim().toLowerCase() || "";

  if (activeTerm) {
    versions = await queryRows<ScheduleVersion>(
      `
        SELECT 
          sv.schedule_version_id as "scheduleVersionId",
          sv.version_number as "versionNumber",
          ss.schedule_status_code as "statusCode",
          sv.created_at::text as "createdAt",
          u.first_name || ' ' || u.last_name as "createdBy"
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        JOIN users u ON sv.created_by = u.user_id
        WHERE sv.academic_term_id = $1
        ORDER BY sv.version_number DESC
      `,
      [activeTerm.academicTermId]
    );

    currentVersion = versions.find((v) => ["DRAFT", "SUBMITTED", "CORRECTION_OPEN"].includes(v.statusCode)) || versions[0] || null;

    if (currentVersion) {
      validationReport = await validateScheduleVersion(currentVersion.scheduleVersionId);

      // Offerings with assignment details
      const rawOfferings = await queryRows<SubjectOfferingRow & { rawFeatures: string }>(
        `
          SELECT 
            so.subject_offering_id as "offeringId",
            s.subject_code as "subjectCode",
            s.subject_title as "subjectTitle",
            s.lecture_units as "lecUnits",
            s.laboratory_units as "labUnits",
            sec.section_code as "sectionCode",
            so.expected_enrollment as "expectedEnrollment",
            d.department_code as "deptCode",
            sa.schedule_assignment_id as "assignmentId",
            sa.faculty_term_profile_id as "facultyProfileId",
            fac_u.first_name || ' ' || fac_u.last_name as "facultyName",
            ast.assignment_status_code as "statusCode",
            COALESCE(
              (
                SELECT rt_sub.room_type_name
                FROM subject_offering_room_requirements sorr_sub
                JOIN room_types rt_sub ON sorr_sub.room_type_id = rt_sub.room_type_id
                WHERE sorr_sub.subject_offering_id = so.subject_offering_id AND sorr_sub.is_required = true
                LIMIT 1
              ),
              (
                SELECT rt_sub.room_type_name
                FROM subject_room_requirements srr_sub
                JOIN room_types rt_sub ON srr_sub.room_type_id = rt_sub.room_type_id
                WHERE srr_sub.subject_id = so.subject_id AND srr_sub.is_required = true
                LIMIT 1
              )
            ) as "requiredRoomTypeName",
            COALESCE(
              (
                SELECT string_agg(rf.room_feature_name, ',')
                FROM subject_offering_room_requirements sorr
                JOIN room_features rf ON sorr.room_feature_id = rf.room_feature_id
                WHERE sorr.subject_offering_id = so.subject_offering_id AND sorr.is_required = true
              ),
              (
                SELECT string_agg(rf.room_feature_name, ',')
                FROM subject_room_requirements srr
                JOIN room_features rf ON srr.room_feature_id = rf.room_feature_id
                WHERE srr.subject_id = so.subject_id AND srr.is_required = true
              ),
              ''
            ) as "rawFeatures"
          FROM subject_offerings so
          JOIN subjects s ON so.subject_id = s.subject_id
          JOIN sections sec ON so.section_id = sec.section_id
          JOIN departments d ON sec.department_id = d.department_id
          LEFT JOIN schedule_assignments sa ON so.subject_offering_id = sa.subject_offering_id AND sa.schedule_version_id = $1
          LEFT JOIN assignment_statuses ast ON sa.assignment_status_id = ast.assignment_status_id
          LEFT JOIN faculty_term_profiles ftp ON sa.faculty_term_profile_id = ftp.faculty_term_profile_id
          LEFT JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
          LEFT JOIN users fac_u ON fp.faculty_id = fac_u.user_id
          WHERE so.academic_term_id = $2
          ORDER BY s.subject_code, sec.section_code
        `,
        [currentVersion.scheduleVersionId, activeTerm.academicTermId]
      );

      offerings = rawOfferings.map((o) => ({
        ...o,
        requiredFeatures: o.rawFeatures ? o.rawFeatures.split(",") : [],
      }));

      if (selectedDept) {
        offerings = offerings.filter((o) => o.deptCode.toLowerCase() === selectedDept.toLowerCase());
      }
      if (queryText) {
        offerings = offerings.filter((o) => o.subjectCode.toLowerCase().includes(queryText) || o.subjectTitle.toLowerCase().includes(queryText));
      }

      // Faculty Options
      facultyList = await queryRows<FacultyOption>(
        `
          SELECT 
            ftp.faculty_term_profile_id as "profileId",
            fp.faculty_id as "facultyId",
            u.first_name || ' ' || u.last_name as "fullName",
            d.department_code as "deptCode",
            ftp.max_units::float as "maxUnits",
            ftp.max_hours::float as "maxHours"
          FROM faculty_term_profiles ftp
          JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
          JOIN users u ON fp.faculty_id = u.user_id
          JOIN departments d ON fp.department_id = d.department_id
          WHERE ftp.academic_term_id = $1
          ORDER BY u.last_name, u.first_name
        `,
        [activeTerm.academicTermId]
      );

      // Rooms
      roomList = await queryRows<RoomOption>(
        `
          SELECT 
            r.room_id as "roomId",
            r.room_code as "roomCode",
            r.room_name as "roomName",
            r.capacity as "capacity",
            rt.room_type_name as "roomTypeName",
            b.building_name as "buildingName"
          FROM rooms r
          JOIN room_types rt ON r.room_type_id = rt.room_type_id
          JOIN buildings b ON r.building_id = b.building_id
          WHERE r.is_active = true
          ORDER BY b.building_name, r.room_code
        `
      );

      // Time slots for term
      timeSlots = await queryRows<TimeSlotOption>(
        `
          SELECT 
            tts.term_time_slot_id as "termTimeSlotId",
            d.day_name as "dayName",
            ts.label as "label",
            ts.start_time as "startTime",
            ts.end_time as "endTime"
          FROM term_time_slots tts
          JOIN days_of_week d ON tts.day_of_week_id = d.day_of_week_id
          JOIN time_slots ts ON tts.time_slot_id = ts.time_slot_id
          WHERE tts.academic_term_id = $1 AND tts.is_enabled = true
          ORDER BY d.sort_order, ts.start_time
        `,
        [activeTerm.academicTermId]
      );

      // All meetings for this version
      meetings = await queryRows<MeetingRow>(
        `
          SELECT 
            sm.schedule_meeting_id as "meetingId",
            sa.schedule_assignment_id as "assignmentId",
            sm.term_time_slot_id as "termTimeSlotId",
            sm.room_id as "roomId",
            sm.meeting_type as "meetingType",
            r.room_code as "roomCode",
            r.room_name as "roomName",
            d.day_name as "dayName",
            ts.start_time as "startTime",
            ts.end_time as "endTime"
          FROM schedule_meetings sm
          JOIN schedule_assignments sa ON sm.schedule_assignment_id = sa.schedule_assignment_id
          JOIN rooms r ON sm.room_id = r.room_id
          JOIN term_time_slots tts ON sm.term_time_slot_id = tts.term_time_slot_id
          JOIN days_of_week d ON tts.day_of_week_id = d.day_of_week_id
          JOIN time_slots ts ON tts.time_slot_id = ts.time_slot_id
          WHERE sa.schedule_version_id = $1
          ORDER BY d.sort_order, ts.start_time
        `,
        [currentVersion.scheduleVersionId]
      );
    }
  }

  const departments = await queryRows<{ code: string; name: string }>(`SELECT department_code as "code", department_name as "name" FROM departments WHERE is_active = true ORDER BY department_name`);
  const isEditable = currentVersion && ["DRAFT", "CORRECTION_OPEN"].includes(currentVersion.statusCode);

  const stats = {
    unresolvedCount: currentVersion ? offerings.filter((o) => !o.facultyProfileId).length : 0,
    activeRoomsCount: roomList.length,
    availableFacultyCount: facultyList.length,
    hasTimeSlots: timeSlots.length > 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactive Schedule Editor</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create, assign, schedule, and validate academic subject offerings and class sections.
          </p>
        </div>

        {activeTerm && (
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
              <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
            </div>

            {isEditable && currentVersion && (
              <AutoScheduleAssistant scheduleVersionId={currentVersion.scheduleVersionId} stats={stats} />
            )}

            {(!currentVersion || !["DRAFT", "SUBMITTED", "CORRECTION_OPEN"].includes(currentVersion.statusCode)) && (
              <form action={createVersionAction}>
                <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--teal)]/90 transition cursor-pointer">
                  <Plus size={16} /> Create New Version v{versions.length ? versions[0].versionNumber + 1 : 1}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Version Status and Validation Summary Banner */}
      {currentVersion && validationReport && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-[var(--teal)]/10 p-3 text-[var(--teal)]">
                <Calendar size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    VERSION v{currentVersion.versionNumber}
                  </span>
                  <h2 className="text-lg font-bold text-foreground">Status: {currentVersion.statusCode}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${validationReport.isValid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"}`}>
                    {validationReport.isValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {validationReport.isValid ? "Zero Conflicts Detected" : "Validation Errors Present"}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1 font-mono">Created by {currentVersion.createdBy} on {new Date(currentVersion.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {isEditable && (
              <form action={submitVersionAction} className="shrink-0">
                <input type="hidden" name="scheduleVersionId" value={currentVersion.scheduleVersionId} />
                <button
                  type="submit"
                  disabled={!validationReport.isValid}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--teal)] px-6 py-3 font-semibold text-white shadow-md transition hover:bg-[var(--teal)]/90 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                >
                  <Check size={18} /> Submit for Departmental Review
                </button>
              </form>
            )}
          </div>

          {/* Conflict Alert Breakdown */}
          {!validationReport.isValid && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {validationReport.facultyConflicts.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-800/50 p-4 text-xs">
                  <p className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Faculty Conflicts ({validationReport.facultyConflicts.length})
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--muted)] list-disc pl-4">
                    {validationReport.facultyConflicts.map((fc, i) => (
                      <li key={i}>{fc.firstName} {fc.lastName} double-booked</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationReport.roomConflicts.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-800/50 p-4 text-xs">
                  <p className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Room Conflicts ({validationReport.roomConflicts.length})
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--muted)] list-disc pl-4">
                    {validationReport.roomConflicts.map((rc, i) => (
                      <li key={i}>{rc.roomCode} double-booked</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationReport.capacityMismatches.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4 text-xs">
                  <p className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Capacity Exceeded ({validationReport.capacityMismatches.length})
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--muted)] list-disc pl-4">
                    {validationReport.capacityMismatches.map((cm, i) => (
                      <li key={i}>{cm.subjectCode} ({cm.expectedEnrollment} &gt; {cm.capacity})</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationReport.workloadExceeded.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-800/50 p-4 text-xs">
                  <p className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Workload Exceeded ({validationReport.workloadExceeded.length})
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--muted)] list-disc pl-4">
                    {validationReport.workloadExceeded.map((we, i) => (
                      <li key={i}>{we.lastName} ({we.assignedUnits} &gt; {we.maxUnits}U)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {currentVersion ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <form method="get" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                name="q"
                defaultValue={queryText}
                placeholder="Search subject code / title..."
                className="w-60 rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
              />

              <select
                name="dept"
                defaultValue={selectedDept}
                className="rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
              >
                Filter
              </button>
            </div>

            <div className="text-xs text-[var(--muted)] font-mono">
              Showing {offerings.length} Subject Offering Sections
            </div>
          </form>

          {/* Offerings Grid */}
          <div className="space-y-6">
            {offerings.map((off) => {
              const offMeetings = meetings.filter((m) => m.assignmentId === off.assignmentId);

              return (
                <div key={off.offeringId} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
                  <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                          {off.deptCode} - {off.sectionCode}
                        </span>
                        <h3 className="font-bold text-lg text-foreground">{off.subjectCode} - {off.subjectTitle}</h3>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${off.statusCode === "ASSIGNED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800 font-mono"}`}>
                          {off.statusCode || "UNRESOLVED"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)] font-mono">
                        <span>Units: {off.lecUnits} Lec / {off.labUnits} Lab</span>
                        <span>-</span>
                        <span>Expected Enrollment: <strong className="text-foreground">{off.expectedEnrollment} Students</strong></span>
                        {off.requiredRoomTypeName && (
                          <>
                            <span>-</span>
                            <span>Required Room: <strong className="text-foreground">{off.requiredRoomTypeName}</strong></span>
                          </>
                        )}
                        {off.requiredFeatures.length > 0 && (
                          <>
                            <span>-</span>
                            <span>Features: <span className="text-[var(--teal)] font-bold">{off.requiredFeatures.join(", ")}</span></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Faculty Assignment Switcher */}
                    {isEditable && (
                      <form action={assignFacultyAction} className="flex items-center gap-2">
                        <input type="hidden" name="scheduleVersionId" value={currentVersion.scheduleVersionId} />
                        <input type="hidden" name="subjectOfferingId" value={off.offeringId} />
                        
                        <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border border-[var(--line)] shadow-2xs">
                          <UserPlus size={16} className="text-[var(--muted)]" />
                          <select
                            name="facultyTermProfileId"
                            defaultValue={off.facultyProfileId || ""}
                            className="text-xs bg-transparent font-semibold focus:outline-none cursor-pointer"
                          >
                            <option value="">Unassigned Instructor / TBA</option>
                            {facultyList.map((f) => (
                              <option key={f.profileId} value={f.profileId}>
                                {f.fullName} ({f.deptCode}) - {f.maxUnits}U max
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                          >
                            Assign
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Meetings Section */}
                  <div className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-3">
                      <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={16} /> Scheduled Class Meetings ({offMeetings.length})
                      </h4>

                      {isEditable && (
                        <form action={saveMeetingAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="scheduleVersionId" value={currentVersion.scheduleVersionId} />
                          <input type="hidden" name="subjectOfferingId" value={off.offeringId} />

                          <select name="meetingType" required className="rounded border border-[var(--line)] bg-background px-2 py-1 text-xs focus:border-[var(--teal)] focus:outline-none">
                            <option value="LECTURE">Lecture</option>
                            <option value="LABORATORY">Laboratory</option>
                            <option value="COMPUTER_LAB">Computer Lab</option>
                            <option value="ONLINE">Online Sync</option>
                          </select>

                          <select name="roomId" required className="rounded border border-[var(--line)] bg-background px-2 py-1 text-xs focus:border-[var(--teal)] focus:outline-none max-w-xs">
                            <option value="">Assign Room...</option>
                            {roomList.map((r) => (
                              <option key={r.roomId} value={r.roomId}>
                                {r.roomCode} ({r.roomTypeName}) - Cap: {r.capacity}
                              </option>
                            ))}
                          </select>

                          <select name="termTimeSlotId" required className="rounded border border-[var(--line)] bg-background px-2 py-1 text-xs focus:border-[var(--teal)] focus:outline-none max-w-xs">
                            <option value="">Assign Time Interval...</option>
                            {timeSlots.map((ts) => (
                              <option key={ts.termTimeSlotId} value={ts.termTimeSlotId}>
                                {ts.dayName} - {ts.label} ({ts.startTime.slice(0, 5)} - {ts.endTime.slice(0, 5)})
                              </option>
                            ))}
                          </select>

                          <button type="submit" className="inline-flex items-center gap-1 rounded bg-[var(--teal)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--teal)]/90 transition shadow-2xs cursor-pointer">
                            <Plus size={14} /> Add Meeting
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {offMeetings.map((mtg) => (
                        <div key={mtg.meetingId} className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-background p-3.5 shadow-2xs">
                          <div>
                            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                              <span>{mtg.roomCode}</span>
                              <span className="font-mono text-xs text-[var(--teal)] bg-[var(--teal)]/10 px-1.5 py-0.5 rounded border border-[var(--teal)]/20">
                                {mtg.meetingType}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                              {mtg.dayName}: {mtg.startTime.slice(0, 5)} - {mtg.endTime.slice(0, 5)}
                            </p>
                          </div>

                          {isEditable && (
                            <form action={deleteMeetingAction}>
                              <input type="hidden" name="scheduleVersionId" value={currentVersion.scheduleVersionId} />
                              <input type="hidden" name="meetingId" value={mtg.meetingId} />
                              <button type="submit" className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition">
                                <X size={16} />
                              </button>
                            </form>
                          )}
                        </div>
                      ))}

                      {offMeetings.length === 0 && (
                        <p className="text-xs text-[var(--muted)] italic py-2">No room and time intervals scheduled yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {offerings.length === 0 && (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
                No subject offerings found matching the selected filters. Use the Master Data / Subject Offerings module to import curriculum offerings.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
          No editable schedule version found. Click &quot;Create New Version&quot; at the top right to start encoding class schedules.
        </div>
      )}
    </div>
  );
}
