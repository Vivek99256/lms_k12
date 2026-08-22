'use client'

/**
 * Ported from G2G's `components/domain/talent/offboarding/index.ts` (a bare
 * `export { OffboardingCenter } from './offboarding-center'`). The page route
 * is new in this project (Offboarding did not have a dedicated Next.js route
 * in G2G, only the domain component) - it simply mounts the ported
 * `OffboardingCenter` component, matching how every other page-level screen
 * in this project wraps its ported G2G component (e.g.
 * `mobility-and-succession/page.tsx`).
 */

import { OffboardingCenter } from './components/offboarding-center'

export default function OffboardingPage() {
  return <OffboardingCenter />
}
