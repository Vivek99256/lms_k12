'use client'

/**
 * Ported from G2G's `components/domain/task/index.ts` (a bare
 * `export { TaskCalendarView } from './task-calendar-view'`). This page route
 * is new in this project's routing (mirrors
 * `app/talent-management/mobility-and-succession/page.tsx` and every other
 * ported feature area): it just mounts the ported `TaskCalendarView`. No
 * `<Suspense>` needed — the component reads no `useSearchParams()`.
 */

import { TaskCalendarView } from './components'

export default function TaskCalendarPage() {
  return <TaskCalendarView />
}
