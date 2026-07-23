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
  const resultRoute = resultRoutes[cleanLink.toLowerCase().replace(/\/index$/, '')];
  if (resultRoute) return resultRoute;

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
