'use client';

import { useEffect, useState } from 'react';

import { getRequestContext } from '@/app/course-master/page';
import { readStatus, type ActivityStatus } from './progress';

/**
 * How far this device's learner has got in an activity, for the card on the Classroom Resource page.
 *
 * Read from the browser's storage after the page has loaded (never during the first render, so the server and the browser
 * agree), and read again when the learner comes back to this tab or another tab changes it. Where storage is unavailable
 * the answer is "not started": the card never claims progress it cannot see.
 */
export function useActivityStatus(contentId: string | number, totalSteps: number): ActivityStatus | null {
  const [status, setStatus] = useState<ActivityStatus | null>(null);

  useEffect(() => {
    const userId = Number(getRequestContext()?.user_id ?? 0) || null;
    const read = () => setStatus(readStatus(contentId, userId, totalSteps));
    read();
    window.addEventListener('focus', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('focus', read);
      window.removeEventListener('storage', read);
    };
  }, [contentId, totalSteps]);

  return status;
}
