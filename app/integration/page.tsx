'use client'

/**
 * Route for Integration Management.
 * Mounted at `/integration` in the App Router — the card listing itself.
 * Clicking a card navigates to that integration's own separate route
 * (see app/integration/<provider>/page.tsx); nothing renders here inline.
 */

import { IntegrationShell } from '@/app/task-management/administration/integration/components/integration-shell'

export default function IntegrationPage() {
  return <IntegrationShell />
}
