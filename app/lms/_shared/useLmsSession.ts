'use client';

import { useEffect, useState } from 'react';
import { buildSessionContext, createAuthHeaders, type SessionContext } from '@/lib/erp-client';

/**
 * Session context (token, sub_institute_id, syear, base URL) for the
 * curriculum-planning, monthly-plan and lesson-plan pages.
 *
 * There is no reliable "current class" anywhere in this app to default to:
 * `class_teacher` (used by the teacher dashboard's `my_classes`) is the
 * homeroom assignment, not "classes this teacher has lesson plans for", so
 * it under- or over-reports depending on the account. Each page instead
 * renders its own <SearchDropdown fields={['standard', 'division']}> and
 * lets the signed-in staff member pick the class explicitly, same as
 * app/lms/homework and the other filtered LMS pages.
 */
export function useLmsSessionContext(): SessionContext {
  const [session, setSession] = useState<SessionContext>(() => buildSessionContext());

  useEffect(() => {
    const sync = () => setSession(buildSessionContext());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return session;
}

export { createAuthHeaders };
