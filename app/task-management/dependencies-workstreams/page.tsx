'use client'

/**
 * Ported from G2G's `components/domain/task/dependencies-view.tsx`
 * (`DependenciesView`). This page route is new in this project's routing
 * (mirrors `talent-management/recruitment/page.tsx`): it just mounts the
 * ported `DependenciesCenter`. No `useSearchParams()` here, so no
 * `<Suspense>` boundary is needed.
 */

import { DependenciesCenter } from './components'

export default function DependenciesWorkstreamsPage() {
  return <DependenciesCenter />
}
