import { withTransaction, transactionQuery } from "@/server/db";
import { recordAuditLog } from "@/server/auth";

type AutoSchedulePreferences = {
  prioritizeDept: boolean;
  maximizeRoomEfficiency: boolean;
};

type SolverOffering = {
  offeringId: string;
  assignmentId: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  lecUnits: number;
  labUnits: number;
  lecHours: number;
  labHours: number;
  expectedEnrollment: number;
  deptId: string;
  deptCode: string;
  requiredRoomTypeId: string | null;
  requiredRoomTypeCode: string | null;
  requiredFeatures: string[];
  requiredSpecializationCodes: string[];
};

type SolverFaculty = {
  profileId: string;
  facultyId: string;
  fullName: string;
  deptId: string;
  deptCode: string;
  maxUnits: number;
  maxHours: number;
  specializations: string[]; // verified codes
  availability: Set<string>; // term_time_slot_ids where available/preferred
};

type SolverRoom = {
  roomId: string;
  roomCode: string;
  roomTypeName: string;
  roomTypeCode: string;
  roomTypeId: string;
  capacity: number;
  features: string[];
  blockedSlots: Set<string>; // term_time_slot_ids
};

type SolverTimeSlot = {
  termTimeSlotId: string;
  dayOfWeekId: string;
  dayName: string;
  timeSlotId: string;
  startTime: string;
  endTime: string;
};

export type AutoScheduleResultSummary = {
  success: boolean;
  totalOfferings: number;
  scheduledOfferings: number;
  unresolvedOfferings: {
    subjectCode: string;
    subjectTitle: string;
    sectionCode: string;
    reason: string;
  }[];
  backupVersionId?: string;
};

export async function runAutoScheduler(
  scheduleVersionId: string,
  preferences: AutoSchedulePreferences,
  actorUserId: string
): Promise<AutoScheduleResultSummary> {
  return await withTransaction(async (client) => {
    // 1. Fetch Version details & status
    const version = await transactionQuery<{
      schedule_version_id: string;
      academic_term_id: string;
      version_number: number;
      schedule_status_code: string;
    }>(
      client,
      `
        SELECT sv.schedule_version_id, sv.academic_term_id, sv.version_number, ss.schedule_status_code
        FROM schedule_versions sv
        JOIN schedule_statuses ss ON sv.schedule_status_id = ss.schedule_status_id
        WHERE sv.schedule_version_id = $1
      `,
      [scheduleVersionId]
    );

    if (version.rowCount === 0 || !version.rows[0]) {
      throw new Error("Schedule version not found");
    }

    const ver = version.rows[0];
    if (!["DRAFT", "CORRECTION_OPEN"].includes(ver.schedule_status_code)) {
      throw new Error("Only draft or correction-open schedule versions can be auto-scheduled");
    }

    const academicTermId = ver.academic_term_id;

    // 2. Fetch Time Slots
    const timeSlotsRows = await transactionQuery<SolverTimeSlot>(
      client,
      `
        SELECT 
          tts.term_time_slot_id as "termTimeSlotId",
          tts.day_of_week_id as "dayOfWeekId",
          d.day_name as "dayName",
          tts.time_slot_id as "timeSlotId",
          ts.start_time::text as "startTime",
          ts.end_time::text as "endTime"
        FROM term_time_slots tts
        JOIN days_of_week d ON tts.day_of_week_id = d.day_of_week_id
        JOIN time_slots ts ON tts.time_slot_id = ts.time_slot_id
        WHERE tts.academic_term_id = $1 AND tts.is_enabled = true
        ORDER BY d.sort_order, ts.start_time
      `,
      [academicTermId]
    );
    const timeSlots = timeSlotsRows.rows;

    // 3. Fetch Rooms
    const roomsRows = await transactionQuery<{
      roomId: string;
      roomCode: string;
      roomTypeName: string;
      roomTypeCode: string;
      roomTypeId: string;
      capacity: number;
      rawFeatures: string;
    }>(
      client,
      `
        SELECT 
          r.room_id as "roomId",
          r.room_code as "roomCode",
          rt.room_type_name as "roomTypeName",
          rt.room_type_code as "roomTypeCode",
          rt.room_type_id as "roomTypeId",
          r.capacity as "capacity",
          COALESCE(string_agg(rf.room_feature_name, ','), '') as "rawFeatures"
        FROM rooms r
        JOIN room_types rt ON r.room_type_id = rt.room_type_id
        LEFT JOIN room_feature_assignments rfa ON r.room_id = rfa.room_id
        LEFT JOIN room_features rf ON rfa.room_feature_id = rf.room_feature_id
        WHERE r.is_active = true
        GROUP BY r.room_id, r.room_code, rt.room_type_name, rt.room_type_code, rt.room_type_id, r.capacity
      `
    );

    // Fetch Room Blocked Times
    const blockedTimesRows = await transactionQuery<{
      room_id: string;
      term_time_slot_id: string;
    }>(
      client,
      `
        SELECT rbt.room_id, tts.term_time_slot_id
        FROM room_blocked_times rbt
        JOIN term_time_slots tts ON rbt.academic_term_id = tts.academic_term_id 
          AND rbt.day_of_week_id = tts.day_of_week_id 
          AND rbt.time_slot_id = tts.time_slot_id
        WHERE rbt.academic_term_id = $1
      `,
      [academicTermId]
    );

    const blockedMap = new Map<string, Set<string>>();
    for (const bt of blockedTimesRows.rows) {
      if (!blockedMap.has(bt.room_id)) {
        blockedMap.set(bt.room_id, new Set());
      }
      blockedMap.get(bt.room_id)!.add(bt.term_time_slot_id);
    }

    const rooms: SolverRoom[] = roomsRows.rows.map((r) => ({
      roomId: r.roomId,
      roomCode: r.roomCode,
      roomTypeName: r.roomTypeName,
      roomTypeCode: r.roomTypeCode,
      roomTypeId: r.roomTypeId,
      capacity: r.capacity,
      features: r.rawFeatures ? r.rawFeatures.split(",") : [],
      blockedSlots: blockedMap.get(r.roomId) || new Set(),
    }));

    // 4. Fetch Faculty Profiles
    const facultyRows = await transactionQuery<{
      profileId: string;
      facultyId: string;
      fullName: string;
      deptId: string;
      deptCode: string;
      maxUnits: number;
      maxHours: number;
      rawSpecs: string;
    }>(
      client,
      `
        SELECT 
          ftp.faculty_term_profile_id as "profileId",
          fp.faculty_id as "facultyId",
          u.first_name || ' ' || u.last_name as "fullName",
          d.department_id as "deptId",
          d.department_code as "deptCode",
          ftp.max_units::float as "maxUnits",
          ftp.max_hours::float as "maxHours",
          COALESCE(
            (
              SELECT string_agg(fs.specialization_code, ',')
              FROM faculty_specializations fs
              JOIN specialization_statuses ss ON fs.specialization_status_id = ss.specialization_status_id
              WHERE fs.faculty_id = fp.faculty_id AND ss.specialization_status_code = 'VERIFIED'
            ),
            ''
          ) as "rawSpecs"
        FROM faculty_term_profiles ftp
        JOIN faculty_profiles fp ON ftp.faculty_id = fp.faculty_id
        JOIN users u ON fp.faculty_id = u.user_id
        JOIN departments d ON fp.department_id = d.department_id
        WHERE ftp.academic_term_id = $1 AND ftp.is_available_for_scheduling = true
      `,
      [academicTermId]
    );

    // Fetch Faculty Availability Slots
    const availabilityRows = await transactionQuery<{
      faculty_term_profile_id: string;
      term_time_slot_id: string;
    }>(
      client,
      `
        SELECT fa.faculty_term_profile_id, fa.term_time_slot_id
        FROM faculty_availability fa
        JOIN availability_statuses ast ON fa.availability_status_id = ast.availability_status_id
        WHERE ast.availability_status_code IN ('AVAILABLE', 'PREFERRED')
      `
    );

    const availMap = new Map<string, Set<string>>();
    for (const av of availabilityRows.rows) {
      if (!availMap.has(av.faculty_term_profile_id)) {
        availMap.set(av.faculty_term_profile_id, new Set());
      }
      availMap.get(av.faculty_term_profile_id)!.add(av.term_time_slot_id);
    }

    const faculty: SolverFaculty[] = facultyRows.rows.map((f) => ({
      profileId: f.profileId,
      facultyId: f.facultyId,
      fullName: f.fullName,
      deptId: f.deptId,
      deptCode: f.deptCode,
      maxUnits: f.maxUnits,
      maxHours: f.maxHours,
      specializations: f.rawSpecs ? f.rawSpecs.split(",") : [],
      availability: availMap.get(f.profileId) || new Set(),
    }));

    // 5. Fetch Offerings (Unresolved / Unscheduled)
    const offeringsRows = await transactionQuery<{
      offeringId: string;
      assignmentId: string;
      subjectId: string;
      subjectCode: string;
      subjectTitle: string;
      lecUnits: number;
      labUnits: number;
      lecHours: number;
      labHours: number;
      expectedEnrollment: number;
      deptId: string;
      deptCode: string;
      requiredRoomTypeId: string | null;
      requiredRoomTypeCode: string | null;
      rawFeatures: string;
      rawSpecs: string;
      sectionCode: string;
    }>(
      client,
      `
        SELECT 
          so.subject_offering_id as "offeringId",
          sa.schedule_assignment_id as "assignmentId",
          s.subject_id as "subjectId",
          s.subject_code as "subjectCode",
          s.subject_title as "subjectTitle",
          s.lecture_units::float as "lecUnits",
          s.laboratory_units::float as "labUnits",
          s.lecture_hours::float as "lecHours",
          s.laboratory_hours::float as "labHours",
          so.expected_enrollment as "expectedEnrollment",
          d.department_id as "deptId",
          d.department_code as "deptCode",
          sec.section_code as "sectionCode",
          COALESCE(
            (
              SELECT rt_sub.room_type_id
              FROM subject_offering_room_requirements sorr_sub
              JOIN room_types rt_sub ON sorr_sub.room_type_id = rt_sub.room_type_id
              WHERE sorr_sub.subject_offering_id = so.subject_offering_id AND sorr_sub.is_required = true
              LIMIT 1
            ),
            (
              SELECT rt_sub.room_type_id
              FROM subject_room_requirements srr_sub
              JOIN room_types rt_sub ON srr_sub.room_type_id = rt_sub.room_type_id
              WHERE srr_sub.subject_id = so.subject_id AND srr_sub.is_required = true
              LIMIT 1
            )
          ) as "requiredRoomTypeId",
          COALESCE(
            (
              SELECT rt_sub.room_type_code
              FROM subject_offering_room_requirements sorr_sub
              JOIN room_types rt_sub ON sorr_sub.room_type_id = rt_sub.room_type_id
              WHERE sorr_sub.subject_offering_id = so.subject_offering_id AND sorr_sub.is_required = true
              LIMIT 1
            ),
            (
              SELECT rt_sub.room_type_code
              FROM subject_room_requirements srr_sub
              JOIN room_types rt_sub ON srr_sub.room_type_id = rt_sub.room_type_id
              WHERE srr_sub.subject_id = so.subject_id AND srr_sub.is_required = true
              LIMIT 1
            )
          ) as "requiredRoomTypeCode",
          COALESCE(
            (
              SELECT string_agg(rf.room_feature_name, ',')
              FROM subject_offering_room_requirements sorr
              JOIN room_features rf ON sorr.room_feature_id = rf.room_feature_id
              WHERE sorr.subject_offering_id = so.subject_offering_id AND sorr.is_required = true
            ),
            (
              SELECT string_agg(rf.room_feature_name, ',')
              FROM subject_room_requirements srr
              JOIN room_features rf ON srr.room_feature_id = rf.room_feature_id
              WHERE srr.subject_id = so.subject_id AND srr.is_required = true
            ),
            ''
          ) as "rawFeatures",
          COALESCE(
            (
              SELECT string_agg(ssr.specialization_code, ',')
              FROM subject_specialization_requirements ssr
              WHERE ssr.subject_id = so.subject_id AND ssr.is_required = true
            ),
            ''
          ) as "rawSpecs"
        FROM subject_offerings so
        JOIN subjects s ON so.subject_id = s.subject_id
        JOIN sections sec ON so.section_id = sec.section_id
        JOIN departments d ON sec.department_id = d.department_id
        JOIN schedule_assignments sa ON so.subject_offering_id = sa.subject_offering_id AND sa.schedule_version_id = $1
        WHERE so.academic_term_id = $2
          AND sa.faculty_term_profile_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM schedule_meetings sm WHERE sm.schedule_assignment_id = sa.schedule_assignment_id
          )
      `,
      [scheduleVersionId, academicTermId]
    );

    const offerings: SolverOffering[] = offeringsRows.rows.map((o) => ({
      offeringId: o.offeringId,
      assignmentId: o.assignmentId,
      subjectId: o.subjectId,
      subjectCode: o.subjectCode,
      subjectTitle: o.subjectTitle,
      lecUnits: o.lecUnits,
      labUnits: o.labUnits,
      lecHours: o.lecHours,
      labHours: o.labHours,
      expectedEnrollment: o.expectedEnrollment,
      deptId: o.deptId,
      deptCode: o.deptCode,
      requiredRoomTypeId: o.requiredRoomTypeId,
      requiredRoomTypeCode: o.requiredRoomTypeCode,
      requiredFeatures: o.rawFeatures ? o.rawFeatures.split(",") : [],
      requiredSpecializationCodes: o.rawSpecs ? o.rawSpecs.split(",") : [],
    }));

    // Retrieve active assignments to initialize solver state (workload, occupied slots)
    const existingWorkloadsRows = await transactionQuery<{
      profileId: string;
      assignedUnits: number;
      assignedHours: number;
    }>(
      client,
      `
        SELECT 
          sa.faculty_term_profile_id as "profileId",
          COALESCE(SUM(s.lecture_units + s.laboratory_units), 0)::float as "assignedUnits",
          COALESCE(SUM(s.lecture_hours + s.laboratory_hours), 0)::float as "assignedHours"
        FROM schedule_assignments sa
        JOIN subject_offerings so ON sa.subject_offering_id = so.subject_offering_id
        JOIN subjects s ON so.subject_id = s.subject_id
        WHERE sa.schedule_version_id = $1 AND sa.faculty_term_profile_id IS NOT NULL
        GROUP BY sa.faculty_term_profile_id
      `,
      [scheduleVersionId]
    );

    const facultyWorkloadMap = new Map<string, { units: number; hours: number }>();
    for (const w of existingWorkloadsRows.rows) {
      facultyWorkloadMap.set(w.profileId, { units: w.assignedUnits, hours: w.assignedHours });
    }

    const occupiedFacultySlots = new Map<string, Set<string>>();
    const occupiedRoomSlots = new Map<string, Set<string>>();

    const existingMeetingsRows = await transactionQuery<{
      faculty_term_profile_id: string | null;
      room_id: string;
      term_time_slot_id: string;
    }>(
      client,
      `
        SELECT sa.faculty_term_profile_id, sm.room_id, sm.term_time_slot_id
        FROM schedule_meetings sm
        JOIN schedule_assignments sa ON sm.schedule_assignment_id = sa.schedule_assignment_id
        WHERE sa.schedule_version_id = $1
      `,
      [scheduleVersionId]
    );

    for (const m of existingMeetingsRows.rows) {
      if (m.faculty_term_profile_id) {
        if (!occupiedFacultySlots.has(m.faculty_term_profile_id)) {
          occupiedFacultySlots.set(m.faculty_term_profile_id, new Set());
        }
        occupiedFacultySlots.get(m.faculty_term_profile_id)!.add(m.term_time_slot_id);
      }

      if (!occupiedRoomSlots.has(m.room_id)) {
        occupiedRoomSlots.set(m.room_id, new Set());
      }
      occupiedRoomSlots.get(m.room_id)!.add(m.term_time_slot_id);
    }

    const unresolvedOfferings: AutoScheduleResultSummary["unresolvedOfferings"] = [];
    let scheduledOfferingsCount = 0;

    const assignedStatus = await transactionQuery<{ assignment_status_id: string }>(
      client,
      `SELECT assignment_status_id FROM assignment_statuses WHERE assignment_status_code = 'ASSIGNED'`
    );
    if (!assignedStatus.rows[0]) throw new Error("Missing ASSIGNED status lookup");
    const assignedStatusId = assignedStatus.rows[0].assignment_status_id;

    // 6. Greedy Heuristic Constraint Solver
    for (const off of offerings) {
      const requiredHours = off.lecHours + off.labHours;
      if (requiredHours <= 0) {
        unresolvedOfferings.push({
          subjectCode: off.subjectCode,
          subjectTitle: off.subjectTitle,
          sectionCode: offeringsRows.rows.find(row => row.offeringId === off.offeringId)?.sectionCode || "A",
          reason: "Subject has zero teaching hours configured.",
        });
        continue;
      }

      // Filter Faculty candidates matching specialization
      const candidateFaculty = faculty.filter((f) => {
        // Specialization requirement
        if (off.requiredSpecializationCodes.length > 0) {
          const hasSpec = off.requiredSpecializationCodes.some((code) => f.specializations.includes(code));
          if (!hasSpec) return false;
        }
        return true;
      });

      if (preferences.prioritizeDept) {
        // Sort faculty from the offering department first
        candidateFaculty.sort((a, b) => {
          const aDept = a.deptId === off.deptId ? 1 : 0;
          const bDept = b.deptId === off.deptId ? 1 : 0;
          return bDept - aDept;
        });
      }

      let successfullyScheduled = false;

      // Iterate through faculty candidates and search for matching free slots & rooms
      for (const facCandidate of candidateFaculty) {
        // Workload capacity check
        const currentWorkload = facultyWorkloadMap.get(facCandidate.profileId) || { units: 0, hours: 0 };
        const newUnits = currentWorkload.units + off.lecUnits + off.labUnits;
        const newHours = currentWorkload.hours + off.lecHours + off.labHours;

        if (newUnits > facCandidate.maxUnits || newHours > facCandidate.maxHours) {
          continue; // exceeds workload cap
        }

        // Filter Rooms matching type, features, capacity
        const candidateRooms = rooms.filter((r) => {
          // Room type match
          if (off.requiredRoomTypeCode && r.roomTypeCode !== off.requiredRoomTypeCode) {
            return false;
          }
          // Room capacity match expected enrollment
          if (r.capacity < off.expectedEnrollment) {
            return false;
          }
          // Features match
          if (off.requiredFeatures.length > 0) {
            const hasFeatures = off.requiredFeatures.every((feat) => r.features.includes(feat));
            if (!hasFeatures) return false;
          }
          return true;
        });

        if (preferences.maximizeRoomEfficiency) {
          // Sort rooms: prioritize smaller rooms that still fit the enrollment to maximize efficiency
          candidateRooms.sort((a, b) => a.capacity - b.capacity);
        }

        // Try to allocate H consecutive or near-consecutive slots where instructor and a room are free
        let chosenSlots: SolverTimeSlot[] = [];
        let chosenRoom: SolverRoom | null = null;

        for (const roomCandidate of candidateRooms) {
          const facultyBusy = occupiedFacultySlots.get(facCandidate.profileId) || new Set();
          const roomBusy = occupiedRoomSlots.get(roomCandidate.roomId) || new Set();
          const roomBlocked = roomCandidate.blockedSlots;

          // Find a day with enough free consecutive slots
          // Group time slots by day
          const slotsByDay = new Map<string, SolverTimeSlot[]>();
          for (const ts of timeSlots) {
            if (!slotsByDay.has(ts.dayName)) {
              slotsByDay.set(ts.dayName, []);
            }
            slotsByDay.get(ts.dayName)!.push(ts);
          }

          let foundSlots: SolverTimeSlot[] = [];

          for (const [, daySlots] of slotsByDay.entries()) {
            let consecutiveChain: SolverTimeSlot[] = [];

            for (const slot of daySlots) {
              const isFacultyAvailable = facCandidate.availability.has(slot.termTimeSlotId) && !facultyBusy.has(slot.termTimeSlotId);
              const isRoomAvailable = !roomBusy.has(slot.termTimeSlotId) && !roomBlocked.has(slot.termTimeSlotId);

              if (isFacultyAvailable && isRoomAvailable) {
                consecutiveChain.push(slot);
                if (consecutiveChain.length === requiredHours) {
                  foundSlots = consecutiveChain;
                  break;
                }
              } else {
                consecutiveChain = []; // break in consec chain
              }
            }

            if (foundSlots.length === requiredHours) {
              break;
            }
          }

          if (foundSlots.length === requiredHours) {
            chosenSlots = foundSlots;
            chosenRoom = roomCandidate;
            break; // found assignment!
          }
        }

        if (chosenRoom && chosenSlots.length === requiredHours) {
          // Perform Database Updates!
          // A. Assign Faculty to Offering Assignment
          await transactionQuery(
            client,
            `
              UPDATE schedule_assignments
              SET faculty_term_profile_id = $1, assignment_status_id = $2, updated_at = now()
              WHERE schedule_assignment_id = $3
            `,
            [facCandidate.profileId, assignedStatusId, off.assignmentId]
          );

          // B. Add Meetings
          const meetingType = off.labHours > 0 ? "LABORATORY" : "LECTURE";
          for (const slot of chosenSlots) {
            await transactionQuery(
              client,
              `
                INSERT INTO schedule_meetings (schedule_assignment_id, term_time_slot_id, room_id, meeting_type)
                VALUES ($1, $2, $3, $4)
              `,
              [off.assignmentId, slot.termTimeSlotId, chosenRoom.roomId, meetingType]
            );

            // Update in-memory busy slots
            if (!occupiedFacultySlots.has(facCandidate.profileId)) {
              occupiedFacultySlots.set(facCandidate.profileId, new Set());
            }
            occupiedFacultySlots.get(facCandidate.profileId)!.add(slot.termTimeSlotId);

            if (!occupiedRoomSlots.has(chosenRoom.roomId)) {
              occupiedRoomSlots.set(chosenRoom.roomId, new Set());
            }
            occupiedRoomSlots.get(chosenRoom.roomId)!.add(slot.termTimeSlotId);
          }

          // C. Add Revision History
          const actionType = await transactionQuery<{ revision_action_type_id: number }>(
            client,
            `SELECT revision_action_type_id FROM revision_action_types WHERE revision_action_code = 'ASSIGNMENT_UPDATED'`
          );
          if (actionType.rows[0]) {
            await transactionQuery(
              client,
              `
                INSERT INTO schedule_revision_history (schedule_version_id, schedule_assignment_id, revision_action_type_id, new_value_json, changed_by)
                VALUES ($1, $2, $3, $4, $5)
              `,
              [scheduleVersionId, off.assignmentId, actionType.rows[0].revision_action_type_id, JSON.stringify({ facultyTermProfileId: facCandidate.profileId, autoGenerated: true }), actorUserId]
            );
          }

          // Update tracked workloads
          facultyWorkloadMap.set(facCandidate.profileId, { units: newUnits, hours: newHours });

          scheduledOfferingsCount++;
          successfullyScheduled = true;
          break; // successfully assigned to this faculty, stop faculty candidate loop for this offering
        }
      }

      if (!successfullyScheduled) {
        let reason = "No available faculty specialized in this subject area.";
        if (candidateFaculty.length > 0) {
          reason = "No matching conflict-free time slots found where specialized faculty and suitable rooms were simultaneously available.";
        }
        unresolvedOfferings.push({
          subjectCode: off.subjectCode,
          subjectTitle: off.subjectTitle,
          sectionCode: offeringsRows.rows.find(row => row.offeringId === off.offeringId)?.sectionCode || "A",
          reason,
        });
      }
    }

    await recordAuditLog({
      actorUserId,
      actionCode: "SCHEDULE_AUTO_GENERATED",
      moduleCode: "SCHEDULING",
      targetTable: "schedule_versions",
      targetId: scheduleVersionId,
      newValueJson: { scheduledOfferingsCount, unresolvedCount: unresolvedOfferings.length, preferences },
    });

    return {
      success: true,
      totalOfferings: offerings.length,
      scheduledOfferings: scheduledOfferingsCount,
      unresolvedOfferings,
    };
  });
}
