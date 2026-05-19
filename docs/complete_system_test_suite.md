# FSWM: Complete End-to-End System Test Suite & QA Manual

This document provides a highly granular, step-by-step Quality Assurance (QA) manual for validating every major module, permission boundary, and workflow rule in the Faculty Scheduling & Workload Management (FSWM) portal. 

---

## Pre-Test Setup
1. Ensure your database is active and has the migration applied:
   ```sql
   ALTER TABLE fswm.users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT FALSE;
   ```
2. Your primary starting point is the System Administrator account (e.g., `jemlbh123@gmail.com`).

---

## Phase 1: System Admin Setup & Compliance

### Test Case 1.1: Provisioning Roles & Scopes
* **Objective**: Verify that the SysAdmin can create users, assign roles, and successfully apply departmental scopes.
* **URL**: `/dashboard/users`

#### **Step-by-Step Instructions**:
1. Log in as **System Administrator** (`jemlbh123@gmail.com`).
2. Click the **"Add New User"** button (navigates to `/dashboard/users/new`).
3. Fill in the form with these exact inputs:
   * **First Name**: `Sarah`
   * **Last Name**: `Registrar`
   * **Email Address**: `sarah.reg@fswm.edu`
   * **Temporary Password**: `SecureTemp123!`
4. Click **"Create Account"**. 
5. In the User List, click on `Sarah Registrar` to open their details (`/dashboard/users/<userId>`).
6. Scroll to **"Role Assignments"**, select **Role**: `Registrar` from the dropdown, leave **Department Scope**: `Global (All Departments)` (empty), and click **"Assign Role"**.
7. Go back to `/dashboard/users/new` and add a second user:
   * **First Name**: `Arthur`
   * **Last Name**: `CS-Head`
   * **Email Address**: `arthur.head@fswm.edu`
   * **Temporary Password**: `SecureTemp123!`
8. In `Arthur CS-Head`'s details, select **Role**: `Department Head` and set **Department Scope** to `Computer Science` (ensure a CS department exists in Master Data). Click **"Assign Role"**.
9. Go to `/dashboard/users/new` and add a third user:
   * **First Name**: `John`
   * **Last Name**: `Faculty`
   * **Email Address**: `john.fac@fswm.edu`
   * **Temporary Password**: `SecureTemp123!`
10. In `John Faculty`'s details, select **Role**: `Faculty` and scope to `Computer Science`. Click **"Assign Role"**.

#### **Verification Checkpoints**:
- [ ] Verify that `audit_logs` has records with `action_code` = `USER_CREATED` for all three users.
- [ ] Verify that all three users show `force_password_reset` as `true` in the database.
- [ ] Verify that Arthur's role scope is restricted to the Computer Science department ID in `user_role_assignments`.

---

### Test Case 1.2: Force Password Reset Check
* **Objective**: Confirm that new users are forced to reset their passwords before accessing any resources.
* **URL**: `/login`

#### **Step-by-Step Instructions**:
1. Log out of the Admin panel.
2. On the `/login` page, enter **Email**: `john.fac@fswm.edu` and **Password**: `SecureTemp123!`. Click **"Sign In"**.
3. **Expected Behavior**: You must be blocked from reaching the dashboard and redirected immediately to `/change-password`.
4. Try typing `12345` and clicking **"Update Password"**.
   * *Expected Behavior*: Form blocks it and reports: *"Your password must be at least 8 characters long."*
5. Try typing `weakpassword` (no uppercase or numbers).
   * *Expected Behavior*: Form blocks it and reports: *"For security, your password must contain at least one uppercase letter, one lowercase letter, and one number."*
6. Enter a valid strong password: `MyNewSecurePassword2026!` in both fields and click **"Update Password & Sign In"**.

#### **Verification Checkpoints**:
- [ ] Verify that the user is redirected to `/dashboard` successfully.
- [ ] Verify that `force_password_reset` for John Faculty changes to `FALSE` in `users`.
- [ ] Verify that `audit_logs` has a record of `USER_PASSWORD_RESET_FORCE` for John's user ID.

---

### Test Case 1.3: Dynamic Privacy notices
* **Objective**: Ensure that dynamic privacy notices block dashboard access until accepted by the faculty member.
* **URL**: `/dashboard/privacy`

#### **Step-by-Step Instructions**:
1. Sign out of John Faculty. Log back in as **System Administrator** (`jemlbh123@gmail.com`).
2. Navigate to **Privacy Notices** (`/dashboard/privacy`).
3. Click **"Create Notice"** (`/dashboard/privacy/new`).
4. Fill in:
   * **Version Code**: `v1.0.0`
   * **Title**: `FSWM University Data Protection Notice`
   * **Content**: `We collect time availability, subject qualifications, and teaching loads to compile optimal schedules. All data is protected by salt-hashing and restricted database scopes.`
5. Click **"Publish Notice"**.
6. Sign out of Admin. Log in as **John Faculty** (`john.fac@fswm.edu`).
7. **Expected Behavior**: Immediately upon landing, you are redirected to the privacy acceptance screen. You cannot view any schedules or submit availability.
8. Read the policy details and click **"Accept & Continue"**.

#### **Verification Checkpoints**:
- [ ] Verify that `privacy_notice_acceptances` has a row linking `john.fac@fswm.edu` and `v1.0.0` notice.
- [ ] Verify that John is now allowed to browse the main dashboard pages.

---

## Phase 2: Academic Core Setup (Registrar)

### Test Case 2.1: Term Setup & Enabled Slots
* **Objective**: Establish the active academic year term, enable valid time slots, and define the availability submission window.
* **URL**: `/dashboard/terms`

#### **Step-by-Step Instructions**:
1. Log in as **Sarah Registrar** (`sarah.reg@fswm.edu`) using the strong password you reset on first login.
2. Go to **Term Setup** (`/dashboard/terms`).
3. Click **"New Term"**.
4. Fill in the form:
   * **School Year**: `2026-2027`
   * **Term Name**: `1st Semester`
   * **Start Date**: `2026-06-01`
   * **End Date**: `2026-10-30`
   * **Status**: `PREPARATION` (Default)
5. Click **"Create Term"**.
6. Go to **Time Slots Configuration** inside Master Data.
7. Toggle on the standard university time slots:
   * MWF 7:30 AM - 9:00 AM
   * MWF 9:00 AM - 10:30 AM
   * TTH 9:00 AM - 10:30 AM
   * TTH 1:30 PM - 3:00 PM
8. Navigate to **Availability Windows**. Set the submission window for the `2026-2027 1st Semester` term:
   * **Start Time**: Today
   * **End Time**: Tomorrow

#### **Verification Checkpoints**:
- [ ] Verify the term exists in `academic_terms` table.
- [ ] Verify selected time slots are marked active in `time_slots` lookup.
- [ ] Verify that the availability submission window registers successfully.

---

### Test Case 2.2: Room Creation & Room Blocks
* **Objective**: Configure classrooms and block specific rooms for maintenance periods.
* **URL**: `/dashboard/master-data/rooms` (or corresponding building path)

#### **Step-by-Step Instructions**:
1. Go to **Master Data > Rooms** (or Buildings).
2. Click **"Add Room"**.
3. Create:
   * **Room Name**: `CL-301` (Computer Lab, Capacity: 40)
   * **Room Name**: `Lec-402` (Lecture Hall, Capacity: 60)
4. Go to **Room Blocking** (`/dashboard/blocking`).
5. Create a Block:
   * **Room**: `CL-301`
   * **Day**: `Wednesday`
   * **Time Slot**: `9:00 AM - 10:30 AM`
   * **Reason**: `CS Club Laboratory Maintenance`
6. Click **"Save Block"**.

#### **Verification Checkpoints**:
- [ ] Verify rooms are inserted into `rooms` table.
- [ ] Verify the blocked slot is saved in `room_blocking_schedules`.

---

## Phase 3: Faculty Input & Approvals

### Test Case 3.1: Submitting Faculty Availability
* **Objective**: Collect preferred teaching windows from instructors.
* **URL**: `/dashboard/availability`

#### **Step-by-Step Instructions**:
1. Log in as **John Faculty** (`john.fac@fswm.edu`).
2. Navigate to **Availability** (`/dashboard/availability`).
3. On the interactive calendar grid, click to allocate:
   * **MWF 7:30 AM - 9:00 AM**: `Unavailable` (Red)
   * **MWF 9:00 AM - 10:30 AM**: `Preferred` (Green)
   * **TTH 9:00 AM - 10:30 AM**: `Available` (Light green)
4. Click **"Submit Availability"**.

#### **Verification Checkpoints**:
- [ ] Verify that John's entries are created in `faculty_availability`.
- [ ] Try logging in as John after the submission window deadline has passed; verify the submission grid is disabled and locked.

---

### Test Case 3.2: Specialization approvals
* **Objective**: Department head verifies that faculty members are certified to teach specific courses.
* **URL**: `/dashboard/faculty`

#### **Step-by-Step Instructions**:
1. Log in as **Arthur CS-Head** (`arthur.head@fswm.edu`).
2. Navigate to **Faculty Profiles** (`/dashboard/faculty`).
3. Click `John Faculty` to open their profile.
4. Under the **Specializations** section:
   * Choose **Subject**: `CS-101 (Introduction to Computer Science)` and click **"Add Specialization"**.
   * Choose **Subject**: `CS-202 (Database Systems)` and click **"Add Specialization"**.
5. Click **"Verify Specializations"**.

#### **Verification Checkpoints**:
- [ ] Verify that rows are entered in `faculty_specializations` linking John to `CS-101` and `CS-202`.
- [ ] Verify that `audit_logs` has record `FACULTY_SPECIALIZATION_VERIFIED`.

---

## Phase 4: Manual & Automatic Schedule Generation

### Test Case 4.1: Running the Auto-Solver Heuristics
* **Objective**: Generate a highly complex draft schedule automatically satisfying all operational capacity and specialty limits.
* **URL**: `/dashboard/schedules/edit`

#### **Step-by-Step Instructions**:
1. Log in as **Sarah Registrar** (`sarah.reg@fswm.edu`).
2. Navigate to **Schedule Editor** (`/dashboard/schedules/edit`).
3. Click **"Prepare New Draft"** for term `2026-2027 1st Semester`.
4. Click **"Run Automated Schedule Solver"**.
5. Set parameters:
   * **Minimize conflicts**: Enabled
   * **Respect instructor availabilities**: Enabled
6. Click **"Initiate Solver"**.
7. **Expected Behavior**: The solver should compute optimal arrangements. Review the generated assignments on the screen.

#### **Verification Checkpoints**:
- [ ] Verify assignments do not place any class in the Wednesday `9:00 AM - 10:30 AM` slot for room `CL-301` (complying with Test Case 2.2's room block).
- [ ] Verify John Faculty is scheduled *only* in MWF `9:00 AM - 10:30 AM` or TTH `9:00 AM - 10:30 AM` (complying with Test Case 3.1's availability).
- [ ] Verify John is assigned to teach either `CS-101` or `CS-202` (satisfying his specialization).

---

### Test Case 4.2: Conflict Guard & Overload Override Approval Flow
* **Objective**: Assert that standard workload policies block schedule completion until approved by department heads.
* **URL**: `/dashboard/schedules/edit`

#### **Step-by-Step Instructions**:
1. As **Sarah Registrar**, open the **Schedule Editor** for `2026-2027 1st Semester`.
2. Manually add assignments assigning `John Faculty` to:
   * `CS-101` (3 units)
   * `CS-202` (3 units)
   * `CS-303` (3 units)
   * `CS-404` (3 units)
   * `CS-505` (3 units)
   * `CS-606` (3 units)
   * `CS-707` (3 units) — Raising John's teaching load to 21 units (Limit is 18).
3. Click **"Save Changes"**.
4. **Expected Behavior**: The Conflict Guard runs database assertions, blocks save, and highlights a validation warning: `OVERLOAD_LIMIT_EXCEEDED (Max Load: 18, Attempted: 21)`.
5. Click **"Submit Overload Override Request"** on the warning card. Type comment: *"Urgent department assignment requirement due to staffing shortage."* and click submit.
6. Sign out of Registrar. Log in as **Arthur CS-Head** (`arthur.head@fswm.edu`).
7. Navigate to **Approvals > Overload Requests** (`/dashboard/approval`).
8. Select John Faculty's pending request. Click **"Approve Request"**, type decision comment: *"Approved for First Term only due to special lab assignment."*
9. Sign out of Arthur. Log in as **Sarah Registrar** (`sarah.reg@fswm.edu`).
10. Go back to **Schedule Editor** and click **"Save Changes"**.

#### **Verification Checkpoints**:
- [ ] Verify the schedule is now successfully saved with zero `OVERLOAD_LIMIT_EXCEEDED` warnings.
- [ ] Verify that `overload_override_requests` records the decision as `APPROVED`.
- [ ] Verify that `audit_logs` has record `OVERLOAD_OVERRIDE_APPROVED`.

---

## Phase 5: Approvals, Revisions, & Final Release

### Test Case 5.1: Department Review & Version Increments
* **Objective**: Ensure that edits to a pending schedule log historical increments and require department approval.
* **URL**: `/dashboard/schedules/edit`

#### **Step-by-Step Instructions**:
1. As **Sarah Registrar**, go to **Schedule Editor**.
2. Click **"Submit for Department Review"**. The schedule status transitions to `UNDER_REVIEW`.
3. Sign out of Registrar. Log in as **Arthur CS-Head** (`arthur.head@fswm.edu`).
4. Go to **Schedule Approvals** (`/dashboard/approval`).
5. Open the submitted draft. Change one slot assignment (e.g. move a lecture hall slot from MWF 7:30 AM to TTH 9:00 AM).
6. Click **"Save Revision & Approve"**.

#### **Verification Checkpoints**:
- [ ] Go to **Version History** on the schedule details; verify that Version `1` is saved under a negative index `backupVersionNum = -1001` (archived copy), and Version `2` is the active, approved version.
- [ ] Verify schedule status is set to `APPROVED`.
- [ ] Attempt to edit the schedule as `Sarah Registrar`.
  * *Expected Behavior*: All edit buttons, inputs, and drag-and-drop boxes must be completely disabled/hidden.

---

### Test Case 5.2: Lockouts & The Unlock Flow
* **Objective**: Lock editing of approved schedules and test unlock requests.
* **URL**: `/dashboard/unlocks`

#### **Step-by-Step Instructions**:
1. Log in as **Sarah Registrar** (`sarah.reg@fswm.edu`).
2. Go to your active terms dashboard and click **"Request Schedule Unlock"** for `2026-2027 1st Semester`.
3. Type reason: *"Change in room capacities requires minor time allocations adjustment"* and submit.
4. Log in as **System Administrator** (`jemlbh123@gmail.com`).
5. Go to **Unlock Requests** (`/dashboard/unlocks`).
6. Locate Sarah's pending request. Click **"Approve Unlock Request"**.
7. Log back in as **Sarah Registrar** (`sarah.reg@fswm.edu`).

#### **Verification Checkpoints**:
- [ ] Verify that schedule status in database changes back to `UNDER_REVISION` or `PREPARATION`.
- [ ] Verify that Sarah Registrar's editing capabilities on **Schedule Editor** are re-enabled.

---

### Test Case 5.3: Final release & Faculty Acknowledgment
* **Objective**: Transition status to RELEASED, open viewing, and verify acknowledgment.
* **URL**: `/dashboard/schedules/view`

#### **Step-by-Step Instructions**:
1. Once Arthur approves the revision, as **Sarah Registrar**, navigate to your active terms dashboard.
2. Click **"Release Final Schedule"**. The status changes to `RELEASED`.
3. Log in as **John Faculty** (`john.fac@fswm.edu`).
4. Navigate to **My Schedule** (`/dashboard/schedules/view`).
5. **Expected Behavior**: John must see a clean, modern grid displaying his exact assigned courses (`CS-101` and `CS-202`) with zero overlaps.
6. Click the green **"Acknowledge Assignments"** button at the top of the schedule.

#### **Verification Checkpoints**:
- [ ] Verify that a record has been added to `faculty_schedule_acknowledgements` with John's ID, the schedule ID, and the exact current timestamp.
- [ ] Verify that `audit_logs` has a record of `FACULTY_SCHEDULE_ACKNOWLEDGED`.
- [ ] Verify that the schedule is now fully locked for everyone, showing clear, non-editable read-only views for all users.

---

## Phase 6: System Audit Verification
* **Objective**: Validate the system's compliance audit trails.
* **URL**: `/dashboard/audit`

#### **Step-by-Step Instructions**:
1. Log in as **System Administrator** (`jemlbh123@gmail.com`).
2. Go to **Audit Logs** (`/dashboard/audit`).
3. Filter by **Module**: `USERS`, `AUTH`, and `USERS_ROLE`.

#### **Verification Checkpoints**:
- [ ] Verify that all user creations, role assignments, password force updates, and overload approvals are listed with correct timestamps, IP addresses, and User Agent details.
- [ ] Verify that old/new value snapshots are saved as JSON blocks in `audit_logs`.
