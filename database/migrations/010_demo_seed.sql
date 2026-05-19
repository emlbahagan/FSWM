SET search_path TO fswm, public;

-- Helper to get role ID by code
DO $$
DECLARE
  v_sysadmin_role_id UUID;
  v_registrar_role_id UUID;
  v_depthead_role_id UUID;
  v_faculty_role_id UUID;

  v_sysadmin_user_id UUID := '11111111-1111-1111-1111-111111111111';
  v_registrar_user_id UUID := '22222222-2222-2222-2222-222222222222';
  v_depthead_user_id UUID := '33333333-3333-3333-3333-333333333333';
  v_faculty1_user_id UUID := '44444444-4444-4444-4444-444444444444';
  v_faculty2_user_id UUID := '55555555-5555-5555-5555-555555555555';

  v_cs_dept_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_it_dept_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  
  v_term_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  -- "password" hashed properly using Next.js/bcrypt equivalent or dummy bypass (In our system we use a dummy hash from actions: scrypt:64:Bjl0FA7lM-B0UgEK2in65w:tTJl1czsuutxRW8zgShoApLUkJUtQKmTMXWd7HswGm4n3RNdnvrlSI_PChbKT0vidsm2KKEYOiIAh2Weeu5XZA)
  v_dummy_hash TEXT := 'scrypt:64:Bjl0FA7lM-B0UgEK2in65w:tTJl1czsuutxRW8zgShoApLUkJUtQKmTMXWd7HswGm4n3RNdnvrlSI_PChbKT0vidsm2KKEYOiIAh2Weeu5XZA';
BEGIN
  SELECT role_id INTO v_sysadmin_role_id FROM roles WHERE role_code = 'SYSTEM_ADMIN';
  SELECT role_id INTO v_registrar_role_id FROM roles WHERE role_code = 'REGISTRAR';
  SELECT role_id INTO v_depthead_role_id FROM roles WHERE role_code = 'DEPARTMENT_HEAD';
  SELECT role_id INTO v_faculty_role_id FROM roles WHERE role_code = 'FACULTY';

  -- Create Users
  INSERT INTO users (user_id, email, password_hash, first_name, last_name, is_active)
  VALUES 
    (v_sysadmin_user_id, 'admin@fswm.edu', v_dummy_hash, 'System', 'Admin', true),
    (v_registrar_user_id, 'registrar@fswm.edu', v_dummy_hash, 'Head', 'Registrar', true),
    (v_depthead_user_id, 'depthead@fswm.edu', v_dummy_hash, 'CS', 'Head', true),
    (v_faculty1_user_id, 'faculty1@fswm.edu', v_dummy_hash, 'John', 'Doe', true),
    (v_faculty2_user_id, 'faculty2@fswm.edu', v_dummy_hash, 'Jane', 'Smith', true)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create Departments
  INSERT INTO departments (department_id, department_code, department_name, is_active)
  VALUES 
    (v_cs_dept_id, 'CS', 'Computer Science', true),
    (v_it_dept_id, 'IT', 'Information Technology', true)
  ON CONFLICT (department_code) DO NOTHING;

  -- Assign Roles
  INSERT INTO user_role_assignments (user_id, role_id, scope_department_id)
  VALUES 
    (v_sysadmin_user_id, v_sysadmin_role_id, null),
    (v_registrar_user_id, v_registrar_role_id, null),
    (v_depthead_user_id, v_depthead_role_id, v_cs_dept_id),
    (v_faculty1_user_id, v_faculty_role_id, null),
    (v_faculty2_user_id, v_faculty_role_id, null)
  ON CONFLICT DO NOTHING;

  -- Create Faculty Profiles
  INSERT INTO faculty_profiles (faculty_id, employee_number, department_id, is_active)
  VALUES 
    (v_faculty1_user_id, 'EMP-001', v_cs_dept_id, true),
    (v_faculty2_user_id, 'EMP-002', v_cs_dept_id, true)
  ON CONFLICT DO NOTHING;

  -- Create Programs
  INSERT INTO programs (department_id, program_code, program_name, is_active)
  VALUES 
    (v_cs_dept_id, 'BSCS', 'Bachelor of Science in Computer Science', true),
    (v_it_dept_id, 'BSIT', 'Bachelor of Science in Information Technology', true)
  ON CONFLICT DO NOTHING;

  -- Create Term
  INSERT INTO academic_terms (academic_term_id, school_year, term_name, start_date, end_date, term_status_id, is_locked, is_active)
  VALUES 
    (v_term_id, '2026-2027', '1st Semester', '2026-08-01', '2026-12-15', (SELECT term_status_id FROM term_statuses WHERE term_status_code = 'OPEN'), false, true)
  ON CONFLICT DO NOTHING;

  -- Create Subjects
  INSERT INTO subjects (subject_code, subject_title, lecture_units, laboratory_units, lecture_hours, laboratory_hours, is_active)
  VALUES 
    ('CS101', 'Introduction to Computing', 3, 0, 3, 0, true),
    ('CS102', 'Programming 1', 2, 1, 2, 3, true)
  ON CONFLICT DO NOTHING;

  -- Create Buildings
  INSERT INTO buildings (building_code, building_name, is_active)
  VALUES 
    ('BLDG-A', 'Main Building', true)
  ON CONFLICT DO NOTHING;

  -- Create Rooms
  INSERT INTO rooms (building_id, room_type_id, room_code, room_name, capacity, is_virtual, is_active)
  VALUES 
    ((SELECT building_id FROM buildings WHERE building_code = 'BLDG-A'), (SELECT room_type_id FROM room_types WHERE room_type_code = 'LECTURE'), 'ROOM-101', 'Room 101', 40, false, true),
    ((SELECT building_id FROM buildings WHERE building_code = 'BLDG-A'), (SELECT room_type_id FROM room_types WHERE room_type_code = 'COMPUTER_LAB'), 'ROOM-7', 'Room 7 Com Lab', 30, false, true)
  ON CONFLICT DO NOTHING;

END $$;
