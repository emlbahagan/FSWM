import Link from "next/link";
import { Plus, Trash2, Calendar, Users, Tag, Layers } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { requireRole, RoleCode } from "@/server/rbac";
import { queryRows } from "@/server/db";
import { createSectionAction, createOfferingAction, deleteOfferingAction } from "@/app/(dashboard)/dashboard/offerings/actions";

export const dynamic = "force-dynamic";

type Term = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
  isActive: boolean;
};

type Department = {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
};

type Program = {
  programId: string;
  departmentId: string;
  programCode: string;
  programName: string;
};

type Subject = {
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  totalUnits: number;
};

type RoomType = {
  roomTypeId: string;
  roomTypeName: string;
};

type RoomFeature = {
  roomFeatureId: string;
  roomFeatureName: string;
};

type OfferingRow = {
  offeringId: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  expectedEnrollment: number;
  roomTypeName: string | null;
  roomFeatureName: string | null;
};

type SectionRow = {
  sectionId: string;
  academicTermId: string;
  departmentCode: string;
  programCode: string;
  sectionCode: string;
  yearLevel: number;
  offerings: OfferingRow[];
};

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ term?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar);

  const terms = await queryRows<Term>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName", is_active as "isActive"
    FROM academic_terms ORDER BY start_date DESC
  `);

  const selectedTermId = params?.term || terms.find((t) => t.isActive)?.academicTermId || terms[0]?.academicTermId;
  const currentTerm = terms.find((t) => t.academicTermId === selectedTermId);

  const departments = await queryRows<Department>(`
    SELECT department_id as "departmentId", department_code as "departmentCode", department_name as "departmentName"
    FROM departments WHERE is_active = true ORDER BY department_code
  `);

  const programs = await queryRows<Program>(`
    SELECT program_id as "programId", department_id as "departmentId", program_code as "programCode", program_name as "programName"
    FROM programs WHERE is_active = true ORDER BY program_code
  `);

  const subjects = await queryRows<Subject>(`
    SELECT subject_id as "subjectId", subject_code as "subjectCode", subject_title as "subjectTitle", (lecture_units + laboratory_units)::float as "totalUnits"
    FROM subjects WHERE is_active = true ORDER BY subject_code
  `);

  const roomTypes = await queryRows<RoomType>(`
    SELECT room_type_id as "roomTypeId", room_type_name as "roomTypeName"
    FROM room_types WHERE is_active = true ORDER BY room_type_name
  `);

  const roomFeatures = await queryRows<RoomFeature>(`
    SELECT room_feature_id as "roomFeatureId", room_feature_name as "roomFeatureName"
    FROM room_features WHERE is_active = true ORDER BY room_feature_name
  `);

  const rawSections = selectedTermId
    ? await queryRows<{
        sectionId: string;
        academicTermId: string;
        departmentCode: string;
        programCode: string;
        sectionCode: string;
        yearLevel: number;
        offeringId: string | null;
        subjectId: string | null;
        subjectCode: string | null;
        subjectTitle: string | null;
        expectedEnrollment: number | null;
        roomTypeName: string | null;
        roomFeatureName: string | null;
      }>(
        `
          SELECT 
            s.section_id as "sectionId",
            s.academic_term_id as "academicTermId",
            d.department_code as "departmentCode",
            p.program_code as "programCode",
            s.section_code as "sectionCode",
            s.year_level as "yearLevel",
            so.subject_offering_id as "offeringId",
            sub.subject_id as "subjectId",
            sub.subject_code as "subjectCode",
            sub.subject_title as "subjectTitle",
            so.expected_enrollment as "expectedEnrollment",
            rt.room_type_name as "roomTypeName",
            rf.room_feature_name as "roomFeatureName"
          FROM sections s
          JOIN departments d ON s.department_id = d.department_id
          JOIN programs p ON s.program_id = p.program_id
          LEFT JOIN subject_offerings so ON s.section_id = so.section_id
          LEFT JOIN subjects sub ON so.subject_id = sub.subject_id
          LEFT JOIN subject_offering_room_requirements sorr ON so.subject_offering_id = sorr.subject_offering_id
          LEFT JOIN room_types rt ON sorr.room_type_id = rt.room_type_id
          LEFT JOIN room_features rf ON sorr.room_feature_id = rf.room_feature_id
          WHERE s.academic_term_id = $1
          ORDER BY p.program_code, s.year_level, s.section_code, sub.subject_code
        `,
        [selectedTermId]
      )
    : [];

  // Group sections and offerings
  const sectionMap = new Map<string, SectionRow>();
  for (const row of rawSections) {
    if (!sectionMap.has(row.sectionId)) {
      sectionMap.set(row.sectionId, {
        sectionId: row.sectionId,
        academicTermId: row.academicTermId,
        departmentCode: row.departmentCode,
        programCode: row.programCode,
        sectionCode: row.sectionCode,
        yearLevel: row.yearLevel,
        offerings: [],
      });
    }

    if (row.offeringId && row.subjectId && row.subjectCode && row.subjectTitle && row.expectedEnrollment !== null) {
      sectionMap.get(row.sectionId)?.offerings.push({
        offeringId: row.offeringId,
        subjectId: row.subjectId,
        subjectCode: row.subjectCode,
        subjectTitle: row.subjectTitle,
        expectedEnrollment: row.expectedEnrollment,
        roomTypeName: row.roomTypeName,
        roomFeatureName: row.roomFeatureName,
      });
    }
  }
  const sections = Array.from(sectionMap.values());

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sections & Curriculum Offerings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create academic student blocks, map subject courses, enrollments, and physical room requirements per section.
          </p>
        </div>

        {/* Term Switcher */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--teal)]" />
          <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Term:</span>
          <div className="flex flex-wrap gap-1.5">
            {terms.map((t) => (
              <Link
                key={t.academicTermId}
                href={`/dashboard/offerings?term=${t.academicTermId}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                  t.academicTermId === selectedTermId
                    ? "bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm"
                    : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)] hover:border-[var(--teal)]"
                }`}
              >
                {t.schoolYear} - {t.termName} {t.isActive ? "(Active)" : ""}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Create Section Form */}
        <div>
          <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                <Layers size={20} />
              </div>
              <h2 className="text-lg font-bold">Add Section Block</h2>
            </div>

            {currentTerm ? (
              <form action={createSectionAction} className="mt-6 space-y-5">
                <input type="hidden" name="academicTermId" value={currentTerm.academicTermId} />

                <div>
                  <label htmlFor="departmentId" className="block text-sm font-semibold">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    required
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {departments.map((dept) => (
                      <option key={dept.departmentId} value={dept.departmentId}>
                        {dept.departmentName} ({dept.departmentCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="programId" className="block text-sm font-semibold">
                    Degree Program <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="programId"
                    name="programId"
                    required
                    className="mt-2 w-full rounded-md border border-[var(--line)] bg-background px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
                  >
                    {programs.map((prog) => (
                      <option key={prog.programId} value={prog.programId}>
                        [{prog.programCode}] {prog.programName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="yearLevel" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      Year Level <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      id="yearLevel"
                      name="yearLevel"
                      defaultValue="1"
                      required
                      className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="sectionCode" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      Section Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="sectionCode"
                      name="sectionCode"
                      required
                      placeholder="A"
                      className="mt-1 w-full font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-sm focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                  >
                    <Plus size={18} /> Create Section
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-6 text-sm text-[var(--muted)]">Please select an academic term above to create sections.</p>
            )}
          </div>
        </div>

        {/* Existing Sections & Offerings */}
        <div className="space-y-8">
          {sections.map((sec) => (
            <div
              key={sec.sectionId}
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm"
            >
              <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-[var(--teal)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                      {sec.programCode} {sec.yearLevel}-{sec.sectionCode}
                    </span>
                    <h3 className="font-bold text-lg text-foreground">
                      Year {sec.yearLevel} Section {sec.sectionCode}
                    </h3>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                    Department: {sec.departmentCode} - Active Student Block
                  </p>
                </div>
                <div className="text-xs font-mono font-semibold text-[var(--muted)] bg-background px-3 py-1.5 rounded border border-[var(--line)]">
                  {sec.offerings.length} Configured Subject Offerings
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {sec.offerings.map((off) => (
                    <div
                      key={off.offeringId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border border-[var(--line)] bg-background p-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-sm text-[var(--teal)]">{off.subjectCode}</span>
                          <span className="font-semibold text-sm text-foreground">{off.subjectTitle}</span>
                          <span className="rounded bg-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)] font-mono flex items-center gap-1">
                            <Users size={12} /> {off.expectedEnrollment} cap
                          </span>
                        </div>

                        {(off.roomTypeName || off.roomFeatureName) && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
                            <span className="font-semibold text-[var(--teal)]">Req:</span>
                            {off.roomTypeName && (
                              <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 text-[var(--teal)] border border-[var(--teal)]/20">
                                {off.roomTypeName}
                              </span>
                            )}
                            {off.roomFeatureName && (
                              <span className="rounded bg-[var(--panel)] px-2 py-0.5 border border-[var(--line)] flex items-center gap-1">
                                <Tag size={10} /> {off.roomFeatureName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <form action={deleteOfferingAction} className="flex items-center">
                        <input type="hidden" name="offeringId" value={off.offeringId} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center p-2 text-[var(--muted)] hover:text-red-500 rounded hover:bg-[var(--line)]/50 transition"
                          title="Remove subject offering from section"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </div>
                  ))}

                  {sec.offerings.length === 0 && (
                    <p className="text-xs text-[var(--muted)] italic text-center py-6 border border-dashed border-[var(--line)] rounded-md">
                      No subject offerings mapped to this section block yet. Use the form below to add subjects.
                    </p>
                  )}
                </div>

                {/* Add Offering Inline Form */}
                <form action={createOfferingAction} className="mt-6 border-t border-[var(--line)] pt-5 space-y-4">
                  <input type="hidden" name="academicTermId" value={sec.academicTermId} />
                  <input type="hidden" name="sectionId" value={sec.sectionId} />
                  
                  <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                    Add Subject Offering to {sec.programCode} {sec.yearLevel}-{sec.sectionCode}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-4 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[var(--muted)] mb-1">Select Subject</label>
                      <select
                        name="subjectId"
                        required
                        className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      >
                        {subjects.map((sub) => (
                          <option key={sub.subjectId} value={sub.subjectId}>
                            [{sub.subjectCode}] {sub.subjectTitle} ({sub.totalUnits} Units)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Target Enrollment</label>
                      <input
                        type="number"
                        name="expectedEnrollment"
                        min="1"
                        defaultValue="40"
                        required
                        className="w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--teal)]/90"
                    >
                      <Plus size={14} /> Add Offering
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Required Room Type (Optional)</label>
                      <select
                        name="roomTypeId"
                        className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-1 text-xs focus:border-[var(--teal)] focus:outline-none"
                      >
                        <option value="">Any Room Type</option>
                        {roomTypes.map((rt) => (
                          <option key={rt.roomTypeId} value={rt.roomTypeId}>
                            {rt.roomTypeName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Required Room Feature Tag (Optional)</label>
                      <select
                        name="roomFeatureId"
                        className="w-full rounded-md border border-[var(--line)] bg-background px-3 py-1 text-xs focus:border-[var(--teal)] focus:outline-none"
                      >
                        <option value="">No Special Feature Required</option>
                        {roomFeatures.map((rf) => (
                          <option key={rf.roomFeatureId} value={rf.roomFeatureId}>
                            {rf.roomFeatureName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ))}

          {sections.length === 0 && currentTerm && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              No sections created for {currentTerm.schoolYear} - {currentTerm.termName}. Use the form on the left to add section blocks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
