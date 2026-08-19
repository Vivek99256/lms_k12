export type DashboardRole = 'admin' | 'teacher' | 'student';

const ADMIN_PROFILES = new Set(['super admin', 'admin', 'school admin']);
const TEACHER_PROFILES = new Set(['teacher']);
const STUDENT_PROFILES = new Set(['student']);

/**
 * Maps the backend's free-text `user_profile_name` to one of the three
 * dashboards. Mirrors the admin-name set the legacy web dashboardController
 * checks (next_lms_erp/app/Http/Controllers/dashboardController.php:108-110).
 * Unrecognized names fall back to `admin`, matching getStoredMenuContext()'s
 * existing default of `'ADMIN'` when the field is absent.
 */
export function resolveDashboardRole(userProfileName: string | null | undefined): DashboardRole {
  const normalized = (userProfileName ?? '').trim().toLowerCase();

  if (TEACHER_PROFILES.has(normalized)) return 'teacher';
  if (STUDENT_PROFILES.has(normalized)) return 'student';
  if (ADMIN_PROFILES.has(normalized)) return 'admin';

  return 'admin';
}
