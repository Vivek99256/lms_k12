/**
 * Route Mapper Utility
 * Fully dynamic - maps API link fields to Next.js routes
 * All routes come from API, no static/fixed routes
 */

/**
 * Convert API link to Next.js route
 * Link format: "students/search_student/" -> Route: "/students/search_student"
 * Or: "students/search-student/" -> Route: "/students/search-student"
 * Preserves underscores and hyphens exactly as provided by API
 * 
 * @param link - The link field from API (e.g., "students/search_student/")
 * @returns The Next.js route path (e.g., "/students/search_student")
 *         Returns '#' for invalid/void links
 */
export function mapApiLinkToRoute(link: string | null | undefined): string {
  if (!link) return '#';
  
  // Clean the link - remove leading/trailing whitespace
  let cleanLink = link.trim();
  
  // Check if it's a JavaScript void link or hash
  const lowerLink = cleanLink.toLowerCase();
  if (lowerLink === 'javascript:void(0);' || lowerLink === 'javascript:void(0)' || lowerLink === '#' || lowerLink === '') {
    return '#';
  }
  
  // Remove trailing slashes but keep internal structure
  // "students/search_student/" -> "students/search_student"
  cleanLink = cleanLink.replace(/\/+$/, '');
  
  // If empty after cleaning, return hash
  if (!cleanLink) return '#';
  
  // If already starts with /, use as is
  if (cleanLink.startsWith('/')) {
    return cleanLink;
  }
  
  // Preserve underscores and hyphens exactly as provided by API
  // API links like "students/search_student/" or "students/search-student/" 
  // are used directly
  
  // Prepend with / to make it a valid route
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
