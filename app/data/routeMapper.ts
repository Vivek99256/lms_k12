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
    return '/exam/exam-master';
  }

  if (
    cleanLink.toLowerCase() === 'marks_entry.index' ||
    cleanLink.toLowerCase() === 'result/marks_entry' ||
    cleanLink.toLowerCase() === 'result/marks_entry/index'
  ) {
    return '/exam/marks-entry';
  }
  
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
