'use client';

import { useSyncExternalStore } from 'react';

import { normalizeAcademicYear } from '@/lib/erp-client';

/**
 * The academic year the LMS header currently has selected.
 *
 * THERE IS ONLY ONE YEAR SELECTOR IN THIS PRODUCT and it is the one in
 * `app/components/Header.tsx`. It stores its choice as a `syear` — the integer
 * year in `academic_year.syear` — under `selectedAcademicYear`, and roughly
 * thirty screens (fees, exam, result, student, course-master, the chatbot)
 * already read that key straight out of localStorage and pass it to the API as
 * `syear`. This module does not introduce a second source of truth; it names
 * the existing one and adds the one thing localStorage cannot do on its own.
 *
 * WHY AN EVENT. `localStorage` fires `storage` only in OTHER tabs, so a screen
 * that switched years in this one would keep rendering last year's data until
 * something else happened to remount it. Every screen that reads the key at
 * request time has always had that flaw; it is invisible on a page that refetches
 * on navigation and glaring on one like the Enterprise Brain that does not. The
 * header publishes through here, and anything that needs to follow the switcher
 * subscribes.
 */
export const ACADEMIC_YEAR_STORAGE_KEY = 'selectedAcademicYear';

/** Same-tab notification; `storage` covers the other tabs. */
export const ACADEMIC_YEAR_EVENT = 'lms:academic-year-change';

/**
 * The stored selection, read through the LMS's own normaliser.
 *
 * `normalizeAcademicYear` is what erp-client and the fees client already apply
 * to this key, and it is not cosmetic: some installs have left values like
 * "2024-2025" behind, and `syear` is an INTEGER column. Sending the raw string
 * would match no row and silently empty a screen. Reusing the LMS's function
 * rather than re-deriving one is also what keeps the two in step.
 */
export function readSelectedAcademicYear(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeAcademicYear(localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY) || '');
  } catch {
    // Private mode, or site data blocked. An unknown year is not an error: the
    // Brain API falls back to the institute's current year on its own.
    return '';
  }
}

/**
 * Record the header's selection and tell this tab about it.
 *
 * A no-op when the value has not actually changed, so the header's persistence
 * effect cannot spin subscribers on every render.
 */
export function publishSelectedAcademicYear(year: string): void {
  if (typeof window === 'undefined' || !year) return;

  try {
    if (localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY) === year) return;
    localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, year);
  } catch {
    // Still notify: the in-memory listeners can follow the switch even when the
    // choice could not be persisted for the next visit.
  }

  window.dispatchEvent(new CustomEvent(ACADEMIC_YEAR_EVENT, { detail: year }));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ACADEMIC_YEAR_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(ACADEMIC_YEAR_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The selected year, re-rendering the caller when the header changes it.
 *
 * The server snapshot is '' rather than a read: localStorage does not exist
 * there, and returning a guess would hydrate the page with a year the browser
 * may not agree with.
 */
export function useSelectedAcademicYear(): string {
  return useSyncExternalStore(subscribe, readSelectedAcademicYear, () => '');
}
