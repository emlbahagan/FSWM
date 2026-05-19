SET search_path TO fswm, public;

WITH expected_tables(table_name) AS (
    VALUES
        ('users'),
        ('roles'),
        ('permissions'),
        ('role_permissions'),
        ('user_role_assignments'),
        ('departments'),
        ('programs'),
        ('term_statuses'),
        ('academic_terms'),
        ('subjects'),
        ('subject_room_requirements'),
        ('subject_specialization_requirements'),
        ('sections'),
        ('subject_offerings'),
        ('subject_offering_room_requirements'),
        ('buildings'),
        ('room_types'),
        ('rooms'),
        ('room_features'),
        ('room_feature_assignments'),
        ('days_of_week'),
        ('time_slots'),
        ('term_time_slots'),
        ('room_blocked_times'),
        ('faculty_profiles'),
        ('employment_types'),
        ('designations'),
        ('faculty_term_profiles'),
        ('specialization_statuses'),
        ('faculty_specializations'),
        ('availability_window_statuses'),
        ('availability_submission_windows'),
        ('availability_statuses'),
        ('faculty_availability'),
        ('schedule_statuses'),
        ('assignment_statuses'),
        ('schedule_versions'),
        ('schedule_assignments'),
        ('schedule_meetings'),
        ('revision_action_types'),
        ('schedule_revision_history'),
        ('workload_policies'),
        ('schedule_review_records'),
        ('schedule_release_logs'),
        ('faculty_schedule_acknowledgements'),
        ('overload_override_requests'),
        ('schedule_unlock_requests'),
        ('privacy_notices'),
        ('privacy_notice_acceptances'),
        ('notifications'),
        ('audit_logs'),
        ('import_batches'),
        ('import_rows')
)
SELECT expected_tables.table_name AS missing_table
FROM expected_tables
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'fswm'
 AND t.table_name = expected_tables.table_name
WHERE t.table_name IS NULL
ORDER BY expected_tables.table_name;

WITH expected_views(view_name) AS (
    VALUES
        ('v_faculty_workload_by_version'),
        ('v_room_type_requirement_mismatches'),
        ('v_room_feature_requirement_mismatches'),
        ('v_faculty_schedule_conflicts'),
        ('v_room_schedule_conflicts'),
        ('v_unresolved_assignments')
)
SELECT expected_views.view_name AS missing_view
FROM expected_views
LEFT JOIN information_schema.views v
  ON v.table_schema = 'fswm'
 AND v.table_name = expected_views.view_name
WHERE v.table_name IS NULL
ORDER BY expected_views.view_name;

SELECT 'required_functions' AS check_name, routine_name
FROM information_schema.routines
WHERE routine_schema = 'fswm'
  AND routine_name IN (
      'sync_term_lock_status',
      'assert_schedule_version_editable',
      'mark_schedule_unlock_request_used',
      'mark_schedule_unlock_request_used_by_version'
  )
ORDER BY routine_name;

