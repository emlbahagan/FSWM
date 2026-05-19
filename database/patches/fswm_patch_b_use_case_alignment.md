# FSWM Patch B — Use-Case Alignment Patch

**System:** Faculty Scheduling and Workload Management System  
**Base document:** `faculty_scheduling_use_cases.md`  
**Purpose:** Align the use-case document with the fixed database schema and remove cross-file gaps.

---

## 1. Required Use-Case Additions

These additions should be merged into the existing use-case file.

---

# 1. System Administrator

## Add to Main Use Cases

Add the following after **Manage privacy notice support**:

1. Create and publish privacy notice
2. Update published privacy notice
3. View privacy notice acceptance records
4. Approve schedule unlock request
5. Reject schedule unlock request
6. Monitor schedule unlock request history

## Add to Situational Use Cases

1. Handle privacy notice update request
2. Handle user who has not accepted latest privacy notice
3. Handle expired schedule unlock request
4. Handle repeated schedule unlock request
5. Handle denied schedule unlock request appeal

## Documentation Note

The System Administrator manages privacy notice records and schedule-unlock authorization. The administrator does not normally create academic schedules, but can approve controlled access to locked or released schedule records when correction is justified.

---

# 2. Registrar / Academic Staff

## Add to Main Use Cases

Add the following before **Create manual schedule assignment**:

1. Configure enabled time slots for academic term
2. View enabled time slots for academic term
3. Configure availability submission window per term
4. Block room time slot for academic term
5. View room blocked time slots
6. Submit overload override request for Department Head approval
7. View draft generation run status
8. Request schedule unlock after final approval

## Add to Situational Use Cases

1. Handle missing enabled term time slots before availability submission
2. Handle missing enabled term time slots before schedule creation
3. Handle room blocked for selected day and time slot
4. Handle failed rule-based schedule generation
5. Handle pending schedule generation run
6. Handle expired availability submission window
7. Handle duplicate availability submission window
8. Handle rejected overload override request
9. Handle rejected schedule unlock request
10. Handle approved schedule correction after unlock approval

## Workflow Clarification

The Registrar prepares and releases the final schedule after Department Head approval. The Department Head approves or rejects schedules; the Registrar performs final release to faculty.

## Preconditions to Add

### For Create Section Record

- Academic term must exist.
- Department must exist.
- Program must exist.
- Program must belong to the selected department.

### For Create Manual Schedule Assignment

- Academic term must exist.
- Enabled term time slots must exist.
- Subject offering must exist.
- Section must exist.
- Room must exist and must be active.
- Faculty term profile must exist.
- Faculty specialization data must be encoded.
- Availability submission window must be completed or administratively closed.

### For Generate Rule-Based Draft Schedule

- Academic term must exist.
- Subject offerings must exist.
- Sections must exist.
- Faculty profiles and faculty term profiles must exist.
- Faculty availability must be submitted or administratively encoded.
- Enabled term time slots must exist.
- Rooms and room features must exist.
- Workload policies must exist.

---

# 3. Department Head / Academic Coordinator

## Add to Main Use Cases

Add the following after **Review subject-specialization match**:

1. Verify faculty specialization records
2. View pending specialization verification records
3. Review overload override request
4. Approve overload override request
5. Reject overload override request

## Add to Situational Use Cases

1. Handle specialization record requiring verification
2. Handle faculty assigned to subject with unverified specialization
3. Handle overload override request without sufficient reason
4. Handle schedule submitted while overload override is pending
5. Handle schedule requiring approval after unlocked correction

## Workflow Clarification

The Department Head verifies whether faculty specializations are acceptable for subject assignment review. Verification does not create the faculty specialization record; it confirms or rejects an encoded specialization.

---

# 4. Faculty Member

## Add to Main Use Cases

Add the following after **Log in to the system**:

1. View latest privacy notice
2. Accept privacy notice

Add the following after **View final approved schedule**:

3. Mark final schedule as viewed
4. Acknowledge final schedule release

## Move from Potential to Main/Situational

Move **Acknowledge final schedule release** from Potential Use Cases to either:

- Main Use Cases, if acknowledgement is required for every final release; or
- Situational Use Cases, if acknowledgement is only required when the institution enables the feature.

## Add to Situational Use Cases

1. Handle required privacy notice acceptance before dashboard access
2. Handle outdated privacy notice acceptance
3. Handle final schedule acknowledgement after release
4. Handle attempt to acknowledge schedule before viewing
5. Handle revised final schedule requiring re-acknowledgement

---

# 5. Administrative Personnel — Conditional Actor

## Add to Main Use Cases, if authorized

1. View room blocked time slots if authorized
2. Assist in preparing room blocked time records if authorized
3. View generated schedule reports if authorized
4. View system-generated notification history if authorized

## Add to Situational Use Cases

1. Handle restricted access to room blocking module
2. Handle restricted access to schedule unlock records
3. Handle restricted access to privacy notice acceptance records

---

# 6. Students — No Change

Students should remain indirect beneficiaries only in the current scope. Do not add student accounts to the current use-case diagram unless the thesis scope changes.

---

## 2. Use-Case Diagram Grouping Fix

The use-case document should not show all detailed use cases in one diagram. Use grouped use cases for the diagram and place details in use-case descriptions.

## Recommended Main Diagram Use Cases

1. Log in
2. Manage users and roles
3. Manage master data
4. Manage faculty profiles
5. Verify faculty specialization
6. Configure academic term setup
7. Configure enabled time slots
8. Configure availability submission window
9. Submit/update faculty availability
10. Configure workload policies
11. Create manual schedule
12. Generate draft schedule
13. Monitor schedule generation
14. Validate scheduling data
15. Detect scheduling conflicts
16. Compute workload
17. Request overload override
18. Review overload override
19. Record overload override decision
20. View unresolved assignments
21. Revise schedule
22. Track schedule versions
23. Review schedule
24. Approve/reject schedule
25. Request schedule unlock
26. Approve/reject schedule unlock
27. Release final approved schedule
28. View assigned schedule
29. Acknowledge final schedule release
30. Generate reports
31. Export records
32. View audit trail
33. Manage privacy notice
34. Accept privacy notice

---

## 3. Include/Extend Relationships

Use these relationships in Chapter 3.

| Parent Use Case | Included Use Cases |
|---|---|
| Configure academic term setup | Manage academic terms, configure enabled time slots, configure availability window |
| Manage master data | Manage departments, programs, subjects, sections, rooms, time slots |
| Manage faculty profiles | Encode specialization, encode employment type, encode designation |
| Validate scheduling data | Check faculty availability, check room availability, check specialization match, check valid time slots |
| Detect scheduling conflicts | Detect faculty overlap, detect room double-booking, detect unavailable faculty, detect invalid time slot, detect room requirement mismatch |
| Generate reports | Generate faculty schedule report, workload summary, room utilization, conflict report, revision history report |
| Review schedule | Review assignments, review workload, review conflicts, review unresolved assignments |
| Release final approved schedule | Notify faculty, create release log, require acknowledgement if enabled |
| Manage privacy notice | Create notice, publish notice, view acceptance records |

| Base Use Case | Extending Use Case | Condition |
|---|---|---|
| Create manual schedule | Request overload override | Assignment exceeds workload threshold |
| Review schedule | Reject schedule | Conflict, overload, or mismatch remains unresolved |
| Edit approved schedule | Request schedule unlock | Schedule is locked, approved, released, or archived |
| View final schedule | Acknowledge final schedule release | Final schedule is released to faculty |
| Generate draft schedule | Handle failed generation run | Generation status becomes FAILED |

---

## 4. System-Generated Events Note

Add this note to Chapter 3:

> Notifications are system-generated events triggered by major workflow changes such as schedule submission, schedule approval, schedule rejection, final schedule release, overload override decision, and availability deadline reminders. Actors receive or view these notifications, but they do not manually create each notification record unless the system provides an authorized announcement function.

---

## 5. Schedule Release Ownership Decision

Use this workflow:

1. Registrar prepares draft schedule.
2. Registrar submits schedule for Department Head review.
3. Department Head approves or rejects the schedule.
4. Registrar revises rejected schedules.
5. Department Head gives final approval.
6. Registrar releases the approved final schedule to faculty.
7. Faculty views and acknowledges the final schedule release.

This keeps approval authority and release operation separate.

---

## 6. Schedule Unlock Ownership Decision

Use this access rule:

| Action | Actor |
|---|---|
| Request schedule unlock | Registrar / Academic Staff |
| Review unlock request | System Administrator |
| Approve/reject unlock request | System Administrator |
| Edit unlocked approved schedule | Registrar / Academic Staff |
| Audit unlock use | System Administrator |

---

## 7. Overload Override Ownership Decision

Use this access rule:

| Action | Actor |
|---|---|
| Detect overload warning | Registrar / Academic Staff, Department Head |
| Submit overload override request | Registrar / Academic Staff |
| Review overload override request | Department Head |
| Approve/reject overload override request | Department Head |
| Record decision in audit trail | System-generated / Department Head action |

---

## 8. New Use-Case Descriptions

## UC: Configure Enabled Time Slots for Academic Term

| Field | Description |
|---|---|
| Primary actor | Registrar / Academic Staff |
| Goal | Enable valid institutional time slots for a selected academic term. |
| Preconditions | Academic term and time slot records exist. |
| Main flow | Registrar selects term, selects allowed time slots, saves configuration. |
| Postcondition | Faculty availability and schedule meetings can use only enabled term time slots. |
| Exceptions | Duplicate or missing time-slot setup is rejected. |

## UC: Block Room Time Slot for Academic Term

| Field | Description |
|---|---|
| Primary actor | Registrar / Academic Staff |
| Goal | Mark a room unavailable for a selected day/time/term. |
| Preconditions | Room, academic term, day, and time slot records exist. |
| Main flow | Registrar selects room, term, day, and time slot; enters reason; saves blocked time. |
| Postcondition | Scheduling validation prevents meetings from being assigned to that blocked slot. |
| Exceptions | Duplicate room block or invalid term time slot is rejected. |

## UC: Submit Overload Override Request

| Field | Description |
|---|---|
| Primary actor | Registrar / Academic Staff |
| Supporting actor | Department Head / Academic Coordinator |
| Goal | Request approval for a faculty assignment that exceeds workload threshold. |
| Preconditions | Workload policy exists; overload warning has been detected. |
| Main flow | Registrar records reason and submits override request. |
| Postcondition | Request is pending Department Head decision. |
| Exceptions | Missing reason or duplicate pending override is rejected. |

## UC: Verify Faculty Specialization Records

| Field | Description |
|---|---|
| Primary actor | Department Head / Academic Coordinator |
| Goal | Confirm that a faculty member is qualified for a specialization or teaching area. |
| Preconditions | Faculty specialization is encoded. |
| Main flow | Department Head reviews specialization record and marks it verified. |
| Postcondition | Verified specialization can support subject-specialization matching. |
| Exceptions | Incomplete faculty profile blocks verification. |

## UC: Accept Privacy Notice

| Field | Description |
|---|---|
| Primary actor | Faculty Member |
| Goal | Confirm acceptance of the latest published privacy notice. |
| Preconditions | A published privacy notice exists. |
| Main flow | Faculty logs in, views privacy notice, accepts notice. |
| Postcondition | Acceptance is stored with timestamp and notice version. |
| Exceptions | User cannot proceed to restricted modules until required notice is accepted. |

## UC: Acknowledge Final Schedule Release

| Field | Description |
|---|---|
| Primary actor | Faculty Member |
| Goal | Confirm that the faculty member has viewed the final released schedule. |
| Preconditions | Final schedule has been released and is visible to faculty. |
| Main flow | Faculty opens schedule, system records viewed timestamp, faculty acknowledges release. |
| Postcondition | Acknowledgement is stored and linked to the schedule release log. |
| Exceptions | Acknowledgement without viewing is rejected. |

---

## 9. Patch B Completion Criteria

Patch B is complete when:

1. Every enforced schema table has at least one actor-owned or system-generated use-case explanation.
2. `term_time_slots` and `room_blocked_times` are represented in Registrar setup use cases.
3. Privacy notice acceptance is represented for faculty.
4. Specialization verification is assigned to Department Head.
5. Overload override request submission is assigned to Registrar.
6. Final schedule acknowledgement is no longer only a future/potential feature.
7. Notifications are documented as system-generated events.
8. The diagram uses grouped use cases instead of showing all detailed use cases.
