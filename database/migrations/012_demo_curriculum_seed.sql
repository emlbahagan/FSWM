BEGIN;

SET search_path TO fswm, public;

DO $$
DECLARE
  v_faculty1_user_id UUID := '44444444-4444-4444-4444-444444444444';
  v_faculty2_user_id UUID := '55555555-5555-5555-5555-555555555555';
  v_cs_dept_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_term_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_program_id UUID;
  v_section_id UUID;
  v_cs101_id UUID;
  v_cs102_id UUID;
BEGIN
  -- 1. Seed Faculty Term Profiles
  INSERT INTO faculty_term_profiles (faculty_id, academic_term_id, max_units, max_hours, is_available_for_scheduling)
  VALUES 
    (v_faculty1_user_id, v_term_id, 24, 30, true),
    (v_faculty2_user_id, v_term_id, 24, 30, true)
  ON CONFLICT (faculty_id, academic_term_id) DO NOTHING;

  -- 2. Seed Term Time Slots for all days (Mon to Fri) and all time slots
  INSERT INTO term_time_slots (academic_term_id, day_of_week_id, time_slot_id, is_enabled)
  SELECT v_term_id, d.day_of_week_id, ts.time_slot_id, true
  FROM days_of_week d
  CROSS JOIN time_slots ts
  WHERE d.day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  ON CONFLICT (academic_term_id, day_of_week_id, time_slot_id) DO NOTHING;

  -- 3. Get Program ID and Seed Section
  SELECT program_id INTO v_program_id FROM programs WHERE program_code = 'BSCS' LIMIT 1;
  
  IF v_program_id IS NOT NULL THEN
    INSERT INTO sections (academic_term_id, department_id, program_id, section_code, year_level, is_active)
    VALUES (v_term_id, v_cs_dept_id, v_program_id, 'A', 1, true)
    ON CONFLICT (academic_term_id, program_id, section_code) DO NOTHING;
    
    SELECT section_id INTO v_section_id FROM sections WHERE academic_term_id = v_term_id AND program_id = v_program_id AND section_code = 'A' LIMIT 1;

    -- 4. Get Subject IDs and Seed Offerings
    SELECT subject_id INTO v_cs101_id FROM subjects WHERE subject_code = 'CS101' LIMIT 1;
    SELECT subject_id INTO v_cs102_id FROM subjects WHERE subject_code = 'CS102' LIMIT 1;

    IF v_section_id IS NOT NULL AND v_cs101_id IS NOT NULL THEN
      INSERT INTO subject_offerings (academic_term_id, section_id, subject_id, expected_enrollment, is_active)
      VALUES (v_term_id, v_section_id, v_cs101_id, 40, true)
      ON CONFLICT (academic_term_id, section_id, subject_id) DO NOTHING;
    END IF;

    IF v_section_id IS NOT NULL AND v_cs102_id IS NOT NULL THEN
      INSERT INTO subject_offerings (academic_term_id, section_id, subject_id, expected_enrollment, is_active)
      VALUES (v_term_id, v_section_id, v_cs102_id, 35, true)
      ON CONFLICT (academic_term_id, section_id, subject_id) DO NOTHING;
    END IF;
  END IF;
END $$;

COMMIT;
