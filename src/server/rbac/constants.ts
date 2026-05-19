import "server-only";

export const RoleCode = {
  AdminPersonnel: "ADMIN_PERSONNEL",
  DepartmentHead: "DEPARTMENT_HEAD",
  Faculty: "FACULTY",
  Registrar: "REGISTRAR",
  SystemAdmin: "SYSTEM_ADMIN",
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const PermissionCode = {
  AuditView: "audit.view",
  AvailabilityManageWindow: "availability.manage_window",
  AvailabilitySubmitOwn: "availability.submit_own",
  FacultyManageProfiles: "faculty.manage_profiles",
  FacultyVerifySpecialization: "faculty.verify_specialization",
  MasterDataManage: "master_data.manage",
  OverloadDecide: "overload.decide",
  OverloadRequest: "overload.request",
  PrivacyManage: "privacy.manage",
  ReportsView: "reports.view",
  ScheduleAcknowledge: "schedule.acknowledge",
  ScheduleManageDraft: "schedule.manage_draft",
  ScheduleRelease: "schedule.release",
  ScheduleReview: "schedule.review",
  ScheduleSubmitReview: "schedule.submit_review",
  ScheduleViewOwn: "schedule.view_own",
  TermSetupManage: "term_setup.manage",
  UnlockDecide: "unlock.decide",
  UsersManage: "users.manage",
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

