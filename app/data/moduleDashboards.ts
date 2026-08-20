/**
 * Level 2 (module) → its dashboard landing route.
 *
 * Menu shape is Level 1 (top category, e.g. "Institute ERP") → Level 2
 * (module, e.g. "Fees") → Level 3 (the module's actual screens, e.g. "Fees
 * Collect"). Clicking a Level 2 module should land on its dashboard first —
 * Level 2 → module dashboard → Level 3 screen — for the modules that have
 * one. Everything else keeps the previous "jump straight to the first Level
 * 3 screen" behavior.
 *
 * Keyed by the Level 2 item's label (lowercased) since the API-driven `link`
 * for a Level 2 row is a legacy Laravel route name/slug, not something a
 * dashboard route can be reliably derived from. Only modules that actually
 * have a dashboard page belong here.
 */
export const MODULE_DASHBOARD_ROUTES: Record<string, string> = {
  fees: '/fees/dashboard',
  fee: '/fees/dashboard',
  admissions: '/admissions/dashboard',
  admission: '/admissions/dashboard',
  students: '/students/dashboard',
  student: '/students/dashboard',
  library: '/library/dashboard',
  hostel: '/hostel/dashboard',
  transportation: '/Transportation/dashboard',
  transport: '/Transportation/dashboard',
};

export function resolveModuleDashboardRoute(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  return MODULE_DASHBOARD_ROUTES[label.trim().toLowerCase()];
}
