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
