import { queryRows } from "@/server/db";

export type FacultyConflict = {
  facultyTermProfileId: string;
  facultyId: string;
  firstName: string;
  lastName: string;
  termTimeSlotId: string;
  firstMeetingId: string;
  secondMeetingId: string;
};

export type RoomConflict = {
  roomId: string;
  roomCode: string;
  roomName: string;
  termTimeSlotId: string;
  firstMeetingId: string;
  secondMeetingId: string;
};

export type RoomTypeMismatch = {
  assignmentId: string;
  meetingId: string;
  offeringId: string;
  subjectCode: string;
  subjectTitle: string;
  roomCode: string;
  roomName: string;
  assignedRoomTypeName: string;
  requiredRoomTypeName: string;
};

export type RoomFeatureMismatch = {
  assignmentId: string;
  meetingId: string;
  offeringId: string;
  subjectCode: string;
  subjectTitle: string;
  roomCode: string;
  roomName: string;
  requiredFeatureName: string;
};

export type WorkloadOverage = {
  facultyTermProfileId: string;
  facultyId: string;
  firstName: string;
  lastName: string;
  assignedUnits: number;
  maxUnits: number;
  assignedHours: number;
  maxHours: number;
};

export type CapacityMismatch = {
  assignmentId: string;
  meetingId: string;
  offeringId: string;
  subjectCode: string;
  roomCode: string;
  capacity: number;
  expectedEnrollment: number;
};

export type UnresolvedAssignment = {
  assignmentId: string;
  offeringId: string;
  subjectCode: string;
  subjectTitle: string;
  sectionCode: string;
  statusCode: string;
};

export type ValidationResult = {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  targetType?: string;
  targetId?: string;
};

export type ValidationReport = {
  isValid: boolean;
  checkedAt: string;
  results: ValidationResult[];
  facultyConflicts: FacultyConflict[];
  roomConflicts: RoomConflict[];
  roomTypeMismatches: RoomTypeMismatch[];
  roomFeatureMismatches: RoomFeatureMismatch[];
  workloadExceeded: WorkloadOverage[];
  capacityMismatches: CapacityMismatch[];
  unresolvedAssignments: UnresolvedAssignment[];
};

export async function validateScheduleVersion(scheduleVersionId: string): Promise<ValidationReport> {
  // 1. Faculty Conflicts
  const facultyConflicts = await queryRows<FacultyConflict>(
    `
      SELECT 
        faculty_term_profile_id as "facultyTermProfileId",
        faculty_id as "facultyId",
        first_name as "firstName",
        last_name as "lastName",
        term_time_slot_id as "termTimeSlotId",
        first_schedule_meeting_id as "firstMeetingId",
        second_schedule_meeting_id as "secondMeetingId"
      FROM v_faculty_schedule_conflicts
      WHERE schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  // 2. Room Conflicts
  const roomConflicts = await queryRows<RoomConflict>(
    `
      SELECT 
        room_id as "roomId",
        room_code as "roomCode",
        room_name as "roomName",
        term_time_slot_id as "termTimeSlotId",
        first_schedule_meeting_id as "firstMeetingId",
        second_schedule_meeting_id as "secondMeetingId"
      FROM v_room_schedule_conflicts
      WHERE schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  // 3. Room Type Mismatches
  const roomTypeMismatches = await queryRows<RoomTypeMismatch>(
    `
      SELECT 
        schedule_assignment_id as "assignmentId",
        schedule_meeting_id as "meetingId",
        subject_offering_id as "offeringId",
        subject_code as "subjectCode",
        subject_title as "subjectTitle",
        room_code as "roomCode",
        room_name as "roomName",
        assigned_room_type_name as "assignedRoomTypeName",
        required_room_type_name as "requiredRoomTypeName"
      FROM v_room_type_requirement_mismatches
      WHERE schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  // 4. Room Feature Mismatches
  const roomFeatureMismatches = await queryRows<RoomFeatureMismatch>(
    `
      SELECT 
        schedule_assignment_id as "assignmentId",
        schedule_meeting_id as "meetingId",
        subject_offering_id as "offeringId",
        subject_code as "subjectCode",
        subject_title as "subjectTitle",
        room_code as "roomCode",
        room_name as "roomName",
        required_feature_name as "requiredFeatureName"
      FROM v_room_feature_requirement_mismatches
      WHERE schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  // 5. Workload Overages
  const workloadData = await queryRows<{
    facultyTermProfileId: string;
    facultyId: string;
    firstName: string;
    lastName: string;
    assignedUnits: number;
    assignedHours: number;
    maxUnits: number;
    maxHours: number;
  }>(
    `
      SELECT 
        vw.faculty_term_profile_id as "facultyTermProfileId",
        vw.faculty_id as "facultyId",
        vw.first_name as "firstName",
        vw.last_name as "lastName",
        vw.assigned_units::float as "assignedUnits",
        vw.assigned_hours::float as "assignedHours",
        ftp.max_units::float as "maxUnits",
        ftp.max_hours::float as "maxHours"
      FROM v_faculty_workload_by_version vw
      JOIN faculty_term_profiles ftp ON vw.faculty_term_profile_id = ftp.faculty_term_profile_id
      WHERE vw.schedule_version_id = $1
        AND (vw.assigned_units > ftp.max_units OR vw.assigned_hours > ftp.max_hours)
    `,
    [scheduleVersionId]
    );

  // 6. Capacity Mismatches
  const capacityMismatches = await queryRows<CapacityMismatch>(
    `
      SELECT 
        sa.schedule_assignment_id as "assignmentId",
        sm.schedule_meeting_id as "meetingId",
        so.subject_offering_id as "offeringId",
        subj.subject_code as "subjectCode",
        r.room_code as "roomCode",
        r.capacity as "capacity",
        so.expected_enrollment as "expectedEnrollment"
      FROM schedule_meetings sm
      JOIN schedule_assignments sa ON sa.schedule_assignment_id = sm.schedule_assignment_id
      JOIN subject_offerings so ON so.subject_offering_id = sa.subject_offering_id
      JOIN subjects subj ON subj.subject_id = so.subject_id
      JOIN rooms r ON r.room_id = sm.room_id
      WHERE sa.schedule_version_id = $1
        AND so.expected_enrollment > r.capacity
    `,
    [scheduleVersionId]
  );

  // 7. Unresolved Assignments
  const unresolvedAssignments = await queryRows<UnresolvedAssignment>(
    `
      SELECT 
        schedule_assignment_id as "assignmentId",
        subject_offering_id as "offeringId",
        subject_code as "subjectCode",
        subject_title as "subjectTitle",
        section_code as "sectionCode",
        assignment_status_code as "statusCode"
      FROM v_unresolved_assignments
      WHERE schedule_version_id = $1
    `,
    [scheduleVersionId]
  );

  const overloadRequests = await queryRows<{
    decisionStatus: string;
    facultyTermProfileId: string;
  }>(
    `
      SELECT DISTINCT ON (faculty_term_profile_id)
        faculty_term_profile_id as "facultyTermProfileId",
        decision_status as "decisionStatus"
      FROM overload_override_requests
      WHERE schedule_version_id = $1
      ORDER BY faculty_term_profile_id, requested_at DESC
    `,
    [scheduleVersionId]
  );

  const overloadStatusByProfile = new Map(
    overloadRequests.map((request) => [request.facultyTermProfileId, request.decisionStatus])
  );

  const results: ValidationResult[] = [];

  for (const conflict of facultyConflicts) {
    results.push({
      code: "FACULTY_DOUBLE_BOOKED",
      severity: "ERROR",
      message: `${conflict.firstName} ${conflict.lastName} has overlapping schedule meetings.`,
      targetType: "faculty_term_profile",
      targetId: conflict.facultyTermProfileId,
    });
  }

  for (const conflict of roomConflicts) {
    results.push({
      code: "ROOM_DOUBLE_BOOKED",
      severity: "ERROR",
      message: `Room ${conflict.roomCode} has overlapping schedule meetings.`,
      targetType: "room",
      targetId: conflict.roomId,
    });
  }

  for (const mismatch of roomTypeMismatches) {
    results.push({
      code: "ROOM_TYPE_MISMATCH",
      severity: "ERROR",
      message: `${mismatch.subjectCode} is assigned to ${mismatch.assignedRoomTypeName}, but requires ${mismatch.requiredRoomTypeName}.`,
      targetType: "schedule_meeting",
      targetId: mismatch.meetingId,
    });
  }

  for (const mismatch of roomFeatureMismatches) {
    results.push({
      code: "ROOM_FEATURE_MISSING",
      severity: "ERROR",
      message: `${mismatch.subjectCode} requires ${mismatch.requiredFeatureName}, but room ${mismatch.roomCode} does not provide it.`,
      targetType: "schedule_meeting",
      targetId: mismatch.meetingId,
    });
  }

  for (const overage of workloadData) {
    const decisionStatus = overloadStatusByProfile.get(overage.facultyTermProfileId);

    if (decisionStatus === "APPROVED") {
      results.push({
        code: "WORKLOAD_EXCEEDED",
        severity: "WARNING",
        message: `${overage.firstName} ${overage.lastName} exceeds workload limits with an approved overload override.`,
        targetType: "faculty_term_profile",
        targetId: overage.facultyTermProfileId,
      });
    } else if (decisionStatus === "PENDING") {
      results.push({
        code: "OVERLOAD_OVERRIDE_PENDING",
        severity: "ERROR",
        message: `${overage.firstName} ${overage.lastName} exceeds workload limits and has a pending overload override.`,
        targetType: "faculty_term_profile",
        targetId: overage.facultyTermProfileId,
      });
    } else if (decisionStatus === "REJECTED") {
      results.push({
        code: "OVERLOAD_OVERRIDE_REJECTED",
        severity: "ERROR",
        message: `${overage.firstName} ${overage.lastName} exceeds workload limits and the overload override was rejected.`,
        targetType: "faculty_term_profile",
        targetId: overage.facultyTermProfileId,
      });
    } else {
      results.push({
        code: "WORKLOAD_EXCEEDED",
        severity: "ERROR",
        message: `${overage.firstName} ${overage.lastName} exceeds workload limits without an approved overload override.`,
        targetType: "faculty_term_profile",
        targetId: overage.facultyTermProfileId,
      });
    }
  }

  for (const mismatch of capacityMismatches) {
    results.push({
      code: "ROOM_CAPACITY_EXCEEDED",
      severity: "ERROR",
      message: `${mismatch.subjectCode} expects ${mismatch.expectedEnrollment} students, but room ${mismatch.roomCode} holds ${mismatch.capacity}.`,
      targetType: "schedule_meeting",
      targetId: mismatch.meetingId,
    });
  }

  for (const assignment of unresolvedAssignments) {
    results.push({
      code: "UNRESOLVED_ASSIGNMENT",
      severity: "ERROR",
      message: `${assignment.subjectCode} ${assignment.sectionCode} has not been fully assigned.`,
      targetType: "schedule_assignment",
      targetId: assignment.assignmentId,
    });
  }

  const isValid = results.every((result) => result.severity !== "ERROR");

  return {
    isValid,
    checkedAt: new Date().toISOString(),
    results,
    facultyConflicts,
    roomConflicts,
    roomTypeMismatches,
    roomFeatureMismatches,
    workloadExceeded: workloadData,
    capacityMismatches,
    unresolvedAssignments,
  };
}
