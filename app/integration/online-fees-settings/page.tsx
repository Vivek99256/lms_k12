'use client'

/**
 * Standalone Integration route for the Razorpay payment-gateway card.
 * Reuses the existing Fees "Online fees settings" screen unmodified — same
 * component, same APIs, same business logic.
 */

import { IntegrationBackLink } from '@/app/task-management/administration/integration/components/integration-back-link'
import OnlineFeesSettingsPage from '@/app/fees/online-fees-settings/page'

export default function IntegrationOnlineFeesSettingsPage() {
  return (
    <>
      <IntegrationBackLink />
      <OnlineFeesSettingsPage />
    </>
  )
}
