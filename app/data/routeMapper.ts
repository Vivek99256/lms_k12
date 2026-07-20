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

  if (cleanLink.toLowerCase() === 'fees_collection_report.index') {
    return '/fees/reports/fees-collection';
  }

  if (cleanLink.toLowerCase() === 'fees_type_wise_report.index') {
    return '/fees/reports/fees-type-wise';
  }

  if (cleanLink.toLowerCase() === 'othernew_fees_report.index') {
    return '/fees/reports/other-fees';
  }

  if (cleanLink.toLowerCase() === 'othernew_cancel_fees_report.index') {
    return '/fees/reports/other-fees-cancel';
  }

  if (cleanLink.toLowerCase() === 'fees_defaulter_report.index') {
    return '/fees/reports/fees-defaulter';
  }

  if (cleanLink.toLowerCase() === 'student_breakoff_report.index') {
    return '/fees/reports/student-breakoff';
  }

  if (cleanLink.toLowerCase() === 'fees_report_datewise.index') {
    return '/fees/reports/datewise-summary';
  }

  if (cleanLink.toLowerCase() === 'fees_structure_report_index') {
    return '/fees/reports/fees-structure';
  }

  if (cleanLink.toLowerCase() === 'fees_cancel_report_index') {
    return '/fees/reports/fees-cancel';
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
