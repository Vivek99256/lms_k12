'use client'

/**
 * Standalone Integration route for the Biometric Attendance card.
 * No dedicated settings screen exists yet — renders the same
 * IntegrationConfigForm every other unimplemented provider uses (Device IP
 * Address, Device Port, Device Serial Number, Sync Interval), with the
 * Test Connection / Save Configuration buttons and Last Sync Status
 * section it already provides for any provider once configured.
 */

import { IntegrationProviderConfigPage } from '@/app/task-management/administration/integration/components/integration-provider-config-page'

export default function IntegrationBiometricAttendancePage() {
  return <IntegrationProviderConfigPage providerKey="biometric_attendance" />
}
