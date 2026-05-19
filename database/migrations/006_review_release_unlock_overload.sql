BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS schedule_review_records (
    schedule_review_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    decision_status VARCHAR(30) NOT NULL,
    decision_reason TEXT,
    CONSTRAINT chk_schedule_review_decision_status CHECK (
        decision_status IN ('PENDING', 'APPROVED', 'REJECTED')
    ),
    CONSTRAINT chk_schedule_review_rejection_reason CHECK (
        decision_status <> 'REJECTED' OR btrim(COALESCE(decision_reason, '')) <> ''
    )
);

CREATE TABLE IF NOT EXISTS schedule_release_logs (
    schedule_release_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    released_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    release_notes TEXT
);

CREATE TABLE IF NOT EXISTS overload_override_requests (
    overload_override_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_term_id UUID NOT NULL REFERENCES academic_terms(academic_term_id) ON DELETE RESTRICT,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    faculty_term_profile_id UUID NOT NULL REFERENCES faculty_term_profiles(faculty_term_profile_id) ON DELETE RESTRICT,
    schedule_assignment_id UUID REFERENCES schedule_assignments(schedule_assignment_id) ON DELETE SET NULL,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_reason TEXT NOT NULL,
    decision_status VARCHAR(30) NOT NULL,
    decided_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    CONSTRAINT chk_overload_request_reason CHECK (btrim(request_reason) <> ''),
    CONSTRAINT chk_overload_decision_status CHECK (
        decision_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    CONSTRAINT chk_overload_rejection_reason CHECK (
        decision_status <> 'REJECTED' OR btrim(COALESCE(decision_reason, '')) <> ''
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_overload_pending_assignment
ON overload_override_requests(schedule_version_id, faculty_term_profile_id, schedule_assignment_id)
WHERE decision_status = 'PENDING' AND schedule_assignment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_overload_pending_profile
ON overload_override_requests(schedule_version_id, faculty_term_profile_id)
WHERE decision_status = 'PENDING' AND schedule_assignment_id IS NULL;

ALTER TABLE schedule_assignments
DROP CONSTRAINT IF EXISTS fk_schedule_assignments_overload_override;

ALTER TABLE schedule_assignments
ADD CONSTRAINT fk_schedule_assignments_overload_override
FOREIGN KEY (overload_override_request_id)
REFERENCES overload_override_requests(overload_override_request_id)
ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS faculty_schedule_acknowledgements (
    faculty_schedule_acknowledgement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_release_log_id UUID NOT NULL REFERENCES schedule_release_logs(schedule_release_log_id) ON DELETE CASCADE,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES faculty_profiles(faculty_id) ON DELETE RESTRICT,
    viewed_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledgement_note TEXT,
    CONSTRAINT chk_faculty_ack_order CHECK (
        acknowledged_at IS NULL
        OR (viewed_at IS NOT NULL AND acknowledged_at >= viewed_at)
    ),
    UNIQUE (schedule_release_log_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS schedule_unlock_requests (
    schedule_unlock_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(schedule_version_id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_reason TEXT NOT NULL,
    decision_status VARCHAR(30) NOT NULL,
    decided_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    correction_started_at TIMESTAMPTZ,
    correction_submitted_at TIMESTAMPTZ,
    correction_closed_at TIMESTAMPTZ,
    CONSTRAINT chk_schedule_unlock_request_reason CHECK (btrim(request_reason) <> ''),
    CONSTRAINT chk_schedule_unlock_decision_status CHECK (
        decision_status IN ('PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED', 'CANCELLED')
    ),
    CONSTRAINT chk_schedule_unlock_rejection_reason CHECK (
        decision_status <> 'REJECTED' OR btrim(COALESCE(decision_reason, '')) <> ''
    ),
    CONSTRAINT chk_schedule_unlock_used_pair CHECK (
        (decision_status = 'USED' AND used_at IS NOT NULL)
        OR decision_status <> 'USED'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_unlock_pending
ON schedule_unlock_requests(schedule_version_id)
WHERE decision_status = 'PENDING';

ALTER TABLE schedule_versions
DROP CONSTRAINT IF EXISTS fk_schedule_versions_active_unlock_request;

ALTER TABLE schedule_versions
ADD CONSTRAINT fk_schedule_versions_active_unlock_request
FOREIGN KEY (active_unlock_request_id)
REFERENCES schedule_unlock_requests(schedule_unlock_request_id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_review_records_version_id ON schedule_review_records(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_schedule_release_logs_version_id ON schedule_release_logs(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_faculty_acknowledgements_version_id ON faculty_schedule_acknowledgements(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_faculty_acknowledgements_faculty_id ON faculty_schedule_acknowledgements(faculty_id);
CREATE INDEX IF NOT EXISTS idx_overload_requests_version_id ON overload_override_requests(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_schedule_unlock_requests_version_id ON schedule_unlock_requests(schedule_version_id);

COMMIT;

