'use client'

/**
 * Standalone-page content for a /integration/* route whose provider has no
 * dedicated settings screen yet. Renders the same IntegrationConfigForm and
 * useIntegrationManagement (via context) used everywhere else in the
 * Integration module, with its own header and back button since (unlike
 * the reused screens) this form ships no header of its own — a placeholder
 * route, not a placeholder implementation, so it becomes the real screen
 * the moment one exists without any caller having to change.
 */

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageFrame, PageHeader } from '@/app/task-management/_components/task-shared'
import { useIntegrationContext } from '@/app/task-management/_lib/integration-context'
import { IntegrationConfigForm } from './integration-config-form'
import { INTEGRATION_PROVIDERS } from './integration-providers'
import type { IntegrationConfigPayload } from '@/app/task-management/_lib/integration-types'

export function IntegrationProviderConfigPage({ providerKey }: { providerKey: string }) {
  const router = useRouter()
  const { configs, save, testConnection, remove, saving, testing, canAdminister } = useIntegrationContext()

  const provider = INTEGRATION_PROVIDERS.find((p) => p.key === providerKey)
  if (!provider) return null

  const config = configs.find((c) => c.provider_key === providerKey)

  const handleSave = async (payload: IntegrationConfigPayload) => {
    await save(payload, config?.id)
  }

  return (
    <PageFrame>
      <PageHeader
        title={provider.name}
        description={provider.description}
        action={
          <Button variant="outline" size="sm" onClick={() => router.push('/integration')}>
            <ArrowLeft className="h-4 w-4" />
            Back to Integration
          </Button>
        }
      />
      <IntegrationConfigForm
        key={config?.id ?? providerKey}
        provider={provider}
        config={config}
        onSave={handleSave}
        onTest={testConnection}
        onRemove={config ? remove : undefined}
        saving={saving}
        testing={testing}
        canAdminister={canAdminister}
      />
    </PageFrame>
  )
}
