# FSWM Patch A — Database Hotfixes and Integration Fixes

**System:** Faculty Scheduling and Workload Management System  
**Base schema:** `fswm_3nf_database_schema_v2_fixed.sql`  
**Patch format:** Markdown-only implementation guide with SQL blocks  
**Purpose:** Fix the critical schema issues and high-value warnings identified in the analysis report before backend implementation.

---

## 0. Application Order

Apply this patch in this order:

1. Unlock request validation fixes
2. Faculty acknowledgement validation fixes
3. User-role assignment uniqueness fix
4. Workload view correction
5. Subject unit/hour constraints
6. Revision action validation
7. Room requirement mismatch view split
8. Academic term lock-status synchronization
9. Import row-count validation
10. Availability submission window uniqueness
11. Room virtual/building distinction
12. Faculty acknowledgement to release-log linkage
13. Final verification queries

> Important: This file is intentionally a Markdown file. Copy each SQL block into a migration file only after checking table/constraint names in your actual database.

---

# 1. Fix Unlock Token Reuse

## Issue

`schedule_unlock_requests.used_at` exists, but the editability guard does not check whether the approved unlock request was already used.

## Fix

Replace the current `assert_schedule_version_editable` function with this version:

```sql
CREATE OR REPLACE FUNCTION assert_schedule_version_editable(p_schedule_version_id UUID)
RETURNS VOID AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    SELECT
        CASE
            WHEN at.is_locked = TRUE THEN TRUE
            WHEN ss.schedule_status_code IN ('APPROVED', 'RELEASED', 'ARCHIVED') THEN TRUE
            ELSE FALSE
        END
    INTO v_is_locked
    FROM schedule_versions sv
    JOIN academic_terms at ON at.academic_term_id = sv.academic_term_id
    JOIN schedule_statuses ss ON ss.schedule_status_id = sv.schedule_status_id
    WHERE sv.schedule_version_id = p_schedule_version_id;

    IF v_is_locked IS NULL THEN
        RAISE EXCEPTION 'Schedule version does not exist.';
    END IF;

    IF v_is_locked = TRUE AND NOT EXISTS (
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
```

## Add `USED` Status Pairing Rule

```sql
ALTER TABLE schedule_unlock_requests
DROP CONSTRAINT IF EXISTS chk_schedule_unlock_used_pair;

ALTER TABLE schedule_unlock_requests
ADD CONSTRAINT chk_schedule_unlock_used_pair
CHECK (
    (decision_status = 'USED' AND used_at IS NOT NULL)
    OR (decision_status <> 'USED')
);
```

## Optional Use-Marking Function

Use this helper after the first successful edit under an approved unlock request.

```sql
CREATE OR REPLACE FUNCTION mark_schedule_unlock_request_used(p_schedule_version_id UUID)
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

    IF v_unlock_request_id IS NOT NULL THEN
        UPDATE schedule_unlock_requests
        SET decision_status = 'USED',
            used_at = now()
        WHERE schedule_unlock_request_id = v_unlock_request_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

---

# 2. Fix Faculty Schedule Acknowledgement Rule

## Issue

The current constraint allows `acknowledged_at` to be set while `viewed_at` is still `NULL`.

## Fix

```sql
ALTER TABLE faculty_schedule_acknowledgements
DROP CONSTRAINT IF EXISTS chk_faculty_ack_order;

ALTER TABLE faculty_schedule_acknowledgements
ADD CONSTRAINT chk_faculty_ack_order
CHECK (
    acknowledged_at IS NULL
    OR (viewed_at IS NOT NULL AND acknowledged_at >= viewed_at)
);
```

---

# 3. Fix User-Role Assignment Uniqueness

## Issue

The base unique constraint on `(user_id, role_id, scope_department_id)` is misleading because ordinary unique constraints allow multiple `NULL` values in PostgreSQL.

## Fix

Drop the base unique constraint and keep the partial unique indexes.

```sql
ALTER TABLE user_role_assignments
DROP CONSTRAINT IF EXISTS user_role_assignments_user_id_role_id_scope_department_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_global_scope
ON user_role_assignments(user_id, role_id)
WHERE scope_department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_department_scope
ON user_role_assignments(user_id, role_id, scope_department_id)
WHERE scope_department_id IS NOT NULL;
```

## Constraint Name Discovery Query

If the constraint name differs, use this query:

```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'fswm.user_role_assignments'::regclass
  AND contype = 'u';
```

---

# 4. Fix Faculty Workload View

## Issue

Cancelled assignments are counted in workload totals.

## Fix

```sql
CREATE OR REPLACE VIEW v_faculty_workload_by_version AS
SELECT
    sv.schedule_version_id,
    ftp.faculty_term_profile_id,
    fp.faculty_id,
    u.first_name,
    u.last_name,
    SUM(s.lecture_units + s.laboratory_units) AS assigned_units,
    SUM(s.lecture_hours + s.laboratory_hours) AS assigned_hours
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
```

---

# 5. Prevent Zero-Unit and Zero-Hour Subjects

## Issue

The schema allows subjects with zero lecture units and zero laboratory units.

## Fix

```sql
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS chk_subject_has_units;

ALTER TABLE subjects
ADD CONSTRAINT chk_subject_has_units
CHECK (lecture_units > 0 OR laboratory_units > 0);

ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS chk_subject_has_hours;

ALTER TABLE subjects
ADD CONSTRAINT chk_subject_has_hours
CHECK (lecture_hours > 0 OR laboratory_hours > 0);
```

---

# 6. Validate Schedule Revision Actions

## Recommended Fix

Use a lookup table instead of a free-text `revision_action` column.

```sql
CREATE TABLE IF NOT EXISTS revision_action_types (
    revision_action_type_id SMALLSERIAL PRIMARY KEY,
    revision_action_code VARCHAR(60) NOT NULL UNIQUE,
    revision_action_name VARCHAR(120) NOT NULL
);

INSERT INTO revision_action_types (revision_action_code, revision_action_name)
VALUES
('ASSIGNMENT_CREATED', 'Assignment Created'),
('ASSIGNMENT_UPDATED', 'Assignment Updated'),
('ASSIGNMENT_DELETED', 'Assignment Deleted'),
('MEETING_CREATED', 'Meeting Created'),
('MEETING_UPDATED', 'Meeting Updated'),
('MEETING_DELETED', 'Meeting Deleted'),
('STATUS_CHANGED', 'Status Changed'),
('MANUAL_OVERRIDE', 'Manual Override')
ON CONFLICT (revision_action_code) DO NOTHING;
```

## Migration Option A — Non-Destructive

Keep the existing text column and add a new FK column.

```sql
ALTER TABLE schedule_revision_history
ADD COLUMN IF NOT EXISTS revision_action_type_id SMALLINT
REFERENCES revision_action_types(revision_action_type_id) ON DELETE RESTRICT;
```

Then backfill:

```sql
UPDATE schedule_revision_history srh
SET revision_action_type_id = rat.revision_action_type_id
FROM revision_action_types rat
WHERE srh.revision_action = rat.revision_action_code
  AND srh.revision_action_type_id IS NULL;
```

After backfilling, enforce the new column:

```sql
ALTER TABLE schedule_revision_history
ALTER COLUMN revision_action_type_id SET NOT NULL;
```

## Migration Option B — Simpler Thesis Version

If you do not want the extra lookup table, add a `CHECK` constraint instead:

```sql
ALTER TABLE schedule_revision_history
DROP CONSTRAINT IF EXISTS chk_revision_action;

ALTER TABLE schedule_revision_history
ADD CONSTRAINT chk_revision_action
CHECK (
    revision_action IN (
        'ASSIGNMENT_CREATED',
        'ASSIGNMENT_UPDATED',
        'ASSIGNMENT_DELETED',
        'MEETING_CREATED',
        'MEETING_UPDATED',
        'MEETING_DELETED',
        'STATUS_CHANGED',
        'MANUAL_OVERRIDE'
    )
);
```

**Recommendation:** Use Option A for implementation. Use Option B if the panel only needs a simpler final logical design.

---

# 7. Split Room Requirement Mismatch Views

## Issue

The current mismatch view only detects room-type mismatches, not missing room features.

## Fix Part A — Rename Type View

```sql
ALTER VIEW IF EXISTS v_room_requirement_mismatches
RENAME TO v_room_type_requirement_mismatches;
```

If `ALTER VIEW IF EXISTS ... RENAME` is not accepted by your PostgreSQL version, use this fallback:

```sql
DROP VIEW IF EXISTS v_room_type_requirement_mismatches;

CREATE VIEW v_room_type_requirement_mismatches AS
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
    srr.room_type_id AS required_room_type_id,
    required_rt.room_type_code AS required_room_type_code,
    required_rt.room_type_name AS required_room_type_name
FROM schedule_meetings sm
JOIN schedule_assignments sa ON sa.schedule_assignment_id = sm.schedule_assignment_id
JOIN schedule_versions sv ON sv.schedule_version_id = sa.schedule_version_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects subj ON subj.subject_id = so.subject_id
JOIN rooms r ON r.room_id = sm.room_id
JOIN room_types rt ON rt.room_type_id = r.room_type_id
JOIN subject_room_requirements srr
    ON srr.subject_id = subj.subject_id
   AND srr.is_required = TRUE
   AND srr.room_type_id IS NOT NULL
JOIN room_types required_rt ON required_rt.room_type_id = srr.room_type_id
WHERE r.room_type_id <> srr.room_type_id
  AND NOT EXISTS (
      SELECT 1
      FROM subject_offering_room_requirements sorr
      WHERE sorr.subject_offering_id = so.subject_offering_id
        AND sorr.is_required = TRUE
        AND sorr.room_type_id IS NOT NULL
        AND sorr.room_type_id = r.room_type_id
  );
```

## Fix Part B — Add Feature Mismatch View

```sql
CREATE OR REPLACE VIEW v_room_feature_requirement_mismatches AS
SELECT
    sv.schedule_version_id,
    sa.schedule_assignment_id,
    sm.schedule_meeting_id,
    so.subject_offering_id,
    subj.subject_code,
    subj.subject_title,
    r.room_code,
    r.room_name,
    srr.room_feature_id AS required_feature_id,
    rf.room_feature_code AS required_feature_code,
    rf.room_feature_name AS required_feature_name
FROM schedule_meetings sm
JOIN schedule_assignments sa ON sa.schedule_assignment_id = sm.schedule_assignment_id
JOIN schedule_versions sv ON sv.schedule_version_id = sa.schedule_version_id
JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
JOIN subjects subj ON subj.subject_id = so.subject_id
JOIN rooms r ON r.room_id = sm.room_id
JOIN subject_room_requirements srr
    ON srr.subject_id = subj.subject_id
   AND srr.is_required = TRUE
   AND srr.room_feature_id IS NOT NULL
JOIN room_features rf ON rf.room_feature_id = srr.room_feature_id
WHERE NOT EXISTS (
    SELECT 1
    FROM room_feature_assignments rfa
    WHERE rfa.room_id = r.room_id
      AND rfa.room_feature_id = srr.room_feature_id
)
AND NOT EXISTS (
    SELECT 1
    FROM subject_offering_room_requirements sorr
    WHERE sorr.subject_offering_id = so.subject_offering_id
      AND sorr.is_required = TRUE
      AND sorr.room_feature_id IS NOT NULL
      AND sorr.room_feature_id = srr.room_feature_id
);
```

---

# 8. Sync Academic Term Lock Status

## Issue

`academic_terms.is_locked` and `academic_terms.term_status_id` can disagree.

## Fix

```sql
CREATE OR REPLACE FUNCTION sync_term_lock_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.term_status_id = (
        SELECT term_status_id
        FROM term_statuses
        WHERE term_status_code = 'LOCKED'
    ) THEN
        NEW.is_locked := TRUE;
        IF NEW.locked_at IS NULL THEN
            NEW.locked_at := now();
        END IF;
    ELSIF NEW.term_status_id = (
        SELECT term_status_id
        FROM term_statuses
        WHERE term_status_code = 'OPEN'
    ) THEN
        NEW.is_locked := FALSE;
        NEW.locked_by := NULL;
        NEW.locked_at := NULL;
    ELSIF NEW.term_status_id = (
        SELECT term_status_id
        FROM term_statuses
        WHERE term_status_code = 'ARCHIVED'
    ) THEN
        NEW.is_locked := TRUE;
        IF NEW.locked_at IS NULL THEN
            NEW.locked_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_term_lock_status ON academic_terms;

CREATE TRIGGER trg_sync_term_lock_status
BEFORE INSERT OR UPDATE OF term_status_id ON academic_terms
FOR EACH ROW
EXECUTE FUNCTION sync_term_lock_status();
```

## Design Note

`ARCHIVED` is treated as locked because archived terms should normally be read-only.

---

# 9. Validate Import Row Counts

## Issue

`successful_rows + failed_rows` can exceed `total_rows`.

## Fix

```sql
ALTER TABLE import_batches
DROP CONSTRAINT IF EXISTS chk_import_row_totals;

ALTER TABLE import_batches
ADD CONSTRAINT chk_import_row_totals
CHECK (
    total_rows IS NULL
    OR (
        total_rows >= 0
        AND COALESCE(successful_rows, 0) >= 0
        AND COALESCE(failed_rows, 0) >= 0
        AND COALESCE(successful_rows, 0) + COALESCE(failed_rows, 0) <= total_rows
    )
);
```

---

# 10. Prevent Duplicate Availability Submission Windows

## Issue

Multiple global or per-department availability windows can exist for the same academic term.

## Fix

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_availability_window_global
ON availability_submission_windows(academic_term_id)
WHERE department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_availability_window_dept
ON availability_submission_windows(academic_term_id, department_id)
WHERE department_id IS NOT NULL;
```

---

# 11. Add Virtual Room Distinction

## Issue

Nullable `building_id` can mean either “virtual room” or “missing building data.”

## Fix

```sql
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rooms
DROP CONSTRAINT IF EXISTS chk_room_building_required_unless_virtual;

ALTER TABLE rooms
ADD CONSTRAINT chk_room_building_required_unless_virtual
CHECK (
    is_virtual = TRUE
    OR building_id IS NOT NULL
);
```

## Deployment Note

If your existing physical rooms have `building_id IS NULL`, update them first before applying the check constraint.

Example:

```sql
-- Example only. Replace with your actual building_id.
-- UPDATE rooms SET building_id = '<RMC_BUILDING_UUID>' WHERE is_virtual = FALSE AND building_id IS NULL;
```

---

# 12. Link Faculty Acknowledgements to Schedule Release Logs

## Issue

The database records schedule releases and acknowledgements, but does not tie acknowledgement to the specific release event.

## Fix

```sql
ALTER TABLE faculty_schedule_acknowledgements
ADD COLUMN IF NOT EXISTS schedule_release_log_id UUID
REFERENCES schedule_release_logs(schedule_release_log_id) ON DELETE SET NULL;
```

## Optional Stricter Design

If you want each acknowledgement to always refer to a release log, make it `NOT NULL` after backfilling:

```sql
-- Run only after backfilling valid release log references.
-- ALTER TABLE faculty_schedule_acknowledgements
-- ALTER COLUMN schedule_release_log_id SET NOT NULL;
```

---

# 13. Final Verification Queries

## Check User Role Duplicates

```sql
SELECT user_id, role_id, COUNT(*)
FROM user_role_assignments
WHERE scope_department_id IS NULL
GROUP BY user_id, role_id
HAVING COUNT(*) > 1;
```

Expected result: **0 rows**

## Check Zero-Unit Subjects

```sql
SELECT subject_code, subject_title
FROM subjects
WHERE lecture_units = 0 AND laboratory_units = 0;
```

Expected result: **0 rows**

## Check Zero-Hour Subjects

```sql
SELECT subject_code, subject_title
FROM subjects
WHERE lecture_hours = 0 AND laboratory_hours = 0;
```

Expected result: **0 rows**

## Check Invalid Faculty Acknowledgements

```sql
SELECT *
FROM faculty_schedule_acknowledgements
WHERE acknowledged_at IS NOT NULL
  AND viewed_at IS NULL;
```

Expected result: **0 rows**

## Check Import Count Violations

```sql
SELECT *
FROM import_batches
WHERE total_rows IS NOT NULL
  AND COALESCE(successful_rows, 0) + COALESCE(failed_rows, 0) > total_rows;
```

Expected result: **0 rows**

## Check Room Feature Mismatches

```sql
SELECT *
FROM v_room_feature_requirement_mismatches;
```

Expected result: rows only when a scheduled room lacks a required feature.

---

# 14. Acceptance Checklist

| Test | Expected Result |
|---|---|
| Reuse an already-used unlock request | Rejected |
| Acknowledge schedule without viewing | Rejected |
| Duplicate global role assignment | Rejected |
| Cancelled assignment included in workload | Not counted |
| Subject with zero units | Rejected |
| Invalid revision action | Rejected or unmapped |
| Lab subject assigned to room without computer units | Appears in feature mismatch view |
| Set term status to `LOCKED` | `is_locked = TRUE` |
| Import successful + failed rows greater than total | Rejected |
| Duplicate availability window for same term and department | Rejected |
| Physical room without building | Rejected unless `is_virtual = TRUE` |
| Faculty acknowledgement linked to release | Stored through `schedule_release_log_id` |

---

# 15. Patch A Completion Criteria

Patch A is complete when:

1. All P0 critical schema bugs are fixed.
2. All P1 database integration warnings are either fixed or documented.
3. All verification queries return expected results.
4. No use-case feature is blocked by missing required setup records.
5. The database remains 3NF: source facts are stored once, derived totals remain in views, and lookups remain normalized.
