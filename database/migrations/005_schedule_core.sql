BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS workload_policies (
    workload_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(department_id) ON DELETE CASCADE,
    employment_type_id UUID REFERENCES employment_types(employment_type_id) ON DELETE RESTRICT,
    max_units NUMERIC(5,2) NOT NULL,
    max_hours NUMERIC(5,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_workload_policies_max_units CHECK (max_units >= 0),
    CONSTRAINT chk_workload_policies_max_hours CHECK (max_hours >= 0)
);

CREATE TABLE IF NOT EXISTS schedule_versions (
    schedule_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL,
    schedule_status_id UUID NOT NULL REFERENCES schedule_statuses(schedule_status_id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    released_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    released_at TIMESTAMPTZ,
    parent_schedule_version_id UUID REFERENCES schedule_versions(schedule_version_id) ON DELETE SET NULL,
    active_unlock_request_id UUID,
    UNIQUE (academic_term_id, version_number),
    CONSTRAINT chk_schedule_versions_version_number CHECK (version_number > 0)
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
    schedule_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    subject_offering_id UUID NOT NULL REFERENCES subject_offerings(subject_offering_id) ON DELETE RESTRICT,
    faculty_term_profile_id UUID REFERENCES faculty_term_profiles(faculty_term_profile_id) ON DELETE RESTRICT,
    assignment_status_id UUID NOT NULL REFERENCES assignment_statuses(assignment_status_id) ON DELETE RESTRICT,
    overload_override_request_id UUID,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_meetings (
    schedule_meeting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_assignment_id UUID NOT NULL REFERENCES schedule_assignments(schedule_assignment_id) ON DELETE CASCADE,
    term_time_slot_id UUID NOT NULL REFERENCES term_time_slots(term_time_slot_id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE RESTRICT,
    meeting_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_schedule_meetings_meeting_type CHECK (
        meeting_type IN ('LECTURE', 'LABORATORY', 'COMPUTER_LAB', 'ONLINE', 'OTHER')
    )
);

CREATE TABLE IF NOT EXISTS schedule_revision_history (
    schedule_revision_history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    schedule_assignment_id UUID REFERENCES schedule_assignments(schedule_assignment_id) ON DELETE SET NULL,
    schedule_meeting_id UUID REFERENCES schedule_meetings(schedule_meeting_id) ON DELETE SET NULL,
    revision_action_type_id SMALLINT NOT NULL REFERENCES revision_action_types(revision_action_type_id) ON DELETE RESTRICT,
    old_value_json JSONB,
    new_value_json JSONB,
    changed_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_versions_term_id ON schedule_versions(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_workload_policies_term_id ON workload_policies(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_schedule_versions_status_id ON schedule_versions(schedule_status_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_version_id ON schedule_assignments(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_subject_offering_id ON schedule_assignments(subject_offering_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_faculty_profile_id ON schedule_assignments(faculty_term_profile_id);
CREATE INDEX IF NOT EXISTS idx_schedule_meetings_assignment_id ON schedule_meetings(schedule_assignment_id);
CREATE INDEX IF NOT EXISTS idx_schedule_meetings_term_time_slot_id ON schedule_meetings(term_time_slot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_meetings_room_id ON schedule_meetings(room_id);
CREATE INDEX IF NOT EXISTS idx_schedule_revision_history_version_id ON schedule_revision_history(schedule_version_id);

COMMIT;
