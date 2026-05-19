import Link from "next/link";
import { CalendarDays, Plus, CheckCircle2, Lock, Unlock, Star, Save } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { createTermAction, updateTermAction, setActiveTermAction } from "@/app/(dashboard)/dashboard/terms/actions";

export const dynamic = "force-dynamic";

type TermStatus = {
  termStatusId: string;
  termStatusCode: string;
  termStatusName: string;
};

type TermRow = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  isActive: boolean;
  termStatusId: string;
  termStatusCode: string;
  termStatusName: string;
};

export default async function TermsPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const statuses = await queryRows<TermStatus>(`
    SELECT term_status_id as "termStatusId", term_status_code as "termStatusCode", term_status_name as "termStatusName"
    FROM term_statuses ORDER BY term_status_name
  `);

  const terms = await queryRows<TermRow>(`
    SELECT 
      at.academic_term_id as "academicTermId",
      at.school_year as "schoolYear",
      at.term_name as "termName",
      at.start_date::text as "startDate",
      at.end_date::text as "endDate",
      at.is_locked as "isLocked",
      at.is_active as "isActive",
      ts.term_status_id as "termStatusId",
      ts.term_status_code as "termStatusCode",
      ts.term_status_name as "termStatusName"
    FROM academic_terms at
    JOIN term_statuses ts ON at.term_status_id = ts.term_status_id
    ORDER BY at.start_date DESC
  `);

  const defaultStatus = statuses.find((s) => s.termStatusCode === "OPEN");

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="border-b border-[var(--line)] pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Academic Terms Setup</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage academic term lifecycles, schedule locks, operational date boundaries, and active system scope.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Create Academic Term Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <CalendarDays size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Academic Term</h2>
            </div>

            <form action={createTermAction} className="mt-6 space-y-5">
              <div>
                <label htmlFor="schoolYear" className="block text-sm font-semibold">
                  School Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="schoolYear"
                  name="schoolYear"
                  required
                  placeholder="SY 2026-2027"
                  className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div>
                <label htmlFor="termName" className="block text-sm font-semibold">
                  Term Name / Semester <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="termName"
                  name="termName"
                  required
                  placeholder="1st Semester"
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-semibold">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  required
                  defaultValue="2026-08-01"
                  className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  required
                  defaultValue="2026-12-15"
                  className="mt-2 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="termStatusId" className="block text-sm font-semibold">
                  Initial Status
                </label>
                <select
                  id="termStatusId"
                  name="termStatusId"
                  required
                  defaultValue={defaultStatus?.termStatusId}
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none"
                >
                  {statuses.map((st) => (
                    <option key={st.termStatusId} value={st.termStatusId}>
                      {st.termStatusName} ({st.termStatusCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-background p-3 text-sm cursor-pointer hover:bg-background/80 transition">
                  <input type="checkbox" name="isActive" value="true" defaultChecked className="rounded text-[var(--teal)] focus:ring-[var(--teal)]" />
                  <span className="font-semibold text-foreground">Set as Active Term</span>
                </label>
                <p className="mt-1 text-xs text-[var(--muted)]">Making this active will automatically un-active previously active terms.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90 cursor-pointer"
                >
                  <Plus size={18} /> Create Academic Term
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Existing Terms List with full inline update */}
        <div className="space-y-6">
          {terms.map((term) => (
            <div
              key={term.academicTermId}
              className={`overflow-hidden rounded-lg border bg-[var(--panel)] shadow-sm transition ${
                term.isActive ? "border-[var(--teal)] ring-1 ring-[var(--teal)]/30" : "border-[var(--line)]"
              }`}
            >
              <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--teal)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                    {term.schoolYear}
                  </span>
                  <h3 className="font-bold text-lg text-foreground">{term.termName}</h3>
                  {term.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                      <Star size={12} className="fill-current" /> Active Term
                    </span>
                  )}
                </div>

                {!term.isActive && (
                  <form action={setActiveTermAction}>
                    <input type="hidden" name="termId" value={term.academicTermId} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-[var(--teal)] hover:text-[var(--teal)] transition shadow-2xs cursor-pointer"
                      title="Set this term as current active term across the system"
                    >
                      <CheckCircle2 size={14} /> Make Active
                    </button>
                  </form>
                )}
              </div>

              {/* Full Interactive Edit Form */}
              <div className="p-6 border-b border-[var(--line)]">
                <form action={updateTermAction} className="space-y-4">
                  <input type="hidden" name="termId" value={term.academicTermId} />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">School Year</label>
                      <input
                        type="text"
                        name="schoolYear"
                        defaultValue={term.schoolYear}
                        required
                        className="w-full font-mono rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">Term Name / Sem</label>
                      <input
                        type="text"
                        name="termName"
                        defaultValue={term.termName}
                        required
                        className="w-full rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">Start Date</label>
                      <input
                        type="date"
                        name="startDate"
                        defaultValue={term.startDate}
                        required
                        className="w-full font-mono rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">End Date</label>
                      <input
                        type="date"
                        name="endDate"
                        defaultValue={term.endDate}
                        required
                        className="w-full font-mono rounded border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--line)]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--muted)]">Status:</span>
                        <select
                          name="termStatusId"
                          defaultValue={term.termStatusId}
                          className={`rounded border bg-background px-2.5 py-1 text-xs font-semibold focus:outline-none ${
                            term.termStatusCode === "OPEN" ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                          }`}
                        >
                          {statuses.map((st) => (
                            <option key={st.termStatusId} value={st.termStatusId}>
                              {st.termStatusName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={term.isActive}
                          className="rounded text-[var(--teal)] focus:ring-[var(--teal)]"
                        />
                        <span>Active Term</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--teal)]/90 transition shadow-2xs cursor-pointer"
                    >
                      <Save size={14} /> Save Term Updates
                    </button>
                  </div>
                </form>
              </div>

              <div className="p-6 bg-background/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${term.isLocked ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
                      {term.isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {term.isLocked ? "Schedule Revisions Locked" : "Schedule Revisions Open"}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {term.isLocked
                          ? "Trigger sync: Term status is LOCKED or ARCHIVED. Further scheduling requires unlock requests."
                          : "Coordinators and Registrars can edit schedule assignments freely."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/offerings?term=${term.academicTermId}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90 cursor-pointer"
                    >
                      Manage Sections & Offerings
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {terms.length === 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              No academic terms configured yet. Use the form on the left to set up your first semester.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
