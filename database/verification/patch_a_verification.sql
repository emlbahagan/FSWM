SET search_path TO fswm, public;

SELECT 'duplicate_global_role_assignments' AS check_name, COUNT(*) AS violation_count
FROM (
    SELECT user_id, role_id
    FROM user_role_assignments
    WHERE scope_department_id IS NULL
      AND revoked_at IS NULL
    GROUP BY user_id, role_id
    HAVING COUNT(*) > 1
) violations;

SELECT 'duplicate_department_role_assignments' AS check_name, COUNT(*) AS violation_count
FROM (
    SELECT user_id, role_id, scope_department_id
    FROM user_role_assignments
    WHERE scope_department_id IS NOT NULL
      AND revoked_at IS NULL
    GROUP BY user_id, role_id, scope_department_id
    HAVING COUNT(*) > 1
) violations;

SELECT 'zero_unit_subjects' AS check_name, COUNT(*) AS violation_count
FROM subjects
WHERE lecture_units = 0 AND laboratory_units = 0;

SELECT 'zero_hour_subjects' AS check_name, COUNT(*) AS violation_count
FROM subjects
WHERE lecture_hours = 0 AND laboratory_hours = 0;

SELECT 'invalid_faculty_acknowledgements' AS check_name, COUNT(*) AS violation_count
FROM faculty_schedule_acknowledgements
WHERE acknowledged_at IS NOT NULL
  AND viewed_at IS NULL;

SELECT 'import_count_violations' AS check_name, COUNT(*) AS violation_count
FROM import_batches
WHERE total_rows IS NOT NULL
  AND successful_rows + failed_rows > total_rows;

SELECT 'physical_rooms_without_building' AS check_name, COUNT(*) AS violation_count
FROM rooms
WHERE is_virtual = FALSE
  AND building_id IS NULL;

SELECT 'used_unlock_without_used_at' AS check_name, COUNT(*) AS violation_count
FROM schedule_unlock_requests
WHERE decision_status = 'USED'
  AND used_at IS NULL;

SELECT 'room_feature_mismatch_view_count' AS check_name, COUNT(*) AS observed_count
FROM v_room_feature_requirement_mismatches;

SELECT 'cancelled_assignments_in_workload' AS check_name, COUNT(*) AS violation_count
FROM v_faculty_workload_by_version v
WHERE EXISTS (
    SELECT 1
    FROM schedule_assignments sa
    JOIN assignment_statuses ast ON ast.assignment_status_id = sa.assignment_status_id
    WHERE sa.schedule_version_id = v.schedule_version_id
      AND sa.faculty_term_profile_id = v.faculty_term_profile_id
      AND ast.assignment_status_code = 'CANCELLED'
);

SELECT 'term_lock_trigger_exists' AS check_name, COUNT(*) AS object_count
FROM pg_trigger
WHERE tgname = 'trg_sync_term_lock_status';

SELECT 'availability_window_unique_indexes' AS check_name, COUNT(*) AS object_count
FROM pg_indexes
WHERE schemaname = 'fswm'
  AND indexname IN ('uq_availability_window_global', 'uq_availability_window_department');

SELECT 'acknowledgements_without_release_log' AS check_name, COUNT(*) AS violation_count
FROM faculty_schedule_acknowledgements
WHERE schedule_release_log_id IS NULL;

