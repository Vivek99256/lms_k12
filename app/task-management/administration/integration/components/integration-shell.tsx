'use client'

/**
 * Integration Management — card listing.
 *
 * This is the content of /integration itself: header, category filter, and
 * card grid. Clicking a card is a real navigation (router.push) to that
 * integration's own route — nothing renders inline underneath this grid.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PageFrame, PageHeader, InlineMessage } from '@/app/task-management/_components/task-shared'
import { useIntegrationContext } from '@/app/task-management/_lib/integration-context'
import { INTEGRATION_CATEGORIES, INTEGRATION_PROVIDERS } from './integration-providers'
import { IntegrationCard } from './integration-card'

export function IntegrationShell() {
  const { configs, loading, error, message, canAdminister, remove, reload } = useIntegrationContext()
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState<string>('All')

  const visibleProviders = categoryFilter === 'All'
    ? INTEGRATION_PROVIDERS
    : INTEGRATION_PROVIDERS.filter((provider) => provider.category === categoryFilter)

  return (
    <PageFrame>
      <PageHeader
        title="Integration Management"
        description="Configure and manage all third-party communication and service providers in one place."
        action={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error && <InlineMessage type="error" text={error} />}
      {message && <InlineMessage type="success" text={message} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={categoryFilter === 'All' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('All')}
        >
          All
        </Button>
        {INTEGRATION_CATEGORIES.map((category) => (
          <Button
            key={category}
            size="sm"
            variant={categoryFilter === category ? 'default' : 'outline'}
            onClick={() => setCategoryFilter(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      )}

      {!loading && (
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleProviders.map((provider) => {
            const config = configs.find((c) => c.provider_key === provider.key)
            return (
              <IntegrationCard
                key={provider.key}
                provider={provider}
                config={config}
                isSelected={false}
                onClick={() => {
                  if (provider.route) router.push(provider.route)
                }}
                onRemove={config ? () => remove(config.id) : undefined}
                canAdminister={canAdminister}
              />
            )
          })}
        </div>
      )}
    </PageFrame>
  )
}
