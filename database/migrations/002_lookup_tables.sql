BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code VARCHAR(60) NOT NULL UNIQUE,
    role_name VARCHAR(120) NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code VARCHAR(120) NOT NULL UNIQUE,
    permission_name VARCHAR(160) NOT NULL,
    permission_group VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS term_statuses (
    term_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_status_code VARCHAR(40) NOT NULL UNIQUE,
    term_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS room_types (
    room_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_code VARCHAR(60) NOT NULL UNIQUE,
    room_type_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS room_features (
    room_feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_feature_code VARCHAR(80) NOT NULL UNIQUE,
    room_feature_name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS days_of_week (
    day_of_week_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_code VARCHAR(10) NOT NULL UNIQUE,
    day_name VARCHAR(40) NOT NULL,
    sort_order SMALLINT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS employment_types (
    employment_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_type_code VARCHAR(60) NOT NULL UNIQUE,
    employment_type_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS designations (
    designation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation_code VARCHAR(60) NOT NULL UNIQUE,
    designation_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS specialization_statuses (
    specialization_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialization_status_code VARCHAR(40) NOT NULL UNIQUE,
    specialization_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_window_statuses (
    availability_window_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    availability_window_status_code VARCHAR(40) NOT NULL UNIQUE,
    availability_window_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_statuses (
    availability_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    availability_status_code VARCHAR(40) NOT NULL UNIQUE,
    availability_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_statuses (
    schedule_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_status_code VARCHAR(40) NOT NULL UNIQUE,
    schedule_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_statuses (
    assignment_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_status_code VARCHAR(40) NOT NULL UNIQUE,
    assignment_status_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS revision_action_types (
    revision_action_type_id SMALLSERIAL PRIMARY KEY,
    revision_action_code VARCHAR(60) NOT NULL UNIQUE,
    revision_action_name VARCHAR(120) NOT NULL
);

INSERT INTO roles (role_code, role_name)
VALUES
    ('SYSTEM_ADMIN', 'System Administrator'),
    ('REGISTRAR', 'Registrar / Academic Staff'),
    ('DEPARTMENT_HEAD', 'Department Head / Academic Coordinator'),
    ('FACULTY', 'Faculty Member'),
    ('ADMIN_PERSONNEL', 'Administrative Personnel')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO permissions (permission_code, permission_name, permission_group)
VALUES
    ('users.manage', 'Manage users and roles', 'administration'),
    ('privacy.manage', 'Manage privacy notices', 'administration'),
    ('unlock.decide', 'Approve or reject schedule unlock requests', 'administration'),
    ('master_data.manage', 'Manage master data', 'setup'),
    ('term_setup.manage', 'Manage academic term setup', 'setup'),
    ('availability.manage_window', 'Manage availability submission windows', 'availability'),
    ('availability.submit_own', 'Submit own availability', 'availability'),
    ('faculty.manage_profiles', 'Manage faculty profiles', 'faculty'),
    ('faculty.verify_specialization', 'Verify faculty specialization', 'faculty'),
    ('schedule.manage_draft', 'Create and revise draft schedules', 'scheduling'),
    ('schedule.submit_review', 'Submit schedules for review', 'scheduling'),
    ('schedule.review', 'Approve or reject submitted schedules', 'scheduling'),
    ('schedule.release', 'Release final approved schedules', 'scheduling'),
    ('schedule.view_own', 'View own released schedule', 'scheduling'),
    ('schedule.acknowledge', 'Acknowledge released schedule', 'scheduling'),
    ('overload.request', 'Submit overload override requests', 'scheduling'),
    ('overload.decide', 'Approve or reject overload override requests', 'scheduling'),
    ('reports.view', 'View generated reports', 'reports'),
    ('audit.view', 'View audit logs', 'administration')
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    permission_group = EXCLUDED.permission_group;

INSERT INTO term_statuses (term_status_code, term_status_name)
VALUES
    ('OPEN', 'Open'),
    ('LOCKED', 'Locked'),
    ('ARCHIVED', 'Archived')
ON CONFLICT (term_status_code) DO UPDATE
SET term_status_name = EXCLUDED.term_status_name;

INSERT INTO room_types (room_type_code, room_type_name)
VALUES
    ('LECTURE', 'Lecture Room'),
    ('COMPUTER_LAB', 'Computer Laboratory'),
    ('LABORATORY', 'Laboratory'),
    ('VIRTUAL', 'Virtual Room')
ON CONFLICT (room_type_code) DO UPDATE
SET room_type_name = EXCLUDED.room_type_name;

INSERT INTO room_features (room_feature_code, room_feature_name)
VALUES
    ('COMPUTER_UNITS', 'Computer Units'),
    ('PROJECTOR', 'Projector'),
    ('AIRCONDITIONED', 'Airconditioned'),
    ('LAB_EQUIPMENT', 'Laboratory Equipment'),
    ('INTERNET_ACCESS', 'Internet Access')
ON CONFLICT (room_feature_code) DO UPDATE
SET room_feature_name = EXCLUDED.room_feature_name;

INSERT INTO days_of_week (day_code, day_name, sort_order)
VALUES
    ('MON', 'Monday', 1),
    ('TUE', 'Tuesday', 2),
    ('WED', 'Wednesday', 3),
    ('THU', 'Thursday', 4),
    ('FRI', 'Friday', 5),
    ('SAT', 'Saturday', 6),
    ('SUN', 'Sunday', 7)
ON CONFLICT (day_code) DO UPDATE
SET day_name = EXCLUDED.day_name,
    sort_order = EXCLUDED.sort_order;

INSERT INTO employment_types (employment_type_code, employment_type_name)
VALUES
    ('FULL_TIME', 'Full-Time'),
    ('PART_TIME', 'Part-Time'),
    ('LECTURER', 'Lecturer')
ON CONFLICT (employment_type_code) DO UPDATE
SET employment_type_name = EXCLUDED.employment_type_name;

INSERT INTO designations (designation_code, designation_name)
VALUES
    ('FACULTY', 'Faculty'),
    ('PROGRAM_COORDINATOR', 'Program Coordinator'),
    ('DEPARTMENT_HEAD', 'Department Head')
ON CONFLICT (designation_code) DO UPDATE
SET designation_name = EXCLUDED.designation_name;

INSERT INTO specialization_statuses (specialization_status_code, specialization_status_name)
VALUES
    ('PENDING', 'Pending'),
    ('VERIFIED', 'Verified'),
    ('REJECTED', 'Rejected')
ON CONFLICT (specialization_status_code) DO UPDATE
SET specialization_status_name = EXCLUDED.specialization_status_name;

INSERT INTO availability_window_statuses (availability_window_status_code, availability_window_status_name)
VALUES
    ('DRAFT', 'Draft'),
    ('OPEN', 'Open'),
    ('CLOSED', 'Closed'),
    ('CANCELLED', 'Cancelled')
ON CONFLICT (availability_window_status_code) DO UPDATE
SET availability_window_status_name = EXCLUDED.availability_window_status_name;

INSERT INTO availability_statuses (availability_status_code, availability_status_name)
VALUES
    ('AVAILABLE', 'Available'),
    ('UNAVAILABLE', 'Unavailable'),
    ('PREFERRED', 'Preferred')
ON CONFLICT (availability_status_code) DO UPDATE
SET availability_status_name = EXCLUDED.availability_status_name;

INSERT INTO schedule_statuses (schedule_status_code, schedule_status_name)
VALUES
    ('DRAFT', 'Draft'),
    ('SUBMITTED', 'Submitted'),
    ('REJECTED', 'Rejected'),
    ('REVISED', 'Revised'),
    ('APPROVED', 'Approved'),
    ('RELEASED', 'Released'),
    ('ARCHIVED', 'Archived'),
    ('CORRECTION_OPEN', 'Correction Open'),
    ('CORRECTION_SUBMITTED', 'Correction Submitted')
ON CONFLICT (schedule_status_code) DO UPDATE
SET schedule_status_name = EXCLUDED.schedule_status_name;

INSERT INTO assignment_statuses (assignment_status_code, assignment_status_name)
VALUES
    ('ASSIGNED', 'Assigned'),
    ('REVISED', 'Revised'),
    ('CANCELLED', 'Cancelled'),
    ('UNRESOLVED', 'Unresolved')
ON CONFLICT (assignment_status_code) DO UPDATE
SET assignment_status_name = EXCLUDED.assignment_status_name;

INSERT INTO revision_action_types (revision_action_code, revision_action_name)
VALUES
    ('ASSIGNMENT_CREATED', 'Assignment Created'),
    ('ASSIGNMENT_UPDATED', 'Assignment Updated'),
    ('ASSIGNMENT_DELETED', 'Assignment Deleted'),
    ('MEETING_CREATED', 'Meeting Created'),
    ('MEETING_UPDATED', 'Meeting Updated'),
    ('MEETING_DELETED', 'Meeting Deleted'),
    ('STATUS_CHANGED', 'Status Changed'),
    ('MANUAL_OVERRIDE', 'Manual Override'),
    ('CORRECTION_SESSION_OPENED', 'Correction Session Opened'),
    ('CORRECTION_SESSION_SUBMITTED', 'Correction Session Submitted'),
    ('CORRECTION_SESSION_CLOSED', 'Correction Session Closed')
ON CONFLICT (revision_action_code) DO UPDATE
SET revision_action_name = EXCLUDED.revision_action_name;

COMMIT;

