export type DashboardRole = 'admin' | 'teacher' | 'student' | 'workspace';

const ADMIN_PROFILES = new Set(['super admin', 'admin', 'school admin']);
const TEACHER_PROFILES = new Set(['teacher', 'lms teacher']);
const STUDENT_PROFILES = new Set(['student']);

/**
 * Maps the backend's free-text `user_profile_name` to a dashboard.
 *
 * Admin, Teacher and Student keep their dedicated screens. Every other staff profile
 * (Principal, Clerk, Librarian, Peon, Store Keeper, Exam Department, Trustee, Counsellor,
 * Assistant Admin ...) opens the role workspace, whose layout the server picks from the
 * same profile name (RoleWorkspaceApiController::roleKeyFor). Mirrors the admin-name set the
 * legacy web dashboardController checks (next_lms_erp/app/Http/Controllers/dashboardController.php).
 */
export function resolveDashboardRole(userProfileName: string | null | undefined): DashboardRole {
  const normalized = (userProfileName ?? '').trim().toLowerCase();

  if (TEACHER_PROFILES.has(normalized)) return 'teacher';
  if (STUDENT_PROFILES.has(normalized)) return 'student';
  if (ADMIN_PROFILES.has(normalized)) return 'admin';

  // Profile names are free text per school ("Class Teacher", "Senior Teacher", "HOD").
  // Falling through to the admin dashboard for these gave teachers a dashboard whose
  // summary endpoint refuses them, so match on the role word before giving up.
  if (/\b(teacher|hod|faculty)\b/.test(normalized)) return 'teacher';
  if (/\bstudent\b/.test(normalized)) return 'student';

  // Whole-school administrators with a school-specific name ("College Admin", "Collage_Admin",
  // "IT - Administrator", "Director") keep the admin dashboard. "Assistant Admin" does not:
  // it has its own workspace with narrower figures.
  if (/\bassistant[\s_-]*admin\b/.test(normalized)) return 'workspace';
  if (/(^|[\s_-])(college|collage)[\s_-]*admin\b|\badministrator\b|\bdirector\b|\bowner\b/.test(normalized)) return 'admin';

  // Unrecognised or absent names used to fall back to admin (getStoredMenuContext defaults the
  // field to 'ADMIN' when it is missing). Keep that for the missing case only; a named
  // non-admin profile gets the workspace instead of whole-school figures.
  return normalized === '' ? 'admin' : 'workspace';
}
