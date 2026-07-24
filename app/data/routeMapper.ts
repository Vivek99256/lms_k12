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
  'templatemaster.index': '/general/template_management',
  'settings/templatemaster': '/general/template_management',
  'formbuild.list': '/general/form_builder',
  'formbuilder/list': '/general/form_builder',
  'add_user_profile.index': '/general/user_profile_masters',
  'user/add_user_profile': '/general/user_profile_masters',
  'add_implementation.index': '/general/implementation_management',
  'implementation/add_implementation': '/general/implementation_management',
  'bulk_chapter_upload.index': '/general/bulk_upload',
  'lms/bulk_chapter_upload': '/general/bulk_upload',
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
 * LMS → PAL (Personalized Adaptive Learning): legacy Laravel route names /
 * paths → Next.js routes under /pal. The PAL (ENTRY) and PAL Report (REPORT)
 * menu rows live in the shared backend menu; these map their links to the new
 * frontend screens. Keys must be lowercase (lookups are lowercased).
 */
const PAL_ROUTE_NAME_MAP: Record<string, string> = {
  'pal.index': '/pal',
  'lms/pal': '/pal',
  'palreport.index': '/pal/report',
  'lms/palreport': '/pal/report',
  'result_personalize_marks.index': '/pal/personalize-marks',
  'result_personalize_marks/index': '/pal/personalize-marks',
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

  const resultRoute = RESULT_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (resultRoute) {
    return resultRoute;
  }

  // LMS → H5P content: legacy Laravel route-name / path links → Next routes.
  const h5pRoute = H5P_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (h5pRoute) {
    return h5pRoute;
  }

  // LMS → PAL: legacy Laravel route-name / path links → Next routes.
  const palRoute = PAL_ROUTE_NAME_MAP[cleanLink.toLowerCase()];
  if (palRoute) {
    return palRoute;
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

  if (
    cleanLink.toLowerCase() === 'daywise_student_attendance' ||
    cleanLink.toLowerCase() === 'show_daywise_student_attendance' ||
    cleanLink.toLowerCase() === 'show_daywise_student_attendance_report' ||
    cleanLink.toLowerCase() === 'daywise_student_attendance_report' ||
    cleanLink.toLowerCase() === 'student/daywise_student_attendance' ||
    cleanLink.toLowerCase() === 'student/daywise_student_attendance/index'
  ) {
    return '/student/daywise_student_attendance';
  }

  if (
    cleanLink.toLowerCase() === 'monthwise_student_attendance' ||
    cleanLink.toLowerCase() === 'show_monthwise_student_attendance' ||
    cleanLink.toLowerCase() === 'show_monthwise_student_attendance_report' ||
    cleanLink.toLowerCase() === 'monthwise_student_attendance_report' ||
    cleanLink.toLowerCase() === 'student/monthwise_student_attendance' ||
    cleanLink.toLowerCase() === 'student/monthwise_student_attendance/index'
  ) {
    return '/student/monthwise_student_attendance';
  }

  if (
    cleanLink.toLowerCase() === 'yearly_student_attendance' ||
    cleanLink.toLowerCase() === 'show_yearly_student_attendance' ||
    cleanLink.toLowerCase() === 'student/yearly_student_attendance' ||
    cleanLink.toLowerCase() === 'student/yearly_student_attendance/index'
  ) {
    return '/student/yearly_student_attendance';
  }

  if (
    cleanLink.toLowerCase() === 'student_attendance' ||
    cleanLink.toLowerCase() === 'show_student_attendance' ||
    cleanLink.toLowerCase() === 'save_student_attendance' ||
    cleanLink.toLowerCase() === 'student/student_attendance' ||
    cleanLink.toLowerCase() === 'student/student_attendance/index'
  ) {
    return '/student/student_attendance';
  }

  if (
    cleanLink.toLowerCase() === 'lms_teacherresource.index' ||
    cleanLink.toLowerCase() === 'lms/lms_teacherresource' ||
    cleanLink.toLowerCase() === 'lms/lms_teacherresource/index'
  ) {
    return '/library/book_resources';
  }

  if (
    cleanLink.toLowerCase() === 'scan_books.index' ||
    cleanLink.toLowerCase() === 'scan_books' ||
    cleanLink.toLowerCase() === 'scan_books/index'
  ) {
    return '/library/scan_book';
  }

  if (
    cleanLink.toLowerCase() === 'scan_books_remarks.index' ||
    cleanLink.toLowerCase() === 'scan_books_remarks' ||
    cleanLink.toLowerCase() === 'scan_books_remarks/index'
  ) {
    return '/library/add_book_remark';
  }

  if (
    cleanLink.toLowerCase() === 'quick_return.index' ||
    cleanLink.toLowerCase() === 'quick_return' ||
    cleanLink.toLowerCase() === 'quick_return/index'
  ) {
    return '/library/quick_return';
  }

  if (
    cleanLink.toLowerCase() === 'library_report.index' ||
    cleanLink.toLowerCase() === 'library_report' ||
    cleanLink.toLowerCase() === 'library_report/index'
  ) {
    return '/library/report';
  }

  if (
    cleanLink.toLowerCase() === 'book_issue_report.index' ||
    cleanLink.toLowerCase() === 'book_issue_report' ||
    cleanLink.toLowerCase() === 'book_issue_report/index'
  ) {
    return '/library/issue_overdue_report';
  }

  if (
    cleanLink.toLowerCase() === 'print_barcode.index' ||
    cleanLink.toLowerCase() === 'print_barcode' ||
    cleanLink.toLowerCase() === 'print_barcode/index'
  ) {
    return '/library/print_barcode';
  }

  if (
    cleanLink.toLowerCase() === 'verified_report.index' ||
    cleanLink.toLowerCase() === 'verified_book_report' ||
    cleanLink.toLowerCase() === 'verified_book_report/index'
  ) {
    return '/library/scanned_book_report';
  }

  if (
    cleanLink.toLowerCase() === 'verifiypending_report.index' ||
    cleanLink.toLowerCase() === 'verified_book_report_pending' ||
    cleanLink.toLowerCase() === 'verified_book_report_pending/index'
  ) {
    return '/library/pending_scan_report';
  }

  if (
    cleanLink.toLowerCase() === 'lost_and_damage.index' ||
    cleanLink.toLowerCase() === 'lost_and_damage' ||
    cleanLink.toLowerCase() === 'lost_and_damage/index'
  ) {
    return '/library/lost_damage_report';
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
