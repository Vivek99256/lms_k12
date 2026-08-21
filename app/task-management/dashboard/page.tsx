'use client'

/**
 * Task Management > Dashboard route. Mounts the ported `TaskDashboardCenter`
 * (from G2G's `TaskWorkspace`), mirroring the recruitment page's shape
 * (`app/talent-management/recruitment/page.tsx`). No `<Suspense>` needed —
 * unlike recruitment, `TaskDashboardCenter` does not read `useSearchParams()`.
 */

import { PageFrame } from '../_components/task-shared'
import { TaskDashboardCenter } from './components/task-dashboard-center'

export default function TaskDashboardPage() {
  return (
    <PageFrame>
      <TaskDashboardCenter />
    </PageFrame>
  )
}
