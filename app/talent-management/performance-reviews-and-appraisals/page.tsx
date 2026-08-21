'use client'

/**
 * Talent Management -> Performance Reviews & Appraisals.
 *
 * Ported from G2G's `app/(dashboard)/talent-management/performance-reviews-and-appraisals/page.tsx`
 * (a thin wrapper around `PerformanceCenter`, resolved via
 * `content-map-m3.ts`'s `/module/talent-management/performance-reviews-and-appraisals`
 * route). See `components/performance-center.tsx` for the actual screen.
 */

import { PerformanceCenter } from './components'

export default function PerformanceReviewsAndAppraisalsPage() {
  return <PerformanceCenter />
}
