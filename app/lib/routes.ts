/**
 * Route Name Registry
 * Maps route names to paths for type-safe navigation
 */

export const ROUTES = {
  // Dashboard
  dashboard: '/dashboard',
  
  // Exam routes
  exam: {
    marksEntry: '/exam/marks-entry',
    examMaster: '/exam/exam-master',
  },
  
  // Student routes
  students: {
    searchStudent: '/students/search_student',
  },
  
  // Fees routes
  fees: {
    collect: '/fees/collect',
  },
} as const;

export type RouteName = string;

/**
 * Get route path by name
 * @param routeName - Route path string
 * @returns The route path for useRouter().push()
 */
export function getRoute(routeName: string): string {
  if (!routeName) return '/';
  return routeName.startsWith('/') ? routeName : `/${routeName}`;
}

/**
 * Compose route with parameters
 * @param route - Base route name
 * @param params - URL parameters
 * @returns Route with query params
 */
export function composeRoute(route: string, params?: Record<string, string | number | undefined>): string {
  const basePath = getRoute(route);
  if (!params || Object.keys(params).length === 0) return basePath;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  
  return `${basePath}?${searchParams.toString()}`;
}