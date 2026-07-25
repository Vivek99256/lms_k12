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

  careerCounselling: {
    home: '/career-counselling',
    explore: '/career-counselling?section=explore',
    assessment: '/career-counselling?section=assessment',
    colleges: '/career-counselling?section=colleges',
    courses: '/career-counselling?section=courses',
    employers: '/career-counselling?section=employers',
    experts: '/career-counselling?section=experts',
    sectors: '/career-counselling?section=sectors',
    match: '/career-counselling?section=match',
  },
  
  // Fees routes
  fees: {
    collect: '/fees/collect',
    nachS1ExcelExport: '/fees/NACH_s1excel_export',
    nachS2ExcelImport: '/fees/NACH_s2excel_import',
    nachS3ExcelExport: '/fees/NACH_s3excel_export',
    nachS4ExcelImport: '/fees/NACH_s4excel_import',
    otherFeesCollect: '/fees/other_fees_collect',
    otherFeesCancel: '/fees/other_fees_cancel',
    onlineFeesCollect: '/fees/online_fees_collect',
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
