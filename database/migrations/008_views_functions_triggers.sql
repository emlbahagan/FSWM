BEGIN;

SET search_path TO fswm, public;

CREATE OR REPLACE FUNCTION sync_term_lock_status()
RETURNS TRIGGER AS $$
DECLARE
    v_status_code VARCHAR(40);
BEGIN
    SELECT term_status_code
    INTO v_status_code
    FROM term_statuses
    WHERE term_status_id = NEW.term_status_id;

    IF v_status_code IN ('LOCKED', 'ARCHIVED') THEN
        NEW.is_locked := TRUE;
        IF NEW.locked_at IS NULL THEN
            NEW.locked_at := now();
        END IF;
    ELSIF v_status_code = 'OPEN' THEN
        NEW.is_locked := FALSE;
        NEW.locked_by := NULL;
        NEW.locked_at := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_term_lock_status ON academic_terms;

CREATE TRIGGER trg_sync_term_lock_status
BEFORE INSERT OR UPDATE OF term_status_id ON academic_terms
FOR EACH ROW
EXECUTE FUNCTION sync_term_lock_status();

CREATE OR REPLACE FUNCTION assert_schedule_version_editable(p_schedule_version_id UUID)
RETURNS VOID AS $$
DECLARE
    v_is_protected BOOLEAN;
BEGIN
    SELECT
        CASE
            WHEN at.is_locked = TRUE THEN TRUE
            WHEN ss.schedule_status_code IN ('APPROVED', 'RELEASED', 'ARCHIVED') THEN TRUE
            ELSE FALSE
        END
    INTO v_is_protected
    FROM schedule_versions sv
    JOIN academic_terms at ON at.academic_term_id = sv.academic_term_id
    JOIN schedule_statuses ss ON ss.schedule_status_id = sv.schedule_status_id
    WHERE sv.schedule_version_id = p_schedule_version_id;

    IF v_is_protected IS NULL THEN
        RAISE EXCEPTION 'Schedule version does not exist.';
    END IF;

    IF v_is_protected = TRUE AND NOT EXISTS (
        SELECT 1
        FROM schedule_unlock_requests sur
        WHERE sur.schedule_version_id = p_schedule_version_id
          AND sur.decision_status = 'APPROVED'
          AND sur.used_at IS NULL
          AND (sur.expires_at IS NULL OR sur.expires_at > now())
    ) THEN
        RAISE EXCEPTION 'Schedule version is locked, approved, released, or archived. An approved unused unlock request is required before editing.';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_schedule_unlock_request_used(p_schedule_unlock_request_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE schedule_unlock_requests
    SET decision_status = 'USED',
        used_at = COALESCE(used_at, now()),
        correction_closed_at = COALESCE(correction_closed_at, now())
    WHERE schedule_unlock_request_id = p_schedule_unlock_request_id
      AND decision_status = 'APPROVED'
      AND used_at IS NULL
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No approved unused unexpired unlock request found.';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_schedule_unlock_request_used_by_version(p_schedule_version_id UUID)
RETURNS VOID AS $$
DECLARE
    v_unlock_request_id UUID;
BEGIN
    SELECT sur.schedule_unlock_request_id
    INTO v_unlock_request_id
    FROM schedule_unlock_requests sur
    WHERE sur.schedule_version_id = p_schedule_version_id
      AND sur.decision_status = 'APPROVED'
      AND sur.used_at IS NULL
      AND (sur.expires_at IS NULL OR sur.expires_at > now())
    ORDER BY sur.decided_at DESC NULLS LAST, sur.requested_at DESC
    LIMIT 1;

    IF v_unlock_request_id IS NULL THEN
        RAISE EXCEPTION 'No approved unused unexpired unlock request found.';
    END IF;

    PERFORM mark_schedule_unlock_request_used(v_unlock_request_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW v_faculty_workload_by_version AS
SELECT
    sv.schedule_version_id,
    ftp.faculty_term_profile_id,
    fp.faculty_id,
    u.first_name,
    u.last_name,
    COALESCE(SUM(s.lecture_units + s.laboratory_units), 0)::NUMERIC(8,2) AS assigned_units,
    COALESCE(SUM(s.lecture_hours + s.laboratory_hours), 0)::NUMERIC(8,2) AS assigned_hours
FROM schedule_versions sv
JOIN schedule_assignments sa ON sa.schedule_version_id = sv.schedule_version_id
JOIN assignment_statuses ast ON ast.assignment_status_id = sa.assignment_status_id
JOIN faculty_term_profiles ftp ON ftp.faculty_term_profile_id = sa.faculty_term_profile_id
JOIN faculty_profiles fp ON fp.faculty_id = ftp.faculty_id
JOIN users u ON u.user_id = fp.faculty_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects s ON s.subject_id = so.subject_id
WHERE ast.assignment_status_code IN ('ASSIGNED', 'REVISED')
GROUP BY
    sv.schedule_version_id,
    ftp.faculty_term_profile_id,
    fp.faculty_id,
    u.first_name,
    u.last_name;

CREATE OR REPLACE VIEW v_room_type_requirement_mismatches AS
WITH required_room_types AS (
    SELECT
        so.subject_offering_id,
        sorr.room_type_id
    FROM subject_offerings so
    JOIN subject_offering_room_requirements sorr
      ON sorr.subject_offering_id = so.subject_offering_id
     AND sorr.is_required = TRUE
     AND sorr.room_type_id IS NOT NULL
    UNION
    SELECT
        so.subject_offering_id,
        srr.room_type_id
    FROM subject_offerings so
    JOIN subject_room_requirements srr
      ON srr.subject_id = so.subject_id
     AND srr.is_required = TRUE
     AND srr.room_type_id IS NOT NULL
    WHERE NOT EXISTS (
        SELECT 1
        FROM subject_offering_room_requirements sorr
        WHERE sorr.subject_offering_id = so.subject_offering_id
          AND sorr.is_required = TRUE
          AND sorr.room_type_id IS NOT NULL
    )
)
SELECT
    sv.schedule_version_id,
    sa.schedule_assignment_id,
    sm.schedule_meeting_id,
    so.subject_offering_id,
    subj.subject_code,
    subj.subject_title,
    r.room_code,
    r.room_name,
    rt.room_type_code AS assigned_room_type_code,
    rt.room_type_name AS assigned_room_type_name,
    rrt.room_type_id AS required_room_type_id,
    required_rt.room_type_code AS required_room_type_code,
    required_rt.room_type_name AS required_room_type_name
FROM schedule_meetings sm
JOIN schedule_assignments sa ON sa.schedule_assignment_id = sm.schedule_assignment_id
JOIN schedule_versions sv ON sv.schedule_version_id = sa.schedule_version_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects subj ON subj.subject_id = so.subject_id
JOIN rooms r ON r.room_id = sm.room_id
JOIN room_types rt ON rt.room_type_id = r.room_type_id
JOIN required_room_types rrt ON rrt.subject_offering_id = so.subject_offering_id
JOIN room_types required_rt ON required_rt.room_type_id = rrt.room_type_id
WHERE r.room_type_id <> rrt.room_type_id;

CREATE OR REPLACE VIEW v_room_feature_requirement_mismatches AS
WITH required_room_features AS (
    SELECT
        so.subject_offering_id,
        sorr.room_feature_id
    FROM subject_offerings so
    JOIN subject_offering_room_requirements sorr
      ON sorr.subject_offering_id = so.subject_offering_id
     AND sorr.is_required = TRUE
     AND sorr.room_feature_id IS NOT NULL
    UNION
    SELECT
        so.subject_offering_id,
        srr.room_feature_id
    FROM subject_offerings so
    JOIN subject_room_requirements srr
      ON srr.subject_id = so.subject_id
     AND srr.is_required = TRUE
     AND srr.room_feature_id IS NOT NULL
    WHERE NOT EXISTS (
        SELECT 1
        FROM subject_offering_room_requirements sorr
        WHERE sorr.subject_offering_id = so.subject_offering_id
          AND sorr.is_required = TRUE
          AND sorr.room_feature_id IS NOT NULL
    )
)
SELECT
    sv.schedule_version_id,
    sa.schedule_assignment_id,
    sm.schedule_meeting_id,
    so.subject_offering_id,
    subj.subject_code,
    subj.subject_title,
    r.room_code,
    r.room_name,
    rrf.room_feature_id AS required_feature_id,
    rf.room_feature_code AS required_feature_code,
    rf.room_feature_name AS required_feature_name
FROM schedule_meetings sm
JOIN schedule_assignments sa ON sa.schedule_assignment_id = sm.schedule_assignment_id
JOIN schedule_versions sv ON sv.schedule_version_id = sa.schedule_version_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects subj ON subj.subject_id = so.subject_id
JOIN rooms r ON r.room_id = sm.room_id
JOIN required_room_features rrf ON rrf.subject_offering_id = so.subject_offering_id
JOIN room_features rf ON rf.room_feature_id = rrf.room_feature_id
WHERE NOT EXISTS (
    SELECT 1
    FROM room_feature_assignments rfa
    WHERE rfa.room_id = r.room_id
      AND rfa.room_feature_id = rrf.room_feature_id
);

CREATE OR REPLACE VIEW v_faculty_schedule_conflicts AS
SELECT
    sa1.schedule_version_id,
    sa1.faculty_term_profile_id,
    fp.faculty_id,
    u.first_name,
    u.last_name,
    sm1.term_time_slot_id,
    sm1.schedule_meeting_id AS first_schedule_meeting_id,
    sm2.schedule_meeting_id AS second_schedule_meeting_id
FROM schedule_meetings sm1
JOIN schedule_assignments sa1 ON sa1.schedule_assignment_id = sm1.schedule_assignment_id
JOIN assignment_statuses ast1 ON ast1.assignment_status_id = sa1.assignment_status_id
JOIN schedule_meetings sm2
  ON sm2.term_time_slot_id = sm1.term_time_slot_id
 AND sm2.schedule_meeting_id > sm1.schedule_meeting_id
JOIN schedule_assignments sa2
  ON sa2.schedule_assignment_id = sm2.schedule_assignment_id
 AND sa2.schedule_version_id = sa1.schedule_version_id
 AND sa2.faculty_term_profile_id = sa1.faculty_term_profile_id
JOIN assignment_statuses ast2 ON ast2.assignment_status_id = sa2.assignment_status_id
JOIN faculty_term_profiles ftp ON ftp.faculty_term_profile_id = sa1.faculty_term_profile_id
JOIN faculty_profiles fp ON fp.faculty_id = ftp.faculty_id
JOIN users u ON u.user_id = fp.faculty_id
WHERE sa1.faculty_term_profile_id IS NOT NULL
  AND ast1.assignment_status_code IN ('ASSIGNED', 'REVISED')
  AND ast2.assignment_status_code IN ('ASSIGNED', 'REVISED');

CREATE OR REPLACE VIEW v_room_schedule_conflicts AS
SELECT
    sa1.schedule_version_id,
    sm1.room_id,
    r.room_code,
    r.room_name,
    sm1.term_time_slot_id,
    sm1.schedule_meeting_id AS first_schedule_meeting_id,
    sm2.schedule_meeting_id AS second_schedule_meeting_id
FROM schedule_meetings sm1
JOIN schedule_assignments sa1 ON sa1.schedule_assignment_id = sm1.schedule_assignment_id
JOIN assignment_statuses ast1 ON ast1.assignment_status_id = sa1.assignment_status_id
JOIN schedule_meetings sm2
  ON sm2.term_time_slot_id = sm1.term_time_slot_id
 AND sm2.room_id = sm1.room_id
 AND sm2.schedule_meeting_id > sm1.schedule_meeting_id
JOIN schedule_assignments sa2
  ON sa2.schedule_assignment_id = sm2.schedule_assignment_id
 AND sa2.schedule_version_id = sa1.schedule_version_id
JOIN assignment_statuses ast2 ON ast2.assignment_status_id = sa2.assignment_status_id
JOIN rooms r ON r.room_id = sm1.room_id
WHERE ast1.assignment_status_code IN ('ASSIGNED', 'REVISED')
  AND ast2.assignment_status_code IN ('ASSIGNED', 'REVISED');

CREATE OR REPLACE VIEW v_unresolved_assignments AS
SELECT
    sv.schedule_version_id,
    sa.schedule_assignment_id,
    so.subject_offering_id,
    subj.subject_code,
    subj.subject_title,
    sec.section_code,
    ast.assignment_status_code
FROM schedule_assignments sa
JOIN schedule_versions sv ON sv.schedule_version_id = sa.schedule_version_id
JOIN assignment_statuses ast ON ast.assignment_status_id = sa.assignment_status_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects subj ON subj.subject_id = so.subject_id
JOIN sections sec ON sec.section_id = so.section_id
WHERE ast.assignment_status_code = 'UNRESOLVED'
   OR (sa.faculty_term_profile_id IS NULL AND ast.assignment_status_code <> 'CANCELLED');

COMMIT;

