/**
 * Route Mapper Utility
 * Maps API link fields (e.g., "students/search_student/") to Next.js app routes
 * The link is converted to app/students/search_student/page.tsx format
 * If the file doesn't exist, Next.js will show 404 page automatically
 */

/**
 * Convert API link to Next.js route
 * Link format: "students/search_student/" -> Route: "/students/search_student"
 * This corresponds to app/students/search_student/page.tsx in the app directory
 * 
 * @param link - The link field from API (e.g., "students/search_student/")
 * @returns The Next.js route path (e.g., "/students/search_student")
 *         Returns '#' for invalid/void links
 */
export function mapApiLinkToRoute(link: string | null | undefined): string {
  if (!link) return '/dashboard';
  
  // Clean the link - remove leading/trailing whitespace
  let cleanLink = link.trim();
  
  // Check if it's a JavaScript void link
  const lowerLink = cleanLink.toLowerCase();
  if (lowerLink === 'javascript:void(0);' || lowerLink === 'javascript:void(0)' || lowerLink === '#' || lowerLink === '') {
    return '#';
  }
  
  // Remove trailing slashes but keep internal structure
  // "students/search_student/" -> "students/search_student"
  cleanLink = cleanLink.replace(/\/+$/, '');
  
  // If empty after cleaning, return dashboard
  if (!cleanLink) return '/dashboard';
  
  // If already starts with /, use as is
  if (cleanLink.startsWith('/')) {
    return cleanLink;
  }
  
  // DO NOT convert underscores to hyphens - preserve the original API link format
  // API links like "students/search_student/" should map to "/students/search_student"
  // which corresponds to app/students/search_student/page.tsx
  
  // Prepend with / to make it a valid route
  return '/' + cleanLink;
}

/**
 * Check if a route exists in the app
 * This is a client-side check using known routes
 */
export const KNOWN_ROUTES = [
  '/dashboard',
  '/admission-Enquiry',
  '/admissions/registration',
  '/admissions/confirmation',
  '/students/search_student',
  '/fees/collect',
  '/subjects',
  '/quiz',
  '/quiz/create',
  '/planning/calendar',
  '/settings',
  '/settings/profile',
  '/settings/account',
];

/**
 * Check if a route is known to exist in the app
 * @param route - The route to check
 * @returns true if the route is known to exist
 */
export function isKnownRoute(route: string): boolean {
  const normalizedRoute = route.toLowerCase().replace(/\/+$/, '');
  return KNOWN_ROUTES.some(known => 
    known.toLowerCase().replace(/\/+$/, '') === normalizedRoute
  );
}

/**
 * Get the redirect target for a menu link
 * If the route exists, return it; otherwise return the dashboard
 * Note: Next.js will show 404 if the route doesn't exist when navigating
 * 
 * @param link - The link field from API
 * @returns The route to redirect to
 */
export function getRedirectTarget(link: string | null | undefined): string {
  const route = mapApiLinkToRoute(link);
  
  // If it's a hash (#) or empty, go to dashboard
  if (route === '#' || route === '/' || route === '') {
    return '/dashboard';
  }
  
  return route;
}
