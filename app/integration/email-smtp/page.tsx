'use client'

/**
 * Standalone Integration route for the Email SMTP card.
 * Reuses the existing /easy_com/smtp screen unmodified — same component,
 * same APIs.
 */

import { IntegrationBackLink } from '@/app/task-management/administration/integration/components/integration-back-link'
import SmtpPage from '@/app/easy_com/smtp/page'

export default function IntegrationEmailSmtpPage() {
  return (
    <>
      <IntegrationBackLink />
      <SmtpPage />
    </>
  )
}
