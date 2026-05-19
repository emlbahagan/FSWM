import { GraduationCap, Plus, Briefcase, Award, CheckCircle2, XCircle, Calendar, AlertCircle, Check, X } from "lucide-react";
import { requireCurrentUser } from "@/server/auth";
import { hasDepartmentScope, requireAnyRole, RoleCode } from "@/server/rbac";
import { queryRows, queryOne } from "@/server/db";
import { createFacultyProfileAction, updateFacultyProfileAction, updateTermWorkloadAction, addSpecializationAction, verifySpecializationAction } from "@/app/(dashboard)/dashboard/faculty/actions";

export const dynamic = "force-dynamic";

type ActiveTerm = {
  academicTermId: string;
  schoolYear: string;
  termName: string;
};

type Department = {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
};

type EmploymentType = {
  employmentTypeId: string;
  employmentTypeName: string;
};

type Designation = {
  designationId: string;
  designationName: string;
};

type Specialization = {
  specId: string;
  facultyId: string;
  code: string;
  name: string;
  statusCode: string;
  verifiedBy: string | null;
  rejectionReason: string | null;
};

type FacultyRow = {
  facultyId: string;
  fullName: string;
  email: string;
  employeeNumber: string | null;
  departmentId: string;
  departmentName: string;
  employmentTypeId: string | null;
  employmentTypeName: string | null;
  designationId: string | null;
  designationName: string | null;
  isActive: boolean;
  maxUnits: number | null;
  maxHours: number | null;
  isAvailable: boolean | null;
  specializations: Specialization[];
};

export default async function FacultyProfilesPage() {
  const currentUser = await requireCurrentUser();
  requireAnyRole(currentUser, [RoleCode.Registrar, RoleCode.DepartmentHead], { anyScope: true });
  const isRegistrar = currentUser.roles.some((r) => r.roleCode === RoleCode.Registrar);
  const isDeptHead = currentUser.roles.some((r) => r.roleCode === RoleCode.DepartmentHead);

  const activeTerm = await queryOne<ActiveTerm>(`
    SELECT academic_term_id as "academicTermId", school_year as "schoolYear", term_name as "termName"
    FROM academic_terms WHERE is_active = true LIMIT 1
  `);

  const departments = await queryRows<Department>(`
    SELECT department_id as "departmentId", department_code as "departmentCode", department_name as "departmentName"
    FROM departments WHERE is_active = true ORDER BY department_name
  `);

  const employmentTypes = await queryRows<EmploymentType>(`
    SELECT employment_type_id as "employmentTypeId", employment_type_name as "employmentTypeName"
    FROM employment_types ORDER BY employment_type_name
  `);

  const designations = await queryRows<Designation>(`
    SELECT designation_id as "designationId", designation_name as "designationName"
    FROM designations ORDER BY designation_name
  `);

  const allSpecs = await queryRows<Specialization>(`
    SELECT 
      fs.faculty_specialization_id as "specId",
      fs.faculty_id as "facultyId",
      fs.specialization_code as "code",
      fs.specialization_name as "name",
      ss.specialization_status_code as "statusCode",
      u.first_name || ' ' || u.last_name as "verifiedBy",
      fs.rejection_reason as "rejectionReason"
    FROM faculty_specializations fs
    JOIN specialization_statuses ss ON fs.specialization_status_id = ss.specialization_status_id
    LEFT JOIN users u ON fs.verified_by = u.user_id
    ORDER BY fs.specialization_code
  `);

  const rawFaculty = activeTerm
    ? await queryRows<{
        facultyId: string;
        fullName: string;
        email: string;
        employeeNumber: string | null;
        departmentId: string;
        departmentName: string;
        employmentTypeId: string | null;
        employmentTypeName: string | null;
        designationId: string | null;
        designationName: string | null;
        isActive: boolean;
        maxUnits: number | null;
        maxHours: number | null;
        isAvailable: boolean | null;
      }>(
        `
          SELECT 
            fp.faculty_id as "facultyId",
            u.first_name || ' ' || u.last_name as "fullName",
            u.email,
            fp.employee_number as "employeeNumber",
            d.department_id as "departmentId",
            d.department_name as "departmentName",
            fp.employment_type_id as "employmentTypeId",
            et.employment_type_name as "employmentTypeName",
            fp.designation_id as "designationId",
            des.designation_name as "designationName",
            fp.is_active as "isActive",
            ftp.max_units::float as "maxUnits",
            ftp.max_hours::float as "maxHours",
            ftp.is_available_for_scheduling as "isAvailable"
          FROM faculty_profiles fp
          JOIN users u ON fp.faculty_id = u.user_id
          JOIN departments d ON fp.department_id = d.department_id
          LEFT JOIN employment_types et ON fp.employment_type_id = et.employment_type_id
          LEFT JOIN designations des ON fp.designation_id = des.designation_id
          LEFT JOIN faculty_term_profiles ftp ON fp.faculty_id = ftp.faculty_id AND ftp.academic_term_id = $1
          ORDER BY u.last_name, u.first_name
        `,
        [activeTerm.academicTermId]
      )
    : [];

  const specMap = new Map<string, Specialization[]>();
  for (const spec of allSpecs) {
    if (!specMap.has(spec.facultyId)) specMap.set(spec.facultyId, []);
    specMap.get(spec.facultyId)?.push(spec);
  }

  const visibleFaculty = isRegistrar
    ? rawFaculty
    : rawFaculty.filter((f) =>
        hasDepartmentScope(currentUser, f.departmentId, { roleCode: RoleCode.DepartmentHead })
      );

  const facultyList: FacultyRow[] = visibleFaculty.map((f) => ({
    ...f,
    specializations: specMap.get(f.facultyId) || [],
  }));

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Directory & Profiles</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage academic instructors, employment types, term workload ceilings, and verified area specializations.
          </p>
        </div>

        {activeTerm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--teal)] border border-[var(--teal)]/20">
            <Calendar size={14} /> Active Term: {activeTerm.schoolYear} - {activeTerm.termName}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2.5fr]">
        {/* Enroll Faculty Member Form */}
        <div>
          {isRegistrar ? (
            <div className="sticky top-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal)]/10 text-[var(--teal)]">
                  <GraduationCap size={20} />
                </div>
                <h2 className="text-lg font-bold">Enroll Faculty Member</h2>
              </div>

              <form action={createFacultyProfileAction} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="prof.name@university.edu"
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[var(--muted)] font-mono">Will link or create matching user account.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      placeholder="Jane"
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      placeholder="Doe"
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="employeeNumber" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Employee Number (Optional)
                  </label>
                  <input
                    type="text"
                    id="employeeNumber"
                    name="employeeNumber"
                    placeholder="EMP-10293"
                    className="mt-1 w-full font-mono rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="departmentId" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Primary Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.departmentName} ({d.departmentCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="employmentTypeId" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Employment Type
                  </label>
                  <select
                    id="employmentTypeId"
                    name="employmentTypeId"
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                  >
                    <option value="">Select Employment Type...</option>
                    {employmentTypes.map((et) => (
                      <option key={et.employmentTypeId} value={et.employmentTypeId}>
                        {et.employmentTypeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="designationId" className="block text-xs font-semibold text-[var(--muted)] uppercase">
                    Designation
                  </label>
                  <select
                    id="designationId"
                    name="designationId"
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-background px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                  >
                    <option value="">Standard Faculty</option>
                    {designations.map((des) => (
                      <option key={des.designationId} value={des.designationId}>
                        {des.designationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--teal)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--teal)]/90"
                  >
                    <Plus size={16} /> Register Faculty Profile
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
              Only Registrars can enroll new faculty profiles.
            </div>
          )}
        </div>

        {/* Faculty Profiles List */}
        <div className="space-y-8">
          {facultyList.map((fac) => (
            <div
              key={fac.facultyId}
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm"
            >
              <div className="border-b border-[var(--line)] bg-background/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-[var(--teal)]/10 px-2 py-0.5 font-mono text-xs font-bold text-[var(--teal)] border border-[var(--teal)]/20">
                      {fac.employeeNumber || "NO-EMP-ID"}
                    </span>
                    <h3 className="font-bold text-lg text-foreground">{fac.fullName}</h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        fac.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
                      }`}
                    >
                      {fac.isActive ? "Active Status" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)] flex items-center gap-2">
                    <span>{fac.email}</span>
                    <span>-</span>
                    <span>{fac.departmentName}</span>
                    {fac.employmentTypeName && (
                      <>
                        <span>-</span>
                        <span className="font-semibold text-foreground">{fac.employmentTypeName}</span>
                      </>
                    )}
                  </p>
                </div>

                {isRegistrar && (
                  <form action={updateFacultyProfileAction} className="flex items-center gap-2">
                    <input type="hidden" name="facultyId" value={fac.facultyId} />
                    <input type="hidden" name="employeeNumber" value={fac.employeeNumber || ""} />
                    <input type="hidden" name="departmentId" value={fac.departmentId} />
                    <input type="hidden" name="employmentTypeId" value={fac.employmentTypeId || ""} />
                    <input type="hidden" name="designationId" value={fac.designationId || ""} />
                    <select
                      name="isActive"
                      defaultValue={fac.isActive ? "true" : "false"}
                      className="rounded border border-[var(--line)] bg-background px-2.5 py-1 text-xs font-semibold focus:border-[var(--teal)] focus:outline-none"
                    >
                      <option value="true">Active Instructor</option>
                      <option value="false">Inactive Instructor</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                    >
                      Update
                    </button>
                  </form>
                )}
              </div>

              <div className="p-6 space-y-8">
                {/* Section 1: Term Workload Profile */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5 border-b border-[var(--line)] pb-2 mb-4">
                    <Briefcase size={16} /> Active Term Scheduling Profile
                  </h4>

                  {activeTerm ? (
                    <form action={updateTermWorkloadAction} className="grid sm:grid-cols-4 gap-4 items-end bg-background p-4 rounded-md border border-[var(--line)]">
                      <input type="hidden" name="facultyId" value={fac.facultyId} />
                      <input type="hidden" name="academicTermId" value={activeTerm.academicTermId} />

                      <div>
                        <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">Max Units / Sem</label>
                        <input
                          type="number"
                          step="0.5"
                          name="maxUnits"
                          defaultValue={fac.maxUnits ?? 24}
                          required
                          className="w-full font-mono rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                          disabled={!isRegistrar}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">Max Hours / Wk</label>
                        <input
                          type="number"
                          step="0.5"
                          name="maxHours"
                          defaultValue={fac.maxHours ?? 30}
                          required
                          className="w-full font-mono rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none"
                          disabled={!isRegistrar}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--muted)] uppercase mb-1">Availability</label>
                        <select
                          name="isAvailableForScheduling"
                          defaultValue={fac.isAvailable !== false ? "true" : "false"}
                          className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs focus:border-[var(--teal)] focus:outline-none font-semibold"
                          disabled={!isRegistrar}
                        >
                          <option value="true">Available to Teach</option>
                          <option value="false">On Leave / Not Available</option>
                        </select>
                      </div>

                      {isRegistrar && (
                        <button
                          type="submit"
                          className="w-full rounded-md bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--teal)]/90 transition shadow-xs"
                        >
                          Update Workload
                        </button>
                      )}
                    </form>
                  ) : (
                    <p className="text-xs text-[var(--muted)] italic">No active academic term configured.</p>
                  )}
                </div>

                {/* Section 2: Area Specializations */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5 border-b border-[var(--line)] pb-2 mb-4">
                    <Award size={16} /> Verified Subject Specializations ({fac.specializations.length})
                  </h4>

                  <div className="space-y-3">
                    {fac.specializations.map((spec) => (
                      <div
                        key={spec.specId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border border-[var(--line)] bg-background p-3.5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--teal)]">{spec.code}</span>
                            <span className="font-semibold text-sm text-foreground">{spec.name}</span>
                          </div>

                          <div className="mt-1 flex items-center gap-3 text-[11px]">
                            <span
                              className={`font-semibold inline-flex items-center gap-1 ${
                                spec.statusCode === "VERIFIED"
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : spec.statusCode === "REJECTED"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-amber-600 dark:text-amber-400 font-mono"
                              }`}
                            >
                              {spec.statusCode === "VERIFIED" && <CheckCircle2 size={12} />}
                              {spec.statusCode === "REJECTED" && <XCircle size={12} />}
                              {spec.statusCode === "PENDING" && <AlertCircle size={12} />}
                              Status: {spec.statusCode}
                            </span>
                            {spec.verifiedBy && <span className="text-[var(--muted)]">Reviewed by: {spec.verifiedBy}</span>}
                            {spec.rejectionReason && (
                              <span className="text-rose-600 font-mono italic">Reason: {spec.rejectionReason}</span>
                            )}
                          </div>
                        </div>

                        {isDeptHead &&
                          hasDepartmentScope(currentUser, fac.departmentId, { roleCode: RoleCode.DepartmentHead }) &&
                          spec.statusCode === "PENDING" && (
                          <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <form action={verifySpecializationAction}>
                              <input type="hidden" name="specializationId" value={spec.specId} />
                              <input type="hidden" name="decision" value="VERIFIED" />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-200 transition"
                              >
                                <Check size={14} /> Verify
                              </button>
                            </form>

                            <form action={verifySpecializationAction} className="flex items-center gap-2">
                              <input type="hidden" name="specializationId" value={spec.specId} />
                              <input type="hidden" name="decision" value="REJECTED" />
                              <input
                                type="text"
                                name="rejectionReason"
                                placeholder="Reason if rejecting..."
                                required
                                className="w-28 rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-xs focus:border-[var(--rose)] focus:outline-none"
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-400 hover:bg-rose-200 transition"
                              >
                                <X size={14} /> Reject
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    ))}

                    {fac.specializations.length === 0 && (
                      <p className="text-xs text-[var(--muted)] italic py-3 text-center border border-dashed border-[var(--line)] rounded-md">
                        No subject specializations recorded yet.
                      </p>
                    )}
                  </div>

                  {/* Add Specialization Inline Form */}
                  {isRegistrar && (
                    <form action={addSpecializationAction} className="mt-4 flex flex-col sm:flex-row gap-3 pt-3 border-t border-[var(--line)]">
                      <input type="hidden" name="facultyId" value={fac.facultyId} />
                      <input
                        type="text"
                        name="specializationCode"
                        required
                        placeholder="Spec Code (e.g. AI-ML)"
                        className="w-full sm:w-44 font-mono uppercase rounded-md border border-[var(--line)] bg-background px-3 py-1 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
                      />
                      <input
                        type="text"
                        name="specializationName"
                        required
                        placeholder="Specialization Name (e.g. Artificial Intelligence & Machine Learning)"
                        className="flex-1 rounded-md border border-[var(--line)] bg-background px-3 py-1 text-xs placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--panel)] border border-[var(--line)] px-4 py-1 text-xs font-semibold text-foreground hover:border-[var(--teal)] transition shadow-2xs"
                      >
                        <Plus size={14} /> Add Specialization
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}

          {facultyList.length === 0 && activeTerm && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-12 text-center text-sm text-[var(--muted)]">
              No faculty profiles registered for {activeTerm.schoolYear}. Use the enrollment form on the left to add instructors.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
