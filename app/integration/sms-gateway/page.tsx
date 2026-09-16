'use client'

/**
 * Standalone Integration route for the SMS Gateway card.
 * Reuses the existing /easy_com/sms_api screen unmodified — same
 * component, same APIs.
 */

import { IntegrationBackLink } from '@/app/task-management/administration/integration/components/integration-back-link'
import SmsApiPage from '@/app/easy_com/sms_api/page'

export default function IntegrationSmsGatewayPage() {
  return (
    <>
      <IntegrationBackLink />
      <SmsApiPage />
    </>
  )
}
