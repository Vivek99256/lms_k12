'use client';

/**
 * Whether this session should be offered the Document module.
 *
 * THIS IS COSMETIC. The decision that matters is made by Laravel, in
 * DocumentAggregationController::denyUnlessAdministrator(), against the profile
 * on the verified JWT. This function exists so an unauthorised user is not shown
 * a menu entry that answers 403 when they click it — hiding the door, not
 * locking it. A caller who ignores this function gains nothing: every endpoint
 * refuses them independently.
 *
 * WHY THE LIST IS DUPLICATED HERE. The browser cannot ask Laravel "may I see
 * this?" before rendering a menu without a request per entry, so the names are
 * repeated. They are deliberately the same strings as
 * config('documents.access.profiles'), and the server is the one that decides —
 * so drift between the two costs a hidden-but-permitted entry or a visible
 * entry that 403s, never unauthorised access.
 *
 * Reads the same browser storage lib/erp-client.ts and DashboardShell's
 * isBrainVisibleByLmsSession() read, and normalises names the same way the
 * backend does: lowercase, underscores to spaces, whitespace collapsed. Live
 * data holds "ADMIN", "Admin", "PRINCIPAL " and "collage_admin" for what are the
 * same roles.
 */

const ALLOWED_PROFILES = new Set([
  'super admin',
  'admin',
  'school admin',
  'college admin',
  'collage admin',
  'principal',
  'vice principal',
  'hr',
  'hr admin',
  'hr manager',
]);

function normaliseProfile(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readStored(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? '{}';
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function canAccessDocuments(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const userData = readStored('userData');
    const menuContext = readStored('menuContext');

    // A student is refused before any name is considered — same order as the
    // server. The flag comes from the login payload; a profile name is a
    // per-tenant string somebody can edit.
    const isStudent = userData.is_student ?? menuContext.is_student;
    if (isStudent === true || isStudent === 1 || isStudent === '1') return false;

    const isAdmin = Number(userData.is_admin ?? menuContext.is_admin ?? 0);
    if (isAdmin === 1 || isAdmin === 2) return true;

    const profile = normaliseProfile(
      menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile,
    );

    return profile !== '' && ALLOWED_PROFILES.has(profile);
  } catch {
    // Fail closed: an unreadable session is not an administrator.
    return false;
  }
}
