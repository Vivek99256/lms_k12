'use client';

/**
 * Whether this session should be offered Roles & Access.
 *
 * THIS IS COSMETIC. The decision is made by Laravel in `RoleAccessApiController`, against the
 * profile on the verified token: only an Admin or Super Admin is served, everybody else gets a
 * 403. This exists so nobody is shown a menu entry that refuses them when clicked — hiding the
 * door, not locking it. A caller who ignores it gains nothing.
 *
 * The names are deliberately the same two the server checks. Drift between the two costs a
 * hidden-but-permitted entry or a visible entry that answers 403, never unauthorised access.
 */

const ALLOWED_PROFILES = new Set(['admin', 'super admin']);

function normalise(value: unknown): string {
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

export function canManageRoleAccess(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const userData = readStored('userData');
    const menuContext = readStored('menuContext');

    const isStudent = userData.is_student ?? menuContext.is_student;
    if (isStudent === true || isStudent === 1 || isStudent === '1') return false;

    const profile = normalise(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile);

    return ALLOWED_PROFILES.has(profile);
  } catch {
    // Fail closed: an unreadable session is not an administrator.
    return false;
  }
}
