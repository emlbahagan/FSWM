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

SELECT 'acknowledgements_before_viewing' AS check_name, COUNT(*) AS violation_count
FROM faculty_schedule_acknowledgements
WHERE acknowledged_at IS NOT NULL
  AND viewed_at IS NULL;

SELECT 'import_row_count_violations' AS check_name, COUNT(*) AS violation_count
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

SELECT 'acknowledgements_without_release_log' AS check_name, COUNT(*) AS violation_count
FROM faculty_schedule_acknowledgements
WHERE schedule_release_log_id IS NULL;

