/**
 * Who may see internal-only material.
 *
 * WHY THIS IS ONE FILE
 *
 * This rule decides whether a screen shows rows marked `audience: 'internal'` in
 * `lib/roadmap` — the decision approval trail and the event bus, which describe
 * gaps in our own controls. Staff should see them so they get closed; a school
 * should not, because it advertises a gap rather than answering a question.
 *
 * It was written out three times: in `DashboardShell` to decide Enterprise Brain
 * access, and again in the Platform Administration and Platform Roadmap screens.
 * The copies had already drifted — the shell required a session with a tenant
 * and a user before granting anything, and the two screens did not, so a partial
 * session was denied Enterprise Brain while still being shown internal roadmap
 * rows. A disclosure rule that answers differently depending on which screen
 * asks is not a rule. Everything now calls this.
 *
 * The shell's stricter version is the one kept. Where two copies disagreed, the
 * one that reveals less is the safe one to standardise on.
 */

/**
 * The shape read out of `localStorage`.
 *
 * Deliberately `unknown` per field: this is whatever the login flow last wrote,
 * not a type we control, and the fields have arrived as both numbers and
 * strings. Everything is coerced below rather than trusted.
 */
export interface SessionSnapshot {
  is_admin?: unknown;
  user_profile_name?: unknown;
  user_profile?: unknown;
  user_profile_id?: unknown;
  sub_institute_id?: unknown;
  user_id?: unknown;
  id?: unknown;
}

/** Present and not blank. `0` counts as present; empty string and null do not. */
function isPresent(value: unknown): boolean {
  return value != null && value !== '';
}

/**
 * The rule itself, as a pure function of the two stored objects.
 *
 * Separated from the `localStorage` read so it can be tested without a browser —
 * see `internal-access.test.ts`, which pins it against the real profile names in
 * `tbluserprofilemaster`.
 */
export function isInternalViewer(
  userData: SessionSnapshot = {},
  menuContext: SessionSnapshot = {},
): boolean {
  // A session without a tenant and a user is not a session yet. Checked first
  // because the profile fields can be populated before the rest of the context
  // lands, and a half-written session must not open anything.
  const hasTenant = isPresent(userData.sub_institute_id) || isPresent(menuContext.sub_institute_id);
  const hasUser = isPresent(userData.id) || isPresent(menuContext.user_id);

  if (!hasTenant || !hasUser) return false;

  const isAdmin = Number(userData.is_admin ?? menuContext.is_admin ?? 0);
  const profileId = Number(menuContext.user_profile_id ?? userData.user_profile_id ?? 0);
  const profileName = String(
    menuContext.user_profile_name ?? userData.user_profile ?? '',
  ).toLowerCase();

  return (
    isAdmin === 1 ||
    isAdmin === 2 ||
    profileId === 1 ||
    profileName.includes('admin') ||
    profileName.includes('principal') ||
    profileName.includes('management')
  );
}

/**
 * The same rule, read from browser storage.
 *
 * Returns false during server rendering, where there is no storage to read, and
 * false on malformed JSON — a session we cannot parse is not one we open
 * internal material for.
 */
export function canSeeInternalView(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return isInternalViewer(
      JSON.parse(localStorage.getItem('userData') || '{}'),
      JSON.parse(localStorage.getItem('menuContext') || '{}'),
    );
  } catch {
    return false;
  }
}
