'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { isStudentSession } from '@/app/pal/data/pal-lookups';

/**
 * Wraps a teacher/admin-only LMS page. A student session is redirected before
 * any of the page's content renders — the sidebar already hides these pages
 * from students via the menu-rights API, but that does not stop direct URL
 * navigation, so this is the client-side backstop.
 *
 * `redirectTo` defaults to the LMS dashboard, but a page with a dedicated
 * student-facing equivalent (e.g. Assignment authoring → Assignment
 * Submission) should point students there instead of a generic bounce.
 */
export default function RequireStaff({
  children,
  redirectTo = '/lms/dashboard',
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (isStudentSession()) {
      setState('denied');
      router.replace(redirectTo);
    } else {
      setState('allowed');
    }
  }, [router, redirectTo]);

  if (state !== 'allowed') return null;
  return <>{children}</>;
}
