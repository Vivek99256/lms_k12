'use client'

/**
 * Nested Integration route for the Push Notification Service card.
 * No dedicated settings screen exists yet — renders the same
 * IntegrationConfigForm every other unimplemented provider uses, bound to
 * this provider's field definition, not a new one-off form.
 */

import { IntegrationProviderConfigPage } from '@/app/task-management/administration/integration/components/integration-provider-config-page'

export default function IntegrationPushNotificationPage() {
  return <IntegrationProviderConfigPage providerKey="push_notification" />
}
