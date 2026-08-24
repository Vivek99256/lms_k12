'use client';

import { useEffect, useState } from 'react';
import type { PalStudentSelection } from '@/app/pal/data/pal';

/**
 * "View as student" — a shared, persisted impersonation context so an
 * admin/teacher who picks a student on the PAL landing keeps viewing that same
 * learner across the workspace and the Intelligence dashboard (which otherwise
 * defaults to the signed-in user and shows no data for staff).
 *
 * It only changes which learner id the PAL screens READ; it never changes the
 * authenticated session, and the `pal.auth` backend still enforces that the
 * caller is allowed to view that learner.
 */

const KEY = 'pal_view_as_student';
const EVENT = 'pal-view-as-change';

export function getViewAsStudent(): PalStudentSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PalStudentSelection;
    return parsed && parsed.studentId ? parsed : null;
  } catch {
    return null;
  }
}

export function setViewAsStudent(student: PalStudentSelection | null): void {
  if (typeof window === 'undefined') return;
  if (student && student.studentId) {
    localStorage.setItem(KEY, JSON.stringify(student));
  } else {
    localStorage.removeItem(KEY);
  }
  // Notify same-tab listeners (the native 'storage' event only fires cross-tab).
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe to the active "view as student", reacting to changes anywhere. */
export function useViewAsStudent(): PalStudentSelection | null {
  const [student, setStudent] = useState<PalStudentSelection | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) setStudent(getViewAsStudent());
    };
    // Defer the initial read to avoid a synchronous setState in the effect body.
    queueMicrotask(sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return student;
}
