'use client'

/**
 * Ported from G2G's
 * `components/domain/talent/mobility-succession/index.ts` (a bare
 * `export { MobilityCenter } from './mobility-center'`). The page route is
 * new in this project (Mobility & Succession did not have a dedicated Next.js
 * route in G2G, only the domain component) - it simply mounts the ported
 * `MobilityCenter` component, matching how every other page-level screen in
 * this project wraps its ported G2G component.
 */

import { MobilityCenter } from './components'

export default function MobilityAndSuccessionPage() {
  return <MobilityCenter />
}
