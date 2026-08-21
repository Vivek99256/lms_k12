'use client'

/**
 * Ported from G2G's `components/domain/competency/cm-development-career.tsx`
 * (`CmDevelopmentCareer`). This page route is new in this project's routing
 * (mirrors `recruitment/page.tsx` and every other talent-management feature
 * area): it just mounts the ported `DevelopmentCareerCenter`.
 *
 * `DevelopmentCareerCenter` reads `useCompetencyFocus()` (via
 * `../../_lib/use-competency-focus`), which calls `useSearchParams()` for the
 * `?competency_id=&competency=` drill-through from the Competency Library —
 * Next.js requires that to be wrapped in a `<Suspense>` boundary, same as
 * `recruitment/page.tsx`.
 */

import { Suspense } from 'react'
import { DevelopmentCareerCenter } from './components/development-career-center'

export default function DevelopmentAndCareerPathsPage() {
  return (
    <Suspense fallback={null}>
      <DevelopmentCareerCenter />
    </Suspense>
  )
}
