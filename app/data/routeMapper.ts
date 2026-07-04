/**
 * Route Mapper Utility
 * Fully dynamic - maps API link fields to Next.js routes
 * All routes come from API, no static/fixed routes
 * Handles both underscore and hyphen folder names
 * 
 * For file existence checking, use the server action 'mapApiLinkToRouteServer'
 * from app/actions/routeActions.ts
 */

/**
 * Generate variations of a route path with underscores/hyphens swapped
 * @param routePath - The original route path
 * @returns Array of path variations to check
 */
export function getPathVariations(routePath: string): string[] {
  const variations: string[] = [routePath];
  
  let cleanPath = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  
  // Replace underscores with hyphens
  const withHyphens = cleanPath.replace(/_/g, '-');
  if (withHyphens !== cleanPath) {
    variations.push('/' + withHyphens);
  }
  
  // Replace hyphens with underscores
  const withUnderscores = cleanPath.replace(/-/g, '_');
  if (withUnderscores !== cleanPath) {
    variations.push('/' + withUnderscores);
  }
  
  return [...new Set(variations)];
}

/**
 * Convert API link to Next.js route
 * Link format: "students/search_student/" -> Route: "/students/search_student"
 * Or: "students/search-student/" -> Route: "/students/search-student"
 * 
 * Note: This function returns the link as a route. File existence checking
 * should be done via the server action 'mapApiLinkToRouteServer'.
 * 
 * @param link - The link field from API (e.g., "students/search_student/")
 * @returns The Next.js route path
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
