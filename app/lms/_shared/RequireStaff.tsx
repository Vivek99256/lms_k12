'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { isStudentSession } from '@/app/pal/data/pal-lookups';

/**
 * Wraps a teacher/admin-only LMS page. A student session is redirected to the
 * LMS dashboard before any of the page's content renders — the sidebar already
 * hides these pages from students via the menu-rights API, but that does not
 * stop direct URL navigation, so this is the client-side backstop.
 */
export default function RequireStaff({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (isStudentSession()) {
      setState('denied');
      router.replace('/lms/dashboard');
    } else {
      setState('allowed');
    }
  }, [router]);

  if (state !== 'allowed') return null;
  return <>{children}</>;
}
