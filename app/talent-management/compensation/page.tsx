'use client'

/**
 * Talent Management -> Compensation.
 *
 * G2G's `content-map-m3.ts` routes the Compensation sidebar entry (menu id
 * '50') straight to the same `PerformanceCenter` component as "Performance
 * Reviews & Appraisals" — it is a fully working screen there, not a stub.
 * Separately, G2G's shell (`components/shell/gtg-app-shell.tsx`) carries a
 * `COMING_SOON_CONTENT` map keyed by menu id, with an entry for '50':
 *
 *   { title: 'Compensation', description: 'Manage salaries, bonuses, and
 *     equity grants. Coming soon.' }
 *
 * That map only renders as a full-screen takeover when NO route resolves for
 * the active menu item — which never happens for Compensation, since its
 * route always resolves. So in practice G2G ships this entry as the complete
 * Performance & Rewards Center with no visible "coming soon" treatment at
 * all.
 *
 * Per the migration brief ("shows a 'coming soon' placeholder overlay... on
 * top of the same underlying Performance component"), this port reuses the
 * exact same `PerformanceCenter` component (no reimplementation) and
 * surfaces G2G's `COMING_SOON_CONTENT['50']` copy verbatim as a banner at the
 * top of the screen via `PerformanceCenter`'s `comingSoon` prop — see
 * `ComingSoonBanner` in `../performance-reviews-and-appraisals/components/performance-center.tsx`.
 * The screen underneath remains fully functional, matching G2G's actual
 * routed behaviour.
 */

import { PerformanceCenter } from '../performance-reviews-and-appraisals/components'

const COMPENSATION_COMING_SOON = {
  title: 'Compensation',
  description: 'Manage salaries, bonuses, and equity grants. Coming soon.',
}

export default function CompensationPage() {
  return <PerformanceCenter comingSoon={COMPENSATION_COMING_SOON} />
}
