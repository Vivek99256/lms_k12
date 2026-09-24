'use client';

/**
 * Frontend build identity, and the cache purge that keeps a browser from serving
 * yesterday's app.
 *
 * The problem this solves: a deploy ships new JS, but a returning browser keeps
 * handing the user state written by the *previous* build — localStorage shapes that
 * no longer match what the code reads, a Cache Storage entry holding an old response,
 * a document still in the HTTP cache. The symptom is a user who "has to clear their
 * cache" before the new version behaves. Nothing about that is the user's job.
 *
 * Two moments are enough to catch every returning browser:
 *
 *  - Startup, via `syncAppBuild()`. The stored build id is compared against the one
 *    compiled into this bundle. A mismatch means the browser is holding state from a
 *    build that is no longer running, so everything client-side is dropped and the
 *    page is reloaded once against the new code.
 *  - Logout, via `purgeClientState()`. The user is leaving anyway, so this is the
 *    cheapest possible place to take the app back to a clean slate — and it is what
 *    makes "log out and log back in" a reliable way to pick up a deploy.
 *
 * The build id is injected at build time by `next.config.ts` (git SHA, else a build
 * timestamp), so it changes on its own with every deploy. There is no version
 * constant for anyone to remember to bump.
 */

/**
 * Identifies the build this bundle came from. Inlined by Next at build time —
 * `process.env.NEXT_PUBLIC_*` is a literal substitution, not a runtime lookup, so
 * this is a constant in the shipped JS.
 *
 * Falls back to `'development'` so `next dev` does not purge and reload on every
 * restart while someone is working.
 */
export const APP_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || 'development';

const STORAGE_KEY_BUILD_ID = 'appBuildId';

function safeStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Private mode or blocked site data. Nothing to purge, and nothing to record.
    return null;
  }
}

/**
 * Read the build id the browser last ran, before anything clears it.
 */
export function getStoredBuildId(): string | null {
  try {
    return safeStorage('local')?.getItem(STORAGE_KEY_BUILD_ID) ?? null;
  } catch {
    return null;
  }
}

/**
 * Stamp the current build id, so the next startup can tell whether the browser has
 * moved builds. Always called *after* a purge, never before — a purge wipes it.
 */
export function recordBuildId(): void {
  try {
    safeStorage('local')?.setItem(STORAGE_KEY_BUILD_ID, APP_BUILD_ID);
  } catch {
    /* storage unavailable; the next startup simply re-purges, which is harmless */
  }
}

function clearCookies(): void {
  if (typeof document === 'undefined') return;

  const cookies = document.cookie ? document.cookie.split(';') : [];
  if (cookies.length === 0) return;

  // A cookie can only be deleted by a request that matches its own path and domain,
  // and JS cannot read either attribute back. So expire each name against the paths
  // and domain scopes an app cookie plausibly used; the non-matching attempts are
  // silently ignored by the browser.
  const { hostname, pathname } = window.location;
  const domains = [undefined, hostname, `.${hostname}`];
  const segments = pathname.split('/').filter(Boolean);
  const paths = ['/', ...segments.map((_, i) => `/${segments.slice(0, i + 1).join('/')}`)];

  for (const cookie of cookies) {
    const name = cookie.split('=')[0]?.trim();
    if (!name) continue;

    for (const path of paths) {
      for (const domain of domains) {
        document.cookie =
          `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}` +
          (domain ? `; domain=${domain}` : '');
      }
    }
  }
}

async function clearCacheStorage(): Promise<void> {
  if (typeof caches === 'undefined') return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    /* Cache Storage can be unavailable; the hashed-asset URLs still change per build */
  }
}

async function unregisterServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    /* nothing useful to do */
  }
}

/**
 * Drop every piece of client-side state this origin owns: both web storages, all
 * JS-readable cookies, every Cache Storage bucket, and any service worker that could
 * keep replaying an old response.
 *
 * Deliberately a blanket clear rather than a list of known keys. A key list has to be
 * kept in step with every feature that ever writes storage, and the keys most likely
 * to break a deploy are exactly the ones a stale list would miss. Everything on this
 * origin is this app's own per-session state, so there is nothing here worth keeping.
 *
 * The synchronous part runs first so the caller can rely on storage being empty even
 * if the awaited half is cut short by a navigation.
 */
export async function purgeClientState(): Promise<void> {
  try {
    safeStorage('local')?.clear();
  } catch {
    /* ignore */
  }

  try {
    safeStorage('session')?.clear();
  } catch {
    /* ignore */
  }

  clearCookies();

  await Promise.all([clearCacheStorage(), unregisterServiceWorkers()]);
}

/**
 * Compare the running build against the one this browser last saw, and take the
 * browser to a clean copy of the new build if they differ.
 *
 * Returns true when a reload was triggered, so the caller can stop rendering work
 * that is about to be thrown away.
 *
 * A browser with no stored id is recorded rather than reloaded: that is a first visit
 * or a browser whose storage was already cleared, and reloading it would be a wasted
 * round trip. The id is written back *after* the purge, and before the reload, so the
 * fresh load sees a matching id and cannot loop.
 */
export async function syncAppBuild(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (APP_BUILD_ID === 'development') return false;

  const storedBuildId = getStoredBuildId();

  if (storedBuildId === APP_BUILD_ID) return false;

  if (storedBuildId === null) {
    recordBuildId();
    return false;
  }

  await purgeClientState();
  recordBuildId();
  window.location.reload();
  return true;
}
