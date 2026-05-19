BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash TEXT,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_email_not_blank CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
ON users (lower(email));

CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code VARCHAR(30) NOT NULL UNIQUE,
    department_name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    program_code VARCHAR(40) NOT NULL,
    program_name VARCHAR(180) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (department_id, program_code)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
    user_role_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    scope_department_id UUID REFERENCES departments(department_id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_global_scope
ON user_role_assignments(user_id, role_id)
WHERE scope_department_id IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_department_scope
ON user_role_assignments(user_id, role_id, scope_department_id)
WHERE scope_department_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS academic_terms (
    academic_term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year VARCHAR(20) NOT NULL,
    term_name VARCHAR(60) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    term_status_id UUID NOT NULL REFERENCES term_statuses(term_status_id) ON DELETE RESTRICT,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (school_year, term_name),
    CONSTRAINT chk_academic_terms_date_order CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS subjects (
    subject_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_code VARCHAR(40) NOT NULL UNIQUE,
    subject_title VARCHAR(220) NOT NULL,
    lecture_units NUMERIC(4,2) NOT NULL DEFAULT 0,
    laboratory_units NUMERIC(4,2) NOT NULL DEFAULT 0,
    lecture_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    laboratory_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_subject_units_nonnegative CHECK (lecture_units >= 0 AND laboratory_units >= 0),
    CONSTRAINT chk_subject_hours_nonnegative CHECK (lecture_hours >= 0 AND laboratory_hours >= 0),
    CONSTRAINT chk_subject_has_units CHECK (lecture_units > 0 OR laboratory_units > 0),
    CONSTRAINT chk_subject_has_hours CHECK (lecture_hours > 0 OR laboratory_hours > 0)
);

CREATE TABLE IF NOT EXISTS subject_room_requirements (
    subject_room_requirement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
    room_feature_id UUID REFERENCES room_features(room_feature_id) ON DELETE RESTRICT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_subject_room_requirement_target CHECK (
        room_type_id IS NOT NULL OR room_feature_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS subject_specialization_requirements (
    subject_specialization_requirement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    specialization_code VARCHAR(80) NOT NULL,
    specialization_name VARCHAR(160) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sections (
    section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    program_id UUID NOT NULL REFERENCES programs(program_id) ON DELETE RESTRICT,
    section_code VARCHAR(80) NOT NULL,
    year_level SMALLINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (academic_term_id, program_id, section_code),
    CONSTRAINT chk_sections_year_level CHECK (year_level IS NULL OR year_level > 0)
);

CREATE TABLE IF NOT EXISTS subject_offerings (
    subject_offering_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES sections(section_id) ON DELETE RESTRICT,
    subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE RESTRICT,
    expected_enrollment INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (academic_term_id, section_id, subject_id),
    CONSTRAINT chk_subject_offerings_enrollment CHECK (
        expected_enrollment IS NULL OR expected_enrollment >= 0
    )
);

CREATE TABLE IF NOT EXISTS subject_offering_room_requirements (
    subject_offering_room_requirement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_offering_id UUID NOT NULL REFERENCES subject_offerings(subject_offering_id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
    room_feature_id UUID REFERENCES room_features(room_feature_id) ON DELETE RESTRICT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_subject_offering_room_requirement_target CHECK (
        room_type_id IS NOT NULL OR room_feature_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS buildings (
    building_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_code VARCHAR(40) NOT NULL UNIQUE,
    building_name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID REFERENCES buildings(building_id) ON DELETE RESTRICT,
    room_type_id UUID NOT NULL REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
    room_code VARCHAR(60) NOT NULL UNIQUE,
    room_name VARCHAR(160) NOT NULL,
    capacity INTEGER,
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_rooms_capacity CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT chk_room_building_required_unless_virtual CHECK (
        is_virtual = TRUE OR building_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS room_feature_assignments (
    room_feature_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    room_feature_id UUID NOT NULL REFERENCES room_features(room_feature_id) ON DELETE RESTRICT,
    UNIQUE (room_id, room_feature_id)
);

CREATE TABLE IF NOT EXISTS time_slots (
    time_slot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    label VARCHAR(80) NOT NULL,
    UNIQUE (start_time, end_time),
    CONSTRAINT chk_time_slots_order CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS term_time_slots (
    term_time_slot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE CASCADE,
    day_of_week_id UUID NOT NULL REFERENCES days_of_week(day_of_week_id) ON DELETE RESTRICT,
    time_slot_id UUID NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE RESTRICT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (academic_term_id, day_of_week_id, time_slot_id)
);

CREATE TABLE IF NOT EXISTS room_blocked_times (
    room_blocked_time_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    day_of_week_id UUID NOT NULL REFERENCES days_of_week(day_of_week_id) ON DELETE RESTRICT,
    time_slot_id UUID NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (academic_term_id, room_id, day_of_week_id, time_slot_id),
    CONSTRAINT fk_room_blocked_term_time_slot
        FOREIGN KEY (academic_term_id, day_of_week_id, time_slot_id)
        REFERENCES term_time_slots(academic_term_id, day_of_week_id, time_slot_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_programs_department_id ON programs(department_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_sections_term_id ON sections(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_subject_offerings_term_id ON subject_offerings(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_term_time_slots_term_id ON term_time_slots(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_room_blocked_times_term_room ON room_blocked_times(academic_term_id, room_id);

COMMIT;

