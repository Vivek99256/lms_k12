'use client'

/**
 * Ported from G2G's `components/domain/task/projects-list-view.tsx`
 * (`ProjectsListView`). This page route is new in this project's routing
 * (mirrors `talent-management/recruitment/page.tsx`): it just mounts the
 * ported `ProjectsCenter`. No `useSearchParams()` here, so no `<Suspense>`
 * boundary is needed.
 */

import { ProjectsCenter } from './components'
import { TaskTheme } from '../_lib/task-theme'

export default function ProjectsWorkstreamsPage() {
  return (
    <TaskTheme>
      <ProjectsCenter />
    </TaskTheme>
  )
}
