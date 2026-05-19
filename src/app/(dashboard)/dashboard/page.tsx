import Link from "next/link";
import { 
  Users, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  Lock, 
  UserCheck, 
  ShieldAlert, 
  Key,
  Database,
  CalendarDays,
  GraduationCap,
  BookOpen,
  CheckSquare,
  CalendarCheck
} from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { queryOne } from "@/server/db";

export const dynamic = "force-dynamic";

type SystemStats = {
  userCount: number;
  deptCount: number;
  roomCount: number;
  termCount: number;
  pendingUnlockCount: number;
  activeNoticeCount: number;
  totalAuditCount: number;
  subjectCount: number;
  facultyCount: number;
  pendingReviewCount: number;
};

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const isSysAdmin = user.roles.some((r) => r.roleCode === "SYSTEM_ADMIN");
  const isRegistrar = user.roles.some((r) => r.roleCode === "REGISTRAR");
  const isDeptHead = user.roles.some((r) => r.roleCode === "DEPARTMENT_HEAD");
  const isFaculty = user.roles.some((r) => r.roleCode === "FACULTY");

  const stats = await queryOne<SystemStats>(`
    SELECT 
      (SELECT count(*)::int FROM users WHERE is_active = true) as "userCount",
      (SELECT count(*)::int FROM departments WHERE is_active = true) as "deptCount",
      (SELECT count(*)::int FROM rooms WHERE is_active = true) as "roomCount",
      (SELECT count(*)::int FROM academic_terms WHERE is_active = true) as "termCount",
      (SELECT count(*)::int FROM schedule_unlock_requests WHERE decision_status = 'PENDING') as "pendingUnlockCount",
      (SELECT count(*)::int FROM privacy_notices WHERE is_published = true) as "activeNoticeCount",
      (SELECT count(*)::int FROM audit_logs) as "totalAuditCount",
      (SELECT count(*)::int FROM subjects WHERE is_active = true) as "subjectCount",
      (SELECT count(*)::int FROM faculty_profiles WHERE is_active = true) as "facultyCount",
      (SELECT count(*)::int FROM schedule_review_records WHERE decision_status = 'PENDING') as "pendingReviewCount"
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-10">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)]">
            <UserCheck size={14} /> Active Session: {user.roles.map((r) => r.roleName).join(", ") || "User"}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            Welcome back, {user.firstName} {user.lastName}
          </h1>
          <p className="mt-1 text-base text-[var(--muted)]">
            Faculty Scheduling &amp; Workload Management System Hub.
          </p>
        </div>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isSysAdmin && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active Users</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.userCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <ShieldAlert size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active Notices</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.activeNoticeCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Lock size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Pending Unlocks</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.pendingUnlockCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Audit Events</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.totalAuditCount ?? 0}</p>
              </div>
            </div>
          </>
        )}

        {isRegistrar && !isSysAdmin && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departments</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.deptCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Subjects</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.subjectCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <CalendarDays size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Academic Terms</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.termCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <GraduationCap size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Faculty Profiles</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.facultyCount ?? 0}</p>
              </div>
            </div>
          </>
        )}

        {isDeptHead && !isRegistrar && !isSysAdmin && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <CheckSquare size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Pending Reviews</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.pendingReviewCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <GraduationCap size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Faculty Profiles</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.facultyCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departments</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.deptCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <CalendarDays size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Academic Terms</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.termCount ?? 0}</p>
              </div>
            </div>
          </>
        )}

        {isFaculty && !isDeptHead && !isRegistrar && !isSysAdmin && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <CalendarCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active Terms</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.termCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departments</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.deptCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Subjects</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.subjectCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Faculty Profiles</p>
                <p className="mt-1 text-2xl font-bold font-mono">{stats?.facultyCount ?? 0}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Role-Specific Action Modules */}
      <div className="space-y-8">
        {/* System Administration Modules */}
        {isSysAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--teal)] border-b border-[var(--line)] pb-2">
              <ShieldAlert size={16} /> System Administration Modules
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)] mb-4">
                    <Users size={20} />
                  </div>
                  <h3 className="text-lg font-bold">User Management</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Create, update, and manage system user accounts, credentials, and role assignments.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Users <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)] mb-4">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Privacy Notices</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Publish privacy notices and monitor compliance acceptance across faculty and staff.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Privacy Notices <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)] mb-4">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-bold">System Audit Logs</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Review immutable audit trails of all sensitive scheduling and administrative operations.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/audit" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    View Audit Logs <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mb-4">
                    <Lock size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Unlock Requests</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Evaluate and approve or reject schedule unlock requests submitted by registrars for corrections.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/unlocks" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Review Unlock Requests <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registrar Modules */}
        {isRegistrar && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-500 border-b border-[var(--line)] pb-2">
              <Database size={16} /> Registrar &amp; Scheduling Management Modules
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <Database size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Master Data Hub</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Configure institutional departments, curriculum subjects, physical facilities, and workload policies.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/master-data" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Master Data <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <CalendarDays size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Academic Term Setup</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Configure school years, term date ranges, enabled standard time slots, and availability submission windows.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/terms" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Term Setup <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Room Blocking</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Mark specific rooms as unavailable for maintenance, institutional events, or restricted schedules.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/blocking" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Room Blocks <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Faculty Profiles</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Maintain faculty employment records, specializations, and term teaching qualifications.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/faculty" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Faculty Profiles <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <BookOpen size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Subject Offerings</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Prepare and list active course offerings and required sections for the upcoming term.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/offerings" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Manage Offerings <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-4">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Schedule Editor</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Generate rule-based draft schedules, resolve scheduling conflicts, and allocate teaching units.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/schedules/edit" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Open Schedule Editor <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Department Head Modules */}
        {isDeptHead && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-purple-500 border-b border-[var(--line)] pb-2">
              <CheckSquare size={16} /> Department Head &amp; Academic Coordination Modules
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mb-4">
                    <CheckSquare size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Department Approvals</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Review submitted draft schedules, verify overload override requests, and record official approval decisions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/approval" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Review Pending Approvals <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mb-4">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Specialization Verification</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Inspect encoded faculty specializations and verify teaching competencies for subject assignments.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/faculty" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Verify Faculty Competencies <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mb-4">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Department Schedules</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    View approved term schedules, room allocations, and faculty timetables across your department.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/schedules/view" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    View Published Schedules <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Faculty Modules */}
        {isFaculty && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-500 border-b border-[var(--line)] pb-2">
              <CalendarCheck size={16} /> Faculty Portal Modules
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mb-4">
                    <CalendarCheck size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Schedule Availability</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Encode your preferred teaching days and time slots during open academic term submission windows.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/availability" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    Submit Availability <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)] hover:shadow-md">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mb-4">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Assigned Schedules</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                    Access your published final teaching schedule, room locations, and acknowledge official releases.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link href="/dashboard/schedules/view" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
                    View My Teaching Schedule <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Profile & Security Roles */}
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
            <Key className="text-[var(--teal)]" size={20} />
            <h2 className="text-lg font-bold tracking-tight">Identity Profile</h2>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold">Full Name</dt>
              <dd className="mt-1 font-bold text-base">{user.firstName} {user.lastName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold">Email Address</dt>
              <dd className="mt-1 font-mono text-sm text-[var(--muted)]">{user.email}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
            <ShieldCheck className="text-[var(--teal)]" size={20} />
            <h2 className="text-lg font-bold tracking-tight">Assigned Roles &amp; Scopes</h2>
          </div>
          {user.roles.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {user.roles.map((role) => (
                <div
                  className="rounded-lg border border-[var(--line)] bg-background p-4 shadow-2xs flex flex-col justify-between"
                  key={`${role.roleCode}-${role.scopeDepartmentId ?? "global"}`}
                >
                  <div>
                    <span className="inline-block rounded bg-[var(--teal)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--teal)]">
                      {role.roleCode}
                    </span>
                    <p className="mt-2 text-base font-bold">{role.roleName}</p>
                  </div>
                  <p className="mt-3 font-mono text-xs text-[var(--muted)] flex items-center gap-1.5 border-t border-[var(--line)] pt-2">
                    <span className="font-semibold">Scope:</span> {role.scopeDepartmentId ?? "Global Institutional"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              This account has no active role assignments.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
