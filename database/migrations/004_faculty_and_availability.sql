BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS faculty_profiles (
    faculty_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE RESTRICT,
    employee_number VARCHAR(80),
    department_id UUID NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    employment_type_id UUID REFERENCES employment_types(employment_type_id) ON DELETE RESTRICT,
    designation_id UUID REFERENCES designations(designation_id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_profiles_employee_number
ON faculty_profiles(employee_number)
WHERE employee_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS faculty_term_profiles (
    faculty_term_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty_profiles(faculty_id) ON DELETE RESTRICT,
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE CASCADE,
    max_units NUMERIC(5,2) NOT NULL,
    max_hours NUMERIC(5,2) NOT NULL,
    is_available_for_scheduling BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (faculty_id, academic_term_id),
    CONSTRAINT chk_faculty_term_profiles_max_units CHECK (max_units >= 0),
    CONSTRAINT chk_faculty_term_profiles_max_hours CHECK (max_hours >= 0)
);

CREATE TABLE IF NOT EXISTS faculty_specializations (
    faculty_specialization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty_profiles(faculty_id) ON DELETE CASCADE,
    specialization_code VARCHAR(80) NOT NULL,
    specialization_name VARCHAR(160) NOT NULL,
    specialization_status_id UUID NOT NULL REFERENCES specialization_statuses(specialization_status_id) ON DELETE RESTRICT,
    verified_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    UNIQUE (faculty_id, specialization_code)
);

CREATE TABLE IF NOT EXISTS availability_submission_windows (
    availability_submission_window_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE CASCADE,
    scope_department_id UUID REFERENCES departments(department_id) ON DELETE CASCADE,
    window_status_id UUID NOT NULL REFERENCES availability_window_statuses(availability_window_status_id) ON DELETE RESTRICT,
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_availability_window_order CHECK (closes_at > opens_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_availability_window_global
ON availability_submission_windows(academic_term_id)
WHERE scope_department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_availability_window_department
ON availability_submission_windows(academic_term_id, scope_department_id)
WHERE scope_department_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS faculty_availability (
    faculty_availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_term_profile_id UUID NOT NULL REFERENCES faculty_term_profiles(faculty_term_profile_id) ON DELETE CASCADE,
    term_time_slot_id UUID NOT NULL REFERENCES term_time_slots(term_time_slot_id) ON DELETE RESTRICT,
    availability_status_id UUID NOT NULL REFERENCES availability_statuses(availability_status_id) ON DELETE RESTRICT,
    submitted_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_admin_encoded BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (faculty_term_profile_id, term_time_slot_id)
);

CREATE INDEX IF NOT EXISTS idx_faculty_profiles_department_id ON faculty_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_term_profiles_term_id ON faculty_term_profiles(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_faculty_specializations_faculty_id ON faculty_specializations(faculty_id);
CREATE INDEX IF NOT EXISTS idx_availability_windows_term_id ON availability_submission_windows(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_faculty_availability_profile_id ON faculty_availability(faculty_term_profile_id);

COMMIT;

