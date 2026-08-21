/**
 * Route Mapper Utility
 * Uses API link field directly without any modifications
 */

/**
 * Convert API link to Next.js route
 * Link format: "students/search_student/" -> Route: "/students/search_student"
 * Uses link directly as-is - no underscore/hyphen replacement
 * 
 * @param link - The link field from API (e.g., "students/search_student/")
 * @returns The Next.js route path, or '#' for invalid links
 */
/**
 * Result module: legacy Laravel route names → Next.js routes.
 * Path-style links (e.g. "result/marks_entry") already map 1:1 because the
 * Result pages live at the legacy paths; this map covers route-name links.
 */
const RESULT_ROUTE_NAME_MAP: Record<string, string> = {
  'marks_entry.index': '/result/marks_entry',
  'co_scholastic_marks_entry.index': '/result/co_scholastic_marks_entry',
  'result-template.index': '/result/result-template',
  'student-result.index': '/result/student-result',
  'result_activity_marks.index': '/result/result_activity_marks',
  'result_activity_marks_v1.index': '/result/result_activity_marks_V1',
  'approve_mobile_result.index': '/result/approve_mobile_result',
  'upload_result.index': '/result/upload_result',
  'exam_master.index': '/result/exam_master',
  'exam_type_master.index': '/result/exam_master',
  'exam_creation.index': '/result/exam_creation',
  'grade_master.index': '/result/grade_master',
  'std_grd_maping.index': '/result/std_grd_maping',
  'result_master.index': '/result/result_master',
  'result_book_master.index': '/result/result_book_master',
  'result_remark_master.index': '/result/result_remark_master',
  'co_scholastic_master.index': '/result/co_scholastic_master',
  'working_day_master.index': '/result/working_day_master',
  'student_attendance_master.index': '/result/student_attendance_master',
  'result_skillset.index': '/result/result_skillset',
  'result_activity_master.index': '/result/result_activity_master',
  'show_result_report': '/result/result_report',
  'result/show_result_report': '/result/result_report',
  'marks_approval_report.index': '/result/marks_approval_report',
  'classwise_grade_report.index': '/result/classwise_grade_report',
  'student_result_remarks.index': '/result/student_result_remarks',
  'student-result-remarks.index': '/result/student_result_remarks',
  'consolidate_report.index': '/result/consolidate_report',
  'wrt_report.index': '/result/WRT_report',
  'wrt_progress_report.index': '/result/WRT_progress_report',
  'result/wrt_report': '/result/WRT_report',
  'result/wrt_progress_report': '/result/WRT_progress_report',
  'cbse_result.index': '/result/cbse_result',
  'cbse_result_t2.index': '/result/cbse_result_t2',
  'cbse_11_result.index': '/result/cbse_11_result',
  'cnse_11_result.index': '/result/cnse_11_result',
  'add_user': '/user/add_user',
  'add_user.index': '/user/add_user',
  'add_user.create': '/user/add_user',
  'proxy_report.index': '/proxy_report',
  'classteacherreport.index': '/classteacherReport',
  'classteacherreport.create': '/classteacherReport',
  'todays_proxy_report.index': '/todays_proxy_report',
  'user_log.index': '/user_log',
  'teacher_daily_report.index': '/teacher_daily_report',
  'std_div_map.index': '/academic_setup/standard_division_mapping',
  'school_setup/std_div_map': '/academic_setup/standard_division_mapping',
  'sub_std_map.index': '/academic_setup/subject_standard_mapping',
  'school_setup/sub_std_map': '/academic_setup/subject_standard_mapping',
  'period_master.index': '/academic_setup/create_periods',
  'school_setup/period_master': '/academic_setup/create_periods',
  'batch_master.index': '/academic_setup/create_batch',
  'school_setup/batch_master': '/academic_setup/create_batch',
  'division_capacity_master.index': '/academic_setup/division_capacity_mapping',
  'school_setup/division_capacity_master': '/academic_setup/division_capacity_mapping',
  'subject_master.index': '/academic_setup/create_subject',
  'school_setup/subject_master': '/academic_setup/create_subject',
  'map_student.index': '/Transportation/student_transport_mapping',
  'transportation/map_student': '/Transportation/student_transport_mapping',
  'add_driver.index': '/Transportation/add_driver_conductor',
  'transportation/add_driver': '/Transportation/add_driver_conductor',
  'add_vehicle.index': '/Transportation/add_vehicle',
  'transportation/add_vehicle': '/Transportation/add_vehicle',
  'add_route.index': '/Transportation/add_route',
  'transportation/add_route': '/Transportation/add_route',
  'add_stop.index': '/Transportation/add_stop',
  'transportation/add_stop': '/Transportation/add_stop',
  'transport_rate.index': '/Transportation/add_transport_rate',
  'transportation/transport_rate': '/Transportation/add_transport_rate',
  'map_route_bus.index': '/Transportation/map_route_bus',
  'transportation/map_route_bus': '/Transportation/map_route_bus',
  'map_route_stop.index': '/Transportation/map_route_stop',
  'transportation/map_route_stop': '/Transportation/map_route_stop',
  'transport_shift.index': '/Transportation/add_shift',
  'transportation/transport_shift': '/Transportation/add_shift',
  'van_wise_report.index': '/Transportation/van_wise_report',
  'transportation/van_wise_report': '/Transportation/van_wise_report',
  'van_wise_students_detail_report.index': '/Transportation/van_summery_report',
  'transportation/van_wise_students_detail_report': '/Transportation/van_summery_report',
};

/**
 * LMS → H5P content module: legacy Laravel route names (and the old
 * `/lms/h5p` library path) → Next.js routes under /h5p.
 */
const H5P_ROUTE_NAME_MAP: Record<string, string> = {
  'h5p.index': '/h5p/html_contents',
  'lms/h5p': '/h5p/html_contents',
  'html_contents.index': '/h5p/html_contents',
  'h5p/html_contents': '/h5p/html_contents',
  'scenario_based.index': '/h5p/scenario_based',
  'h5p_mcq.index': '/h5p/h5p_mcq',
  'h5p_interactive_video.index': '/h5p/h5p_interactive_video',
  'h5p_flashacard.index': '/h5p/h5p_flashacard',
  // PAL V4 H5P Model workspace — pedagogy and framework tagging, chapter
  // coverage, measured engagement and the xAPI pipeline. Reached from the
  // H5P content hub.
  'h5p_model.index': '/h5p/model',
  'h5p/model': '/h5p/model',
};

/**
 * LMS → Test → Exam: AI question-paper generator route names → Next route.
 * (The exam hub lives at /lms/exam; this is the AI DOK/Bloom generator.)
 */
const EXAM_ROUTE_NAME_MAP: Record<string, string> = {
  'generate_ai_questionpaper': '/exam/exam-creation',
  'generate_ai_questionpaper.index': '/exam/exam-creation',
  'lms/generate_ai_questionpaper': '/exam/exam-creation',
  'ai_questionpaper.ind ex': '/exam/exam-creation',
  'lmsexamwise_progress_report.index': '/exam/progress-report',
  'lms/lmsexamwise_progress_report': '/exam/progress-report',
  'examwise_progress_report.index': '/exam/progress-report',
  'online_exam.index': '/exam/online',
  'lms/online_exam': '/exam/online',
  // The LMS "Exam" menu item opens the exam hub (manual "Create exam" wizard +
  // the "AI generated exam" button live here).
  'question_paper.index': '/lms/exam',
  'lms/question_paper': '/lms/exam',
  'student_homework': '/lms/exam',
  '/student_homework': '/lms/exam',
};

/**
 * LMS → Reports: legacy Laravel route names (and path-style variants) for the
 * LMS report screens → their Next.js routes under /lms.
 * (Examwise Progress Report lives in EXAM_ROUTE_NAME_MAP → /exam/progress-report.)
 */
const LMS_REPORT_ROUTE_NAME_MAP: Record<string, string> = {
  'lmsactivitystream.index': '/lms/activity-stream',
  'lms/lmsactivitystream': '/lms/activity-stream',
  'lmsstudent_report.index': '/lms/student-analysis',
  'lms/lmsstudent_report': '/lms/student-analysis',
  'question_wise_report': '/lms/question-wise-report',
  'lms/questionreport': '/lms/question-wise-report',
  'questionreport': '/lms/question-wise-report',
  'lmsdashboard.index': '/lms/dashboard',
  'lms/lmsdashboard': '/lms/dashboard',
  'lmsdashboard_teacher': '/lms/dashboard',
  'teacherindex': '/lms/dashboard',
  // Message is a legacy placeholder (no backend data) — the page honestly
  // reflects that, but the menu link still needs to resolve rather than 404.
  'lmscommunication.index': '/lms/message',
  'lms/lmscommunication': '/lms/message',
};

/**
 * LMS → Entry modules: Teacher Diary (lesson-planning report), Book List,
 * Syllabus Plan and Leader Board. Legacy Laravel route names (from
 * tblmenumaster.link) + path-style variants → the Next.js pages under /lms.
 */
const LMS_ENTRY_ROUTE_NAME_MAP: Record<string, string> = {
  'lessonplanningreport.index': '/lms/teacher-diary',
  'lessonplanningreport': '/lms/teacher-diary',
  'book_list.index': '/lms/book-list',
  'frontdesk/book_list': '/lms/book-list',
  'lms_syllabus.index': '/lms/syllabus-plan',
  'lms/lms_syllabus': '/lms/syllabus-plan',
  'lmsleaderboard.index': '/lms/leader-board',
  'lms/lmsleaderboard': '/lms/leader-board',
  // MASTER modules
  'lb_master.index': '/lms/leader-board-master',
  'lms/lb_master': '/lms/leader-board-master',
  'lmsmapping.index': '/lms/global-mapping',
  'lms/lmsmapping': '/lms/global-mapping',
  // Existing tblmenumaster LMS rows whose legacy links previously resolved to a
  // dead path — point them at the migrated Next.js pages (PAL + Assignments).
  'pal.index': '/pal',
  'pal': '/pal',
  'lms/pal': '/pal',
  // PAL V4 Content Intelligence Layer (tblmenumaster group "PAL", below
  // Homework). Listed explicitly rather than relying on the generic PAL slug
  // fallback further down — that one normalises to the bare slug "pal" and
  // would not match "pal_content", so these would otherwise fall through.
  'pal_content.index': '/pal/content',
  'lms/pal-content': '/pal/content',
  'pal_content.review': '/pal/content/review',
  'lms/pal-content/review': '/pal/content/review',
  'pal_content.misconceptions': '/pal/content/misconceptions',
  'lms/pal-content/misconceptions': '/pal/content/misconceptions',
  // New PAL — a level-2 entry directly under LMS + PAL, alongside Homework.
  // It is a workspace rather than a menu group, so the menu row links straight
  // here and its sub-modules (Content Model first) are navigated inside the
  // workspace by NewPalNav.
  // Listed explicitly: the generic PAL slug fallback further down normalises to
  // the bare slug "pal" and would not match "new_pal".
  'new_pal.index': '/pal/new',
  'new_pal': '/pal/new',
  'lms/new-pal': '/pal/new',
  'new_pal.content_model': '/pal/new/content-model',
  'lms/new-pal/content-model': '/pal/new/content-model',
  // Administration — the second New PAL level-3 sub-module, registered by
  // 2026_08_14_160100_add_administration_submodule_menu. Follows the same
  // `new_pal.<sub_module>` link convention as Content Model above rather than
  // a separate `*.index` root, so the level-3 family stays consistent.
  'new_pal.administration': '/pal/new/administration',
  'lms/new-pal/administration': '/pal/new/administration',
  'lmsassignment.index': '/lms/lmsAssignment',
  'lms/lmsassignment': '/lms/lmsAssignment',
  'lmsassignment_submission.index': '/lms/lmsAssignment_submission',
  'lms/lmsassignment_submission': '/lms/lmsAssignment_submission',
  'lmsannotate_assignment.index': '/lms/lmsAnnotate_assignment',
  'lms/lmsannotate_assignment': '/lms/lmsAnnotate_assignment',
};

/**
 * Utility module: legacy Laravel route names (and their path-style variants)
 * → the Next.js pages under /Utility.
 *
 * "Breakoff rollover" has no dedicated Laravel route — it is the fee slice of
 * the rollover and bulk-update controllers — so it is matched on its menu slug.
 */
const UTILITY_ROUTE_NAME_MAP: Record<string, string> = {
  'student_transfer.index': '/Utility/student-transfer',
  'student/student_transfer': '/Utility/student-transfer',
  'rollover.index': '/Utility/rollover',
  'student/rollover': '/Utility/rollover',
  'breakoff_rollover.index': '/Utility/breakoff-rollover',
  'utility/breakoff-rollover': '/Utility/breakoff-rollover',
  'student_bulk_update.index': '/Utility/update-all-data',
  'student/student_bulk_update': '/Utility/update-all-data',
  'update_all_data.index': '/Utility/update-all-data',
  'custom-module.tables': '/Utility/custom-module',
  'custom_module.tables': '/Utility/custom-module',
  'custom-module/tables': '/Utility/custom-module',
  'transfer_student.index': '/Utility/transfer-student',
  'student/transfer_student': '/Utility/transfer-student',
};

/**
 * Admin services: legacy Laravel route names (and their path-style variants)
 * → the Next.js pages under /admin-services.
 */
const ADMIN_SERVICES_ROUTE_NAME_MAP: Record<string, string> = {
  'add_visitor_master.index': '/admin-services/add-visitor',
  'visitor_management/add_visitor_master': '/admin-services/add-visitor',
  'show_visitor_report': '/admin-services/visitor-report',
  'visitor_management/show_visitor_report': '/admin-services/visitor-report',
  'complaint.index': '/admin-services/complaint-management',
  'frontdesk/complaint': '/admin-services/complaint-management',
  'complaint_report_index': '/admin-services/complaint-report',
  'frontdesk/complaint_report': '/admin-services/complaint-report',
  'add_consent_master.index': '/admin-services/consent-master',
  'consent/add_consent_master': '/admin-services/consent-master',
  'delete_consent_master.index': '/admin-services/delete-consent-master',
  'consent/delete_consent_master': '/admin-services/delete-consent-master',
  'report_consent_master.index': '/admin-services/consent-report',
  'consent/report_consent_master': '/admin-services/consent-report',
  'frontdesk.index': '/admin-services/front-desk',
  'frontdesk/frontdesk': '/admin-services/front-desk',
  'frontdesk_report_index': '/admin-services/front-desk-report',
  'frontdesk/frontdesk_report_index': '/admin-services/front-desk-report',
  'pettycash.index': '/admin-services/petty-cash',
  'frontdesk/pettycash': '/admin-services/petty-cash',
  'pettycashmaster.index': '/admin-services/petty-cash-master',
  'frontdesk/pettycashmaster': '/admin-services/petty-cash-master',
  'pettycashreport.index': '/admin-services/petty-cash-report',
  'frontdesk/pettycashreport': '/admin-services/petty-cash-report',
  'add_ptm_attened_status.index': '/admin-services/ptm-attended-status',
  'ptm/add_ptm_attened_status': '/admin-services/ptm-attended-status',
  'add_ptm_time_slot_master.index': '/admin-services/ptm-time-slot-master',
  'ptm/add_ptm_time_slot_master': '/admin-services/ptm-time-slot-master',
  'ptm_report.index': '/admin-services/ptm-report',
  'ptm/ptm_report': '/admin-services/ptm-report',
};

const STUDENT_REPORT_ROUTE_NAME_MAP: Record<string, string> = {
  'student_report.index': '/student/report/student_report',
  'student/student_report': '/student/report/student_report',
  'show_student_report': '/student/report/student_report',
  'inactive_student_report.index': '/student/report/inactive_student_report',
  'student/inactive_student_report': '/student/report/inactive_student_report',
  'missing_document_report.index': '/student/report/missing_document_report',
  'student/missing_document_report': '/student/report/missing_document_report',
  'student_request_report.index': '/student/report/student_request_report',
  'student/student_request_report': '/student/report/student_request_report',
  'student_health_report': '/student/report/student_health_report',
  'student/student_health_report': '/student/report/student_health_report',
  'show_student_health_report': '/student/report/student_health_report',
  'dicipline_report.index': '/student/report/student_discipline_report',
  'front_desk/dicipline_report': '/student/report/student_discipline_report',
  'student_strength_report.index': '/student/report/student_strength_report',
  'student/student_strength_report': '/student/report/student_strength_report',
  'agewise.index': '/student/report/agewise_report',
  'student/agewise': '/student/report/agewise_report',
};

// Legacy ERP modules now served by the stateless migration API.
const MIGRATION_MODULE_ROUTES: Record<string, string> = {
  'lo_master.index': '/learning-outcome/lo-master',
  'result/lo_master': '/learning-outcome/lo-master',
  'indicator_mapping.index': '/learning-outcome/indicator-mapping',
  'result/indicator_mapping': '/learning-outcome/indicator-mapping',
  'lo_marks_report.index': '/learning-outcome/reports',
  'result/lo_marks_report': '/learning-outcome/reports',
  'bulk_upload_sheet.index': '/bazar/bulk-upload',
  'bazar/bulk_upload_sheet': '/bazar/bulk-upload',
  'bazar_report.index': '/bazar/bulk-upload-report',
  'bazar/bazar_report': '/bazar/bulk-upload-report',
  'subject_elective.index': '/academic_setup/subject-elective-mapping',
  'school_setup/subject_elective': '/academic_setup/subject-elective-mapping',
  'biomatrix.index': '/settings/biomatrix',
  'settings/biomatrix': '/settings/biomatrix',
  'dynamic_report.index': '/reports/dynamic-report-builder',
  'result/dynamic_report': '/reports/dynamic-report-builder',
  'student_marks_report.index': '/reports/students-marks',
  'result/student_marks_report': '/reports/students-marks',
  'user_log.index': '/user_log',
  'user_log': '/user_log',
  'find_broken_link': '/reports/broken-link-finder',
  'nomenclature.index': '/reports/nomenclature',
};

/**
 * HRIT Management: legacy Laravel route names (Attendance + Payroll, both
 * already registered in next_lms_erp's routes/hrms.php) plus invented
 * slug-style keys for Leave (a modern JSON-API sub-module with no legacy
 * Laravel route name, keyed the same `hrit.leave.<page>` way other
 * non-legacy modules in this file key their routes — see `new_pal.*` /
 * `pal_content.*` above) → the Next.js pages under /hrit.
 */
const HRIT_ROUTE_NAME_MAP: Record<string, string> = {
  // Attendance Management
  // 'hrms_attendance.index' / 'hrms_attendance_report.index' are NOT used as
  // keys here even though they're the legacy Laravel route names: those exact
  // strings are already claimed by unrelated, actively-visible legacy menu
  // rows (People & Competency > User Attendance, Reports > HRMS Report) — see
  // 2026_08_17_120000_fix_hrit_menu_link_collisions.php in next_lms_erp for
  // the full story. The new HRIT Management submenus use fresh `hrit.*` keys
  // instead so they can't collide with or silently redirect those.
  'hrit.attendance.tracking': '/hrit/attendance-management/attendance-tracking',
  'hrms/hrms-attendance': '/hrit/attendance-management/attendance-tracking',
  'hrit.attendance.reports': '/hrit/attendance-management/attendance-reports',
  'hrms/hrms-attendance-report': '/hrit/attendance-management/attendance-reports',
  // Leave management (modern JSON API, no legacy Laravel route name — see
  // header comment above for the `hrit.leave.*` key convention)
  'hrit.leave.dashboard': '/hrit/leave-management/leave-dashboard',
  'hrit.leave.requests': '/hrit/leave-management/leave-requests',
  'hrit.leave.reports': '/hrit/leave-management/leave-reports',
  'hrit.leave.configuration': '/hrit/leave-management/leave-configuration',
  // Payroll Management — same link-collision reasoning as Attendance above
  // for payroll_type.index / employee_salary_structure.index /
  // payroll_deduction.index / form16.index / hrms_salary_certificate.index
  // (all already claimed by People & Competency > Payroll's unrelated rows).
  // 'monthly_payroll_report.index' was NOT claimed by an existing row, so
  // that one HRIT submenu keeps its legacy-route-name key.
  'hrit.payroll.type': '/hrit/payroll-management/payroll-type',
  'hrit.payroll.salary-structure': '/hrit/payroll-management/salary-structure',
  'hrit.payroll.deduction': '/hrit/payroll-management/payroll-deduction',
  'hrit.payroll.form16': '/hrit/payroll-management/form-16',
  'hrit.payroll.salary-certificate': '/hrit/payroll-management/salary-certificate',
  'monthly_payroll_report.index': '/hrit/payroll-management/monthly-payroll-report',
  'monthly-payroll-report.index': '/hrit/payroll-management/monthly-payroll-report',
};

/**
 * Talent Management → Talent Dashboard, Recruitment, Onboarding, Performance
 * Reviews & Appraisals, Compensation, Mobility & Succession, Offboarding,
 * Administration under /talent-management. Migrated as-is from G2G
 * (g2gv0) — see app/talent-management/** and next_lms_erp's
 * database/migrations/2026_08_18_120000_add_talent_management_menu.php for
 * the matching backend menu-master rows, same pattern as HRIT_ROUTE_NAME_MAP.
 */
const TALENT_ROUTE_NAME_MAP: Record<string, string> = {
  'talent.dashboard': '/talent-management/talent-dashboard',
  'talent.recruitment': '/talent-management/recruitment',
  'talent.onboarding': '/talent-management/onboarding',
  'talent.performance_reviews': '/talent-management/performance-reviews-and-appraisals',
  'talent.compensation': '/talent-management/compensation',
  'talent.mobility_succession': '/talent-management/mobility-and-succession',
  'talent.offboarding': '/talent-management/offboarding',
  'talent.administration': '/talent-management/administration',
  // Competency screens (Employee Profiles, Certifications, Development &
  // Career Paths), ported as-is from G2G's `components/domain/competency/**`.
  // Backend menu-seed migration adds matching route_name rows using these
  // exact keys.
  'talent.employee_profiles': '/talent-management/employee-profiles',
  'talent.certifications': '/talent-management/certifications',
  'talent.development_career_paths': '/talent-management/development-and-career-paths',
};

/**
 * Organization Management → Employee Directory, Role and Permissions under
 * /organization-management. Migrated as-is from G2G (g2gv0) — see
 * app/organization-management/** — same pattern as TALENT_ROUTE_NAME_MAP.
 * Backend menu-master rows (module/menu labels, icons, sort order, parent_id)
 * for these two route_name keys still need to be inserted by the backend
 * team; this map is ready to resolve them once those rows exist.
 */
const ORGANIZATION_MANAGEMENT_ROUTE_NAME_MAP: Record<string, string> = {
  'org_mgmt.employee_directory': '/organization-management/employee-directory',
  'org_mgmt.role_permissions': '/organization-management/role-and-permissions',
};

/**
 * Task Management → Dashboard, My Tasks, Projects & Workstreams,
 * Dependencies & Workstreams, Calendar, Reports & Analysis, Administration
 * (Status Management, Permissions Matrix, Integration, Audit Logs) under
 * /task-management. Migrated as-is from G2G (g2gv0) — see
 * app/task-management/** — same pattern as TALENT_ROUTE_NAME_MAP.
 */
const TASK_MANAGEMENT_ROUTE_NAME_MAP: Record<string, string> = {
  'task_management.dashboard': '/task-management/dashboard',
  'task_management.my_tasks': '/task-management/my-tasks',
  'task_management.projects_workstreams': '/task-management/projects-workstreams',
  'task_management.dependencies_workstreams': '/task-management/dependencies-workstreams',
  'task_management.calendar': '/task-management/calendar',
  'task_management.reports_analysis': '/task-management/reports-analysis',
  'task_management.admin.status_management': '/task-management/administration/status-management',
  'task_management.admin.permissions_matrix': '/task-management/administration/permissions-matrix',
  'task_management.admin.integration': '/task-management/administration/integration',
  'task_management.admin.audit_logs': '/task-management/administration/audit-logs',
  'org_mgmt.compliance_library': '/organization-management/compliance-library',
  'org_mgmt.disciplinary_library': '/organization-management/disciplinary-library',
};

export function mapApiLinkToRoute(link: string | null | undefined): string {
  if (!link) return '#';

  let cleanLink = link.trim();
  const lowerLink = cleanLink.toLowerCase();

  // Check for void links or hash
  if (lowerLink === 'javascript:void(0);' || lowerLink === 'javascript:void(0)' || lowerLink === '#' || lowerLink === '') {
    return '#';
  }

  // Remove trailing slashes only
  cleanLink = cleanLink.replace(/\/+$/, '');

  const easyCommunicationRoutes: Record<string, string> = {
    'send_sms_parents.index': '/easy_com/send_sms_parents',
    'result/send_sms_parents': '/easy_com/send_sms_parents',
    'easy_com/send_sms_parents': '/easy_com/send_sms_parents',
    'send_sms_staff.index': '/easy_com/send_sms_staff',
    'result/send_sms_staff': '/easy_com/send_sms_staff',
    'easy_com/send_sms_staff': '/easy_com/send_sms_staff',
    'send_notification_parents.index': '/easy_com/send_notification_parents',
    'result/send_notification_parents': '/easy_com/send_notification_parents',
    'easy_com/send_notification_parents': '/easy_com/send_notification_parents',
    'send_email_parents.index': '/easy_com/send_email_parents',
    'result/send_email_parents': '/easy_com/send_email_parents',
    'easy_com/send_email_parents': '/easy_com/send_email_parents',
    'send_email_report.index': '/easy_com/email_report',
    'result/send_email_report': '/easy_com/email_report',
    'easy_com/send_email_report': '/easy_com/email_report',
    'manage_sms_api.index': '/easy_com/manage_sms_api',
    'result/manage_sms_api': '/easy_com/manage_sms_api',
    'easy_com/manage_sms_api': '/easy_com/manage_sms_api',
    'sms_api.index': '/easy_com/sms_api',
    'result/sms_api': '/easy_com/sms_api',
    'smtp_setting.index': '/easy_com/smtp',
    'settings/smtp_setting': '/easy_com/smtp',
    'whatsapp_user_details.index': '/easy_com/whatsapp_api',
    'whatsapp-user-details': '/easy_com/whatsapp_api',
    'whatsapp_send_message.create': '/easy_com/send_whatsapp_parents',
    'whatsapp-send-messages/create': '/easy_com/send_whatsapp_parents',
    'send_sms_report.index': '/easy_com/send_sms_report',
    'result/send_sms_report': '/easy_com/send_sms_report',
    'easy_com/send_sms_report': '/easy_com/send_sms_report',
    'register_parents_report.index': '/easy_com/register_parent_report',
    'result/register_parents_report': '/easy_com/register_parent_report',
    'easy_com/register_parents_report': '/easy_com/register_parent_report',
    'whatsapp_send_messages.generate_report': '/easy_com/whatsapp_report',
    'whatsapp-sent-generate-report': '/easy_com/whatsapp_report',
    'notification_report.index': '/easy_com/notification_report',
    'result/notification_report': '/easy_com/notification_report',
    'easy_com/notification_report': '/easy_com/notification_report',
  };
  const easyCommunicationRoute =
    easyCommunicationRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (easyCommunicationRoute) return easyCommunicationRoute;
  // LMS → PAL (Personalized Adaptive Learning). The backend menu link arrives
  // in several forms (pal, pal.index, lms/pal, /lms/pal, pal/index …); normalize
  // to a bare slug and match "pal" exactly so every variant reaches /pal while
  // words that merely contain "pal" (e.g. principal) are left alone.
  const palSlug = cleanLink
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/^lms\//, '')
    .replace(/\.(index|show)$/, '')
    .replace(/\/index$/, '');
  if (palSlug === 'pal') {
    return '/pal';
  }

  if (
    cleanLink.toLowerCase() === 'bulk_student_update.index' ||
    cleanLink.toLowerCase() === 'student/bulk_student_update'
  ) {
    return '/student/bulk_student_update';
  }

  if (
    cleanLink.toLowerCase() === 'student_infirmary.index' ||
    cleanLink.toLowerCase() === 'student/student_infirmary'
  ) {
    return '/student/student_infirmary';
  }

    const studentCareRoutes: Record<string, string> = {
    'student_vaccination.index': '/student/student_vaccination',
    'student/student_vaccination': '/student/student_vaccination',
    'student_hw.index': '/student/student_hw',
    'student/student_hw': '/student/student_hw',
    'student_health.index': '/student/student_health',
    'student/student_health': '/student/student_health',
    'dicipline.index': '/student/dicipline',
    'student/dicipline': '/student/dicipline',
    };
    if (studentCareRoutes[cleanLink.toLowerCase()]) {
      return studentCareRoutes[cleanLink.toLowerCase()];
    }

    const studentAdminRoutes: Record<string, string> = {
      'student_quota.index': '/student/student_quota',
      'student/student_quota': '/student/student_quota',
      'add_student.index': '/student/add_student',
      'student/add_student': '/student/add_student',
      'add_house.index': '/student/add_house',
      'student/add_house': '/student/add_house',
      'student_optional_subject.index': '/student/student_optional_subject',
      'student/student_optional_subject': '/student/student_optional_subject',
    };
    if (studentAdminRoutes[cleanLink.toLowerCase()]) return studentAdminRoutes[cleanLink.toLowerCase()];

  const examRoute = EXAM_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (examRoute) {
    return examRoute;
  }

  // LMS → Reports (Activity Stream, Student Analysis, Question Wise, Dashboard).
  const lmsReportRoute = LMS_REPORT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (lmsReportRoute) {
    return lmsReportRoute;
  }

  // LMS → Entry (Teacher Diary, Book List, Syllabus Plan, Leader Board).
  const lmsEntryRoute = LMS_ENTRY_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (lmsEntryRoute) {
    return lmsEntryRoute;
  }

  const resultRoute = RESULT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (resultRoute) {
    return resultRoute;
  }

  // LMS → H5P content: legacy Laravel route-name / path links → Next routes.
  const h5pRoute = H5P_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (h5pRoute) {
    return h5pRoute;
  }

  // Utility → year-end / low-code maintenance pages under /Utility.
  const utilityRoute = UTILITY_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (utilityRoute) {
    return utilityRoute;
  }

  // Admin services → front-office desks under /admin-services.
  const adminServicesRoute = ADMIN_SERVICES_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (adminServicesRoute) {
    return adminServicesRoute;
  }

  const studentReportRoute = STUDENT_REPORT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (studentReportRoute) {
    return studentReportRoute;
  }

  const migrationRoute = MIGRATION_MODULE_ROUTES[cleanLink.toLowerCase()];
  if (migrationRoute) return migrationRoute;

  // HRIT Management → Attendance, Leave, Payroll under /hrit.
  const hritRoute = HRIT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (hritRoute) {
    return hritRoute;
  }

  // Talent Management → Dashboard, Recruitment, Onboarding, Performance,
  // Compensation, Mobility & Succession, Offboarding, Administration.
  const talentRoute = TALENT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (talentRoute) {
    return talentRoute;
  }

  // Organization Management → Employee Directory, Role and Permissions.
  const organizationManagementRoute = ORGANIZATION_MANAGEMENT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (organizationManagementRoute) {
    return organizationManagementRoute;
  }

  // Task Management → Dashboard, My Tasks, Projects & Workstreams,
  // Dependencies & Workstreams, Calendar, Reports & Analysis, Administration.
  const taskManagementRoute = TASK_MANAGEMENT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (taskManagementRoute) {
    return taskManagementRoute;
  }

  if (cleanLink.toLowerCase() === 'fees_config_master.index') {
    return '/fees/master/fees-config-master';
  }

  if (cleanLink.toLowerCase() === 'fees_title.index') {
    return '/fees/master/new-fees-title-master';
  }

  if (cleanLink.toLowerCase() === 'fees_receipt_book_master.index') {
    return '/fees/master/fees-receipt-book-master';
  }

  if (cleanLink.toLowerCase() === 'fees_breackoff.index') {
    return '/fees/master/fees-breakoff';
  }

  const inwardOutwardRoutes: Record<string, string> = {
    'add_inward.index': '/inward_outward/add_inward',
    'inward_outward/add_inward': '/inward_outward/add_inward',
    'add_outward.index': '/inward_outward/add_outward',
    'inward_outward/add_outward': '/inward_outward/add_outward',
    'add_place_master.index': '/inward_outward/add_place_master',
    'inward_outward/add_place_master': '/inward_outward/add_place_master',
    'add_physical_file_location.index': '/inward_outward/add_physical_file_location',
    'inward_outward/add_physical_file_location': '/inward_outward/add_physical_file_location',
    'show_inward_report.index': '/inward_outward/show_inward_report',
    'inward_outward/show_inward_report': '/inward_outward/show_inward_report',
    'show_outward_report.index': '/inward_outward/show_outward_report',
    'inward_outward/show_outward_report': '/inward_outward/show_outward_report',
  };
  const inwardOutwardRoute = inwardOutwardRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (inwardOutwardRoute) return inwardOutwardRoute;

  const sqaaRoutes: Record<string, string> = {
    'sqaa_master.index': '/sqaa_master',
    'sqaa_master': '/sqaa_master',
    'sqaa_document_report.index': '/sqaa_document_report',
    'sqaa_document_report': '/sqaa_document_report',
  };
  const sqaaRoute = sqaaRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (sqaaRoute) return sqaaRoute;

  const frontDeskRoutes: Record<string, string> = {
    'create-timetable.index': '/front_desk/create-timetable',
    'front_desk/create-timetable': '/front_desk/create-timetable',
    'timetable.index': '/front_desk/create-timetable',
    'photo_video_gallary.index': '/front_desk/photo_video_gallary',
    'front_desk/photo_video_gallary': '/front_desk/photo_video_gallary',
    'api/front-desk/photo-video-gallery': '/front_desk/photo_video_gallary',
    'calendar.index': '/front_desk/calendar',
    'calendar/calendar': '/front_desk/calendar',
    'circular.index': '/front_desk/circular',
    'front_desk/circular': '/front_desk/circular',
    'parent_communication.index': '/front_desk/parent_communication',
    'front_desk/parent_communication': '/front_desk/parent_communication',
    'leave_application.index': '/front_desk/leave_application',
    'front_desk/leave_application': '/front_desk/leave_application',
    'exam_schedule.index': '/front_desk/exam_schedule',
    'front_desk/exam_schedule': '/front_desk/exam_schedule',
    'classwisetimetable.index': '/front_desk/classwisetimetable',
    'school_setup/classwisetimetable': '/front_desk/classwisetimetable',
    'facultywisetimetable.index': '/front_desk/facultywisetimetable',
    'school_setup/facultywisetimetable': '/front_desk/facultywisetimetable',
    'circular.report.index': '/front_desk/circular/report',
    'front_desk/circular/report': '/front_desk/circular/report',
  };
  const frontDeskRoute =
    frontDeskRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (frontDeskRoute) return frontDeskRoute;

  const careerCounsellingRoutes: Record<string, string> = {
    'career_counselling.index': '/career-counselling',
    'career-counselling.index': '/career-counselling',
    'career_counselling': '/career-counselling',
    'career-counselling': '/career-counselling',
    'career_counselling/plan': '/career-counselling',
    'career_counselling/education': '/career-counselling?section=explore',
    'career_counselling/explore': '/career-counselling?section=explore',
    'career_counselling/knowing-yourself': '/career-counselling?section=assessment',
    'career_counselling/interest-profile': '/career-counselling?section=assessment',
    'career_counselling/college': '/career-counselling?section=colleges',
    'career_counselling/courses': '/career-counselling?section=courses',
    'career_counselling/profile': '/career-counselling?section=employers',
    'career_counselling/expert-advice': '/career-counselling?section=experts',
    'career_counselling/explore-sectors': '/career-counselling?section=sectors',
    'career_counselling/match-profile': '/career-counselling?section=match',
    'knowing-yourself': '/career-counselling?section=assessment',
    'match-profile': '/career-counselling?section=match',
    'expert-advice': '/career-counselling?section=experts',
    'explore-sectors': '/career-counselling?section=sectors',
  };
  const careerCounsellingRoute =
    careerCounsellingRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (careerCounsellingRoute) return careerCounsellingRoute;

  if (cleanLink.toLowerCase() === 'other_fee_map.index') {
    return '/fees/master/additional-fees-mapping';
  }

  if (cleanLink.toLowerCase() === 'other_fees_title.index') {
    return '/fees/master/other-fees-title';
  }

  if (
    cleanLink.toLowerCase() === 'exam_master.index' ||
    cleanLink.toLowerCase() === 'result/exam_master' ||
    cleanLink.toLowerCase() === 'result/exam_master/index'
  ) {
    return '/result/master/exam-master';
  }

  if (
    cleanLink.toLowerCase() === 'marks_entry.index' ||
    cleanLink.toLowerCase() === 'result/marks_entry' ||
    cleanLink.toLowerCase() === 'result/marks_entry/index'
  ) {
    return '/exam/marks-entry';
  }

  // Result module (see app/result) — maps both `result/{resource}` links
  // and `{resource}.index` route-name links from the menu API.
  const resultRoutes: Record<string, string> = {
    // Entry
    'result/co_scholastic_marks_entry': '/result/co-scholastic-marks',
    'co_scholastic_marks_entry.index': '/result/co-scholastic-marks',
    'result/result-template': '/result/templates',
    'result-template.index': '/result/templates',
    'result/result_activity_marks': '/result/hpc-activity-entry',
    'result_activity_marks.index': '/result/hpc-activity-entry',
    'result/result_activity_marks_v1': '/result/hpc-entry-v1',
    'result_activity_marks_v1.index': '/result/hpc-entry-v1',
    'result/approve_mobile_result': '/result/approve-mobile-result',
    'approve_mobile_result.index': '/result/approve-mobile-result',
    'result/upload_result': '/result/upload-result',
    'upload_result.index': '/result/upload-result',
    // Masters
    'result/result_activity_master': '/result/master/hpc-activity',
    'result_activity_master.index': '/result/master/hpc-activity',
    'result/result_skillset': '/result/master/hpc-skillset',
    'result_skillset.index': '/result/master/hpc-skillset',
    'result/exam_type_master': '/result/master/exam-master',
    'exam_type_master.index': '/result/master/exam-master',
    'result/exam_creation': '/result/master/exam-creation',
    'exam_creation.index': '/result/master/exam-creation',
    'result/grade_master': '/result/master/grade-master',
    'grade_master.index': '/result/master/grade-master',
    'result/std_grd_maping': '/result/master/standard-grade-mapping',
    'std_grd_maping.index': '/result/master/standard-grade-mapping',
    'result/result_master': '/result/master/result-master',
    'result_master.index': '/result/master/result-master',
    'result/result_book_master': '/result/master/result-book-master',
    'result_book_master.index': '/result/master/result-book-master',
    'result/result_remark_master': '/result/master/student-result-remark',
    'result_remark_master.index': '/result/master/student-result-remark',
    'result/co_scholastic_master': '/result/master/co-scholastic-master',
    'co_scholastic_master.index': '/result/master/co-scholastic-master',
    'result/co_scholastic': '/result/master/co-scholastic-setup',
    'co_scholastic.index': '/result/master/co-scholastic-setup',
    'result/working_day_master': '/result/master/working-day-master',
    'working_day_master.index': '/result/master/working-day-master',
    'result/student_attendance_master': '/result/student-attendance',
    'student_attendance_master.index': '/result/student-attendance',
    // Reports
    'result/result_report': '/result/reports',
    'result_report.index': '/result/reports',
    'result/show_result_report': '/result/reports',
    'result/marks_approval_report': '/result/reports/marks-approval',
    'result/classwise_grade_report': '/result/reports/classwise-grade',
    'classwise_grade_report.index': '/result/reports/classwise-grade',
    'result/consolidate_report': '/result/reports/consolidate',
    'consolidate_report.index': '/result/reports/consolidate',
    'result/wrt_report': '/result/reports/wrt',
    'wrt_report.index': '/result/reports/wrt',
    'result/wrt_progress_report': '/result/reports/wrt-progress',
    'wrt_progress_report.index': '/result/reports/wrt-progress',
    'result/student-result': '/result/report-card',
    'student-result.index': '/result/report-card',
    'result/student-result-remarks': '/result/student-result-remarks',
    'student-result-remarks.index': '/result/student-result-remarks',
    'result/cbse_1t5_result': '/result/report-card/cbse-1t5',
    'cbse_1t5_result.index': '/result/report-card/cbse-1t5',
    'result/cbse_result': '/result/report-card/cbse-1t5',
    'result/cbse_result_t2': '/result/report-card/cbse-t2',
    'cbse_1t5_t2_result.index': '/result/report-card/cbse-t2',
    'result/cbse_11_result': '/result/report-card/cbse-11',
    'cbse_11_t2_result.index': '/result/report-card/cbse-11',
    'result/cnse_11_result': '/result/report-card/cnse-11',
    // Module hub
    'result': '/result',
    'result.index': '/result',
  };
  const lateResultRoute = resultRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (lateResultRoute) return lateResultRoute;

  if (!cleanLink) return '#';
  
  // If starts with /, use as-is
  if (cleanLink.startsWith('/')) {
    return cleanLink;
  }
  
  // Prepend with /
  return '/' + cleanLink;
}

/**
 * Check if a link is valid for navigation
 * @param link - The link field from API
 * @returns true if the link can be used for navigation
 */
export function isValidNavigationLink(link: string | null | undefined): boolean {
  if (!link) return false;
  
  const cleanLink = link.trim().toLowerCase();
  if (cleanLink === 'javascript:void(0);' || cleanLink === 'javascript:void(0)' || cleanLink === '#' || cleanLink === '') {
    return false;
  }
  
  return true;
}
