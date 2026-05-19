import Link from "next/link";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { createSubjectAction, updateSubjectAction } from "@/app/(dashboard)/dashboard/master-data/subjects/actions";

export const dynamic = "force-dynamic";

type SubjectRow = {
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  lectureUnits: number;
  laboratoryUnits: number;
  lectureHours: number;
  laboratoryHours: number;
  isActive: boolean;
};

export default async function SubjectsPage() {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const subjects = await queryRows<SubjectRow>(`
    SELECT 
      subject_id as "subjectId",
      subject_code as "subjectCode",
      subject_title as "subjectTitle",
      lecture_units::float as "lectureUnits",
      laboratory_units::float as "laboratoryUnits",
      lecture_hours::float as "lectureHours",
      laboratory_hours::float as "laboratoryHours",
      is_active as "isActive"
    FROM subjects
    ORDER BY subject_code
  `);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
        <Link
          href="/dashboard/master-data"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] transition hover:bg-background"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subject Catalog</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Define institutional course offerings, required lecture/laboratory units, and weekly contact hours.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Add Subject Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <BookOpen size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Subject</h2>
            </div>

            <form action={createSubjectAction} className="mt-6 space-y-5">
              <div>
                <label htmlFor="subjectCode" className="block text-sm font-semibold">
                  Course Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subjectCode"
                  name="subjectCode"
                  required
                  placeholder="CS101"
                  className="mt-2 w-full font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div>
                <label htmlFor="subjectTitle" className="block text-sm font-semibold">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subjectTitle"
                  name="subjectTitle"
                  required
                  placeholder="Introduction to Programming"
                  className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lectureUnits" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Lec Units
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    id="lectureUnits"
                    name="lectureUnits"
                    defaultValue="3.0"
                    required
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="laboratoryUnits" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Lab Units
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    id="laboratoryUnits"
                    name="laboratoryUnits"
                    defaultValue="0.0"
                    required
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lectureHours" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Lec Hrs/Wk
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    id="lectureHours"
                    name="lectureHours"
                    defaultValue="3.0"
                    required
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="laboratoryHours" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Lab Hrs/Wk
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    id="laboratoryHours"
                    name="laboratoryHours"
                    defaultValue="0.0"
                    required
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                >
                  <Plus size={18} /> Add Subject
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Subjects List */}
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
              <thead className="bg-background/50 font-semibold text-[var(--muted)]">
                <tr>
                  <th className="px-6 py-4">Subject Code</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4 text-center">Units (Lec/Lab)</th>
                  <th className="px-6 py-4 text-center">Hours/Wk (Lec/Lab)</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {subjects.map((subj) => (
                  <tr key={subj.subjectId} className="transition hover:bg-background/30">
                    <td className="px-6 py-4 font-mono font-bold text-[var(--teal)]">{subj.subjectCode}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{subj.subjectTitle}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs">
                      <span className="font-semibold">{subj.lectureUnits}</span> / <span className="text-[var(--muted)]">{subj.laboratoryUnits}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs">
                      <span className="font-semibold">{subj.lectureHours}</span> / <span className="text-[var(--muted)]">{subj.laboratoryHours}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          subj.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                        }`}
                      >
                        {subj.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={updateSubjectAction} className="inline-flex items-center gap-2">
                        <input type="hidden" name="subjectId" value={subj.subjectId} />
                        <input type="hidden" name="subjectTitle" value={subj.subjectTitle} />
                        <input type="hidden" name="lectureUnits" value={subj.lectureUnits} />
                        <input type="hidden" name="laboratoryUnits" value={subj.laboratoryUnits} />
                        <input type="hidden" name="lectureHours" value={subj.lectureHours} />
                        <input type="hidden" name="laboratoryHours" value={subj.laboratoryHours} />
                        <input type="hidden" name="isActive" value={subj.isActive ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded border border-[var(--line)] bg-background px-2.5 py-1 text-xs font-semibold hover:bg-[var(--line)]/50 transition"
                        >
                          Toggle Status
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[var(--muted)]">
                      No subjects configured in the catalog yet. Use the form to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
