'use client'

/**
 * Task Management > My Tasks route. Mounts the ported `MyTasksCenter` (from
 * G2G's `MyTasksView`), mirroring the recruitment page's shape
 * (`app/talent-management/recruitment/page.tsx`). No `<Suspense>` needed -
 * `MyTasksCenter` does not read `useSearchParams()`.
 */

import { PageFrame } from '../_components/task-shared'
import { MyTasksCenter } from './components/my-tasks-center'

export default function MyTasksPage() {
  return (
    <PageFrame>
      <MyTasksCenter />
    </PageFrame>
  )
}
