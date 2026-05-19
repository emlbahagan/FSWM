"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction, transactionQuery } from "@/server/db";
import { requireCurrentUser, recordAuditLog } from "@/server/auth";
import { requireDepartmentScope, requireRole, RoleCode } from "@/server/rbac";

export async function createFacultyProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const employeeNumber = formData.get("employeeNumber")?.toString().trim() || null;
  const departmentId = formData.get("departmentId")?.toString();
  const employmentTypeId = formData.get("employmentTypeId")?.toString() || null;
  const designationId = formData.get("designationId")?.toString() || null;

  if (!email || !firstName || !lastName || !departmentId) {
    throw new Error("Missing required fields");
  }

  await withTransaction(async (client) => {
    const user = await transactionQuery<{ user_id: string }>(
      client,
      `SELECT user_id FROM users WHERE lower(email) = $1`,
      [email]
    );

    let userId: string;

    if (user.rowCount === 0 || !user.rows[0]) {
      const newUser = await transactionQuery<{ user_id: string }>(
        client,
        `
          INSERT INTO users (email, first_name, last_name, is_active)
          VALUES ($1, $2, $3, true)
          RETURNING user_id
        `,
        [email, firstName, lastName]
      );
      if (newUser.rowCount === 0 || !newUser.rows[0]) throw new Error("Failed to create user");
      userId = newUser.rows[0].user_id;
    } else {
      userId = user.rows[0].user_id;
    }

    const existingProfile = await transactionQuery(
      client,
      `SELECT faculty_id FROM faculty_profiles WHERE faculty_id = $1`,
      [userId]
    );

    if (existingProfile.rowCount && existingProfile.rowCount > 0) {
      throw new Error("Faculty profile already exists for this user");
    }

    await transactionQuery(
      client,
      `
        INSERT INTO faculty_profiles (faculty_id, employee_number, department_id, employment_type_id, designation_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
      `,
      [userId, employeeNumber, departmentId, employmentTypeId, designationId]
    );

    const facultyRole = await transactionQuery<{ role_id: string }>(
      client,
      `SELECT role_id FROM roles WHERE role_code = 'FACULTY'`
    );

    if (facultyRole.rows[0]) {
      await transactionQuery(
        client,
        `
          INSERT INTO user_role_assignments (user_id, role_id, scope_department_id, assigned_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `,
        [userId, facultyRole.rows[0].role_id, departmentId, currentUser.userId]
      );
    }

    const activeTerm = await transactionQuery<{ academic_term_id: string }>(
      client,
      `SELECT academic_term_id FROM academic_terms WHERE is_active = true LIMIT 1`
    );

    if (activeTerm.rows[0]) {
      const policy = await transactionQuery<{ max_units: number; max_hours: number }>(
        client,
        `
          SELECT max_units, max_hours FROM workload_policies
          WHERE academic_term_id = $1 AND (employment_type_id = $2 OR employment_type_id IS NULL)
          ORDER BY department_id NULLS LAST LIMIT 1
        `,
        [activeTerm.rows[0].academic_term_id, employmentTypeId]
      );

      const maxUnits = policy.rows[0]?.max_units ?? 24;
      const maxHours = policy.rows[0]?.max_hours ?? 30;

      await transactionQuery(
        client,
        `
          INSERT INTO faculty_term_profiles (faculty_id, academic_term_id, max_units, max_hours, is_available_for_scheduling)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (faculty_id, academic_term_id) DO NOTHING
        `,
        [userId, activeTerm.rows[0].academic_term_id, maxUnits, maxHours]
      );
    }

    await recordAuditLog({
      actorUserId: currentUser.userId,
      actionCode: "FACULTY_PROFILE_CREATED",
      moduleCode: "FACULTY",
      targetTable: "faculty_profiles",
      targetId: userId,
      newValueJson: { email, firstName, lastName, employeeNumber, departmentId, employmentTypeId },
    });
  });

  revalidatePath("/dashboard/faculty");
}

export async function updateFacultyProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const facultyId = formData.get("facultyId")?.toString();
  const employeeNumber = formData.get("employeeNumber")?.toString().trim() || null;
  const departmentId = formData.get("departmentId")?.toString();
  const employmentTypeId = formData.get("employmentTypeId")?.toString() || null;
  const designationId = formData.get("designationId")?.toString() || null;
  const isActive = formData.get("isActive") === "true";

  if (!facultyId || !departmentId) {
    throw new Error("Missing required fields");
  }

  await query(
    `
      UPDATE faculty_profiles
      SET employee_number = $1, department_id = $2, employment_type_id = $3, designation_id = $4, is_active = $5
      WHERE faculty_id = $6
    `,
    [employeeNumber, departmentId, employmentTypeId, designationId, isActive, facultyId]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "FACULTY_PROFILE_UPDATED",
    moduleCode: "FACULTY",
    targetTable: "faculty_profiles",
    targetId: facultyId,
    newValueJson: { employeeNumber, departmentId, employmentTypeId, designationId, isActive },
  });

  revalidatePath("/dashboard/faculty");
}

export async function updateTermWorkloadAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const facultyId = formData.get("facultyId")?.toString();
  const academicTermId = formData.get("academicTermId")?.toString();
  const maxUnits = parseFloat(formData.get("maxUnits")?.toString() || "0");
  const maxHours = parseFloat(formData.get("maxHours")?.toString() || "0");
  const isAvailableForScheduling = formData.get("isAvailableForScheduling") === "true";

  if (!facultyId || !academicTermId || maxUnits < 0 || maxHours < 0) {
    throw new Error("Missing required fields or invalid workload numbers");
  }

  await query(
    `
      INSERT INTO faculty_term_profiles (faculty_id, academic_term_id, max_units, max_hours, is_available_for_scheduling)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (faculty_id, academic_term_id)
      DO UPDATE SET max_units = EXCLUDED.max_units, max_hours = EXCLUDED.max_hours, is_available_for_scheduling = EXCLUDED.is_available_for_scheduling
    `,
    [facultyId, academicTermId, maxUnits, maxHours, isAvailableForScheduling]
  );

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "TERM_WORKLOAD_UPDATED",
    moduleCode: "FACULTY",
    targetTable: "faculty_term_profiles",
    targetId: facultyId,
    newValueJson: { academicTermId, maxUnits, maxHours, isAvailableForScheduling },
  });

  revalidatePath("/dashboard/faculty");
}

export async function addSpecializationAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.Registrar, { anyScope: true });

  const facultyId = formData.get("facultyId")?.toString();
  const specializationCode = formData.get("specializationCode")?.toString().trim().toUpperCase();
  const specializationName = formData.get("specializationName")?.toString().trim();

  if (!facultyId || !specializationCode || !specializationName) {
    throw new Error("Missing required fields");
  }

  const status = await queryOne<{ specialization_status_id: string }>(
    `SELECT specialization_status_id FROM specialization_statuses WHERE specialization_status_code = 'PENDING'`
  );

  if (!status) throw new Error("Status lookup failed");

  const spec = await queryOne<{ faculty_specialization_id: string }>(
    `
      INSERT INTO faculty_specializations (faculty_id, specialization_code, specialization_name, specialization_status_id)
      VALUES ($1, $2, $3, $4)
      RETURNING faculty_specialization_id
    `,
    [facultyId, specializationCode, specializationName, status.specialization_status_id]
  );

  if (!spec) {
    throw new Error("Duplicate specialization or creation failed");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: "SPECIALIZATION_ADDED",
    moduleCode: "FACULTY",
    targetTable: "faculty_specializations",
    targetId: spec.faculty_specialization_id,
    newValueJson: { facultyId, specializationCode, specializationName, status: "PENDING" },
  });

  revalidatePath("/dashboard/faculty");
}

export async function verifySpecializationAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  requireRole(currentUser, RoleCode.DepartmentHead, { anyScope: true });

  const specializationId = formData.get("specializationId")?.toString();
  const decision = formData.get("decision")?.toString();
  const rejectionReason = formData.get("rejectionReason")?.toString().trim() || null;

  if (!specializationId || !decision) {
    throw new Error("Missing required fields");
  }

  if (!["VERIFIED", "REJECTED"].includes(decision)) {
    throw new Error("Invalid specialization decision");
  }

  if (decision === "REJECTED" && !rejectionReason) {
    throw new Error("Rejection reason is required");
  }

  const target = await queryOne<{ departmentId: string }>(
    `
      SELECT fp.department_id as "departmentId"
      FROM faculty_specializations fs
      JOIN faculty_profiles fp ON fs.faculty_id = fp.faculty_id
      WHERE fs.faculty_specialization_id = $1
      LIMIT 1
    `,
    [specializationId]
  );

  if (!target) {
    throw new Error("Specialization not found");
  }

  requireDepartmentScope(currentUser, target.departmentId, { roleCode: RoleCode.DepartmentHead });

  const status = await queryOne<{ specialization_status_id: string }>(
    `SELECT specialization_status_id FROM specialization_statuses WHERE specialization_status_code = $1`,
    [decision]
  );

  if (!status) throw new Error("Invalid status decision");

  const updated = await query<{ faculty_specialization_id: string }>(
    `
      UPDATE faculty_specializations
      SET specialization_status_id = $1, verified_by = $2, verified_at = now(), rejection_reason = $3
      WHERE faculty_specialization_id = $4
        AND specialization_status_id = (
          SELECT specialization_status_id FROM specialization_statuses WHERE specialization_status_code = 'PENDING'
        )
      RETURNING faculty_specialization_id
    `,
    [status.specialization_status_id, currentUser.userId, rejectionReason, specializationId]
  );

  if (updated.rowCount !== 1) {
    throw new Error("Only pending specializations can be reviewed");
  }

  await recordAuditLog({
    actorUserId: currentUser.userId,
    actionCode: `SPECIALIZATION_${decision}`,
    moduleCode: "FACULTY",
    targetTable: "faculty_specializations",
    targetId: specializationId,
    newValueJson: { decision, rejectionReason },
  });

  revalidatePath("/dashboard/faculty");
}
