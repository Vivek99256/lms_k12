/**
 * Route Mapper Utility
 * Maps API link fields (e.g., "student/search_student/") to Next.js app routes
 */

// Map of API link paths to Next.js app routes
export const API_ROUTE_MAP: Record<string, string> = {
  // Search/Edit Student - maps to /students/search_student
  'student/search_student/': '/students/search_student',
  'student/search_student': '/students/search_student',
  'search_student/': '/students/search_student',
  'search_student': '/students/search_student',
  
  // Admission routes
  'admission-enquiry': '/admission-Enquiry',
  'admission_enquiry': '/admission-Enquiry',
  'admission-enquiry/': '/admission-Enquiry',
  'admission_enquiry/': '/admission-Enquiry',
  
  'admission-registration': '/admissions/registration',
  'admission_registration': '/admissions/registration',
  'admission-registration/': '/admissions/registration',
  'admission_registration/': '/admissions/registration',
  
  'admission-confirmation': '/admissions/confirmation',
  'admission_confirmation': '/admissions/confirmation',
  'admission-confirmation/': '/admissions/confirmation',
  'admission_confirmation/': '/admissions/confirmation',
  
  // Dashboard
  'dashboard': '/dashboard',
  'dashboard/': '/dashboard',
  
  // Fees
  'fees/collect': '/fees/collect',
  'fees/collect/': '/fees/collect',
  'fees_collect': '/fees/collect',
  
  // Subjects
  'subjects': '/subjects',
  'subjects/': '/subjects',
  
  // Quiz
  'quiz': '/quiz',
  'quiz/': '/quiz',
  
  // Planning/Calendar
  'planning/calendar': '/planning/calendar',
  'planning/calendar/': '/planning/calendar',
};

/**
 * Convert API link to Next.js route
 * @param link - The link field from API (e.g., "student/search_student/")
 * @returns The mapped Next.js route or the cleaned original link
 */
export function mapApiLinkToRoute(link: string | null | undefined): string {
  if (!link) return '/dashboard';
  
  // Clean the link
  let cleanLink = link.trim().toLowerCase();
  
  // Remove trailing/leading slashes
  cleanLink = cleanLink.replace(/^\/+|\/+$/g, '');
  
  // Check if it's a JavaScript void link
  if (cleanLink === 'javascript:void(0);' || cleanLink === 'javascript:void(0)') {
    return '#';
  }
  
  // Check exact match in route map
  if (API_ROUTE_MAP[cleanLink]) {
    return API_ROUTE_MAP[cleanLink];
  }
  
  // Check with trailing slash
  if (API_ROUTE_MAP[cleanLink + '/']) {
    return API_ROUTE_MAP[cleanLink + '/'];
  }
  
  // Check without trailing slash
  if (API_ROUTE_MAP[cleanLink.replace(/\/$/, '')]) {
    return API_ROUTE_MAP[cleanLink.replace(/\/$/, '')];
  }
  
  // If already starts with /, return cleaned version
  if (link.startsWith('/')) {
    return '/' + cleanLink;
  }
  
  // Convert link format to route format
  // e.g., "student/search_student" -> "/student/search_student"
  // e.g., "admission_enquiry" -> "/admission-enquiry"
  const converted = cleanLink
    .replace(/_/g, '-')  // underscores to hyphens
    .replace(/\//g, '/'); // keep slashes as is
  
  return '/' + converted;
}

/**
 * Check if a route exists in the app
 * This is a client-side check using known routes
 */
export const KNOWN_ROUTES = [
  '/dashboard',
  '/admission-enquiry',
  '/admission-Enquiry',
  '/admissions/registration',
  '/admissions/confirmation',
  '/search_student',
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
 * Check if a route is known to exist
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
 * @param link - The link field from API
 * @returns The route to redirect to
 */
export function getRedirectTarget(link: string | null | undefined): string {
  const route = mapApiLinkToRoute(link);
  
  // If it's a hash (#) or empty, go to dashboard
  if (route === '#' || route === '/' || route === '') {
    return '/dashboard';
  }
  
  // For now, return the mapped route
  // The 404 page will be shown by Next.js if the route doesn't exist
  return route;
}
