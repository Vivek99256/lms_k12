'use client'

/**
 * Ported from G2G's
 * `components/domain/talent/recruitment/index.ts` (a bare set of exports —
 * `RecruitmentCenter`, `CandidateDetailPanel`, `CandidateCard`). This page
 * route is new in this project's routing (mirrors
 * `mobility-and-succession/page.tsx` and every other talent-management
 * feature area): it just mounts the ported `RecruitmentCenter`.
 *
 * `RecruitmentCenter` reads `useSearchParams()` (for the `?tab=`/`?action=`
 * deep links the Talent Dashboard's Quick Links use), which Next.js requires
 * to be wrapped in a `<Suspense>` boundary — `mobility-and-succession/page.tsx`
 * didn't need one since its component doesn't read search params.
 */

import { Suspense } from 'react'
import { RecruitmentCenter } from './components/recruitment-center'

export default function RecruitmentPage() {
  return (
    <Suspense fallback={null}>
      <RecruitmentCenter />
    </Suspense>
  )
}
