'use client'

/**
 * Ported from G2G's `components/domain/competency/cm-certifications.tsx`
 * (mounted there directly; this route is new in this project's routing,
 * mirroring `recruitment/page.tsx`). `CertificationsCenter` reads
 * `useSearchParams()` via `useCompetencyFocus()` (for the `?competency_id=`/
 * `?competency=` drill-through from the Competency Library), which Next.js
 * requires to be wrapped in a `<Suspense>` boundary.
 */

import { Suspense } from 'react'
import { CertificationsCenter } from './components/certifications-center'

export default function CertificationsPage() {
  return (
    <Suspense fallback={null}>
      <CertificationsCenter />
    </Suspense>
  )
}
