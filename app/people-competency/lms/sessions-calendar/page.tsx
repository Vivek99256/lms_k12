'use client'

/**
 * Route for People & Competency > LMS > Sessions & Calendar (routeMapper key
 * `g2g_lms.sessions_calendar`). Ported from G2G's
 * `components/domain/lms/sessions/sessions-calendar.tsx`, mounted directly
 * here the same way `talent-management/certifications/page.tsx` mounts
 * `CertificationsCenter` — this screen reads no `useSearchParams()`, so no
 * `<Suspense>` boundary is needed.
 */

import { SessionsCalendar } from '@/components/domain/lms/sessions'

export default function LmsSessionsCalendarPage() {
  return <SessionsCalendar />
}
