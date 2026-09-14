'use client'

/**
 * Shares one IntegrationProvider (configs/save/remove/test) across every
 * /integration/* route via React context, so navigating from the listing
 * to a detail page and back doesn't re-fetch. Renders no visual chrome of
 * its own — the card grid lives only on app/integration/page.tsx, and each
 * detail route is a fully separate page, not content mounted underneath it.
 */

import type { ReactNode } from 'react'

import { IntegrationProvider } from '@/app/task-management/_lib/integration-context'

export default function IntegrationLayout({ children }: { children: ReactNode }) {
  return <IntegrationProvider>{children}</IntegrationProvider>
}
