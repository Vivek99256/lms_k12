'use client'

/**
 * Standalone Integration route for the WhatsApp API card.
 * Reuses the existing /easy_com/whatsapp_api screen unmodified — same
 * component, same APIs.
 */

import { IntegrationBackLink } from '@/app/task-management/administration/integration/components/integration-back-link'
import WhatsAppApiPage from '@/app/easy_com/whatsapp_api/page'

export default function IntegrationWhatsAppApiPage() {
  return (
    <>
      <IntegrationBackLink />
      <WhatsAppApiPage />
    </>
  )
}
