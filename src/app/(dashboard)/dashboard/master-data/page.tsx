import Link from "next/link";
import { Building2, GraduationCap, BookOpen, Clock, Briefcase, ArrowRight } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryOne } from "@/server/db";

export const dynamic = "force-dynamic";

type Counts = {
  deptCount: number;
  progCount: number;
  subjCount: number;
  bldgCount: number;
  roomCount: number;
};

export default async function MasterDataHubPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const counts = await queryOne<Counts>(`
    SELECT 
      (SELECT count(*)::int FROM departments WHERE is_active = true) as "deptCount",
      (SELECT count(*)::int FROM programs WHERE is_active = true) as "progCount",
      (SELECT count(*)::int FROM subjects WHERE is_active = true) as "subjCount",
      (SELECT count(*)::int FROM buildings WHERE is_active = true) as "bldgCount",
      (SELECT count(*)::int FROM rooms WHERE is_active = true) as "roomCount"
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="border-b border-[var(--line)] pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Master Data Management</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Central repository for organizational hierarchy, curriculum standards, physical campus facilities, and scheduling policies.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Departments & Programs */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
              <Building2 size={24} />
            </div>
            <h2 className="mt-4 text-lg font-bold">Departments & Programs</h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              Manage academic departments, degree programs, and department codes across the institution.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs font-mono font-semibold text-[var(--muted)]">
              <span>{counts?.deptCount ?? 0} Departments</span>
              <span>-</span>
              <span>{counts?.progCount ?? 0} Programs</span>
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              href="/dashboard/master-data/departments"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline"
            >
              Manage Departments <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Subjects Catalog */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
              <BookOpen size={24} />
            </div>
            <h2 className="mt-4 text-lg font-bold">Subject Catalog</h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              Define course codes, titles, lecture/laboratory units, and required weekly contact hours.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs font-mono font-semibold text-[var(--muted)]">
              <span>{counts?.subjCount ?? 0} Active Subjects</span>
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              href="/dashboard/master-data/subjects"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline"
            >
              Manage Subjects <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Buildings & Rooms */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
              <GraduationCap size={24} />
            </div>
            <h2 className="mt-4 text-lg font-bold">Campus Facilities & Rooms</h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              Register buildings, lecture halls, computer laboratories, room capacities, and physical equipment tags.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs font-mono font-semibold text-[var(--muted)]">
              <span>{counts?.bldgCount ?? 0} Buildings</span>
              <span>-</span>
              <span>{counts?.roomCount ?? 0} Rooms</span>
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              href="/dashboard/master-data/buildings"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline"
            >
              Manage Facilities <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Standard Time Slots */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
              <Clock size={24} />
            </div>
            <h2 className="mt-4 text-lg font-bold">Standard Time Slots</h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              Configure standardized institutional scheduling periods (e.g. 07:30 AM - 09:00 AM) and operational days.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              href="/dashboard/master-data/time-slots"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline"
            >
              Configure Time Slots <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Workload Policies */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--teal)]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
              <Briefcase size={24} />
            </div>
            <h2 className="mt-4 text-lg font-bold">Faculty Workload Policies</h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              Establish maximum unit ceilings and teaching hour limits for full-time and part-time employment types.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              href="/dashboard/master-data/workload"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline"
            >
              Manage Policies <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
