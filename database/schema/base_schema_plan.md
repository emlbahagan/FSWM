# Base Schema Plan

Use `docs/codex_build_checklist.md` Section 5 as the canonical schema blueprint. SQL migrations must be written under `database/migrations/`.

## Initial Migration Groups

1. `001_enable_extensions.sql`
   - Enable `pgcrypto`.

2. `002_lookup_tables.sql`
   - Role, permission, status, room type, room feature, day, availability, assignment, specialization, revision action, and schedule lookup data.

3. `003_core_master_tables.sql`
   - Users, departments, programs, academic terms, subjects, requirements, buildings, rooms, time slots, and setup tables.

4. `004_faculty_and_availability.sql`
   - Faculty profiles, term profiles, specializations, availability windows, and faculty availability.

5. `005_schedule_core.sql`
   - Schedule versions, assignments, meetings, and revision history.

6. `006_review_release_unlock_overload.sql`
   - Review records, release logs, acknowledgements, overload requests, unlock requests, and correction session columns.

7. `007_privacy_notifications_audit_import.sql`
   - Privacy notices, acceptances, notifications, audit logs, import batches, and import rows.

8. `008_views_functions_triggers.sql`
   - Workload, conflict, mismatch, unresolved assignment views, editability functions, term lock trigger, and Patch A helper functions.

## Integration Rules

- Build the corrected schema immediately when starting from zero.
- Do not create the flawed pre-Patch A version.
- Keep derived workload and conflict values in views.
- Use partial unique indexes for nullable scoped uniqueness.
- Keep every workflow decision auditable.

## Source Status

The original `fswm_3nf_database_schema_v2_fixed.sql` is absent from the repository. The SQL migrations are reconstructed from the current checklist and both patch documents. Because this is a new schema baseline, Patch A fixes are integrated directly into the first implemented schema.

## Actor Ownership

| Group | Owner |
|---|---|
| Users, roles, privacy notices, unlock decisions | System Administrator |
| Academic structure, term setup, rooms, time slots, subject offerings, scheduling, final release | Registrar / Academic Staff |
| Specialization verification, overload decisions, schedule approval/rejection | Department Head / Academic Coordinator |
| Availability, released schedule viewing, final schedule acknowledgement | Faculty Member |
| Notifications | System-generated |
| Audits and validation views | System-generated from actor actions |

## Deferred App Logic

The migrations define schema-level constraints, views, functions, and triggers. Application workflows still need later server-side authorization and validation code before any UI module can mutate protected data.
