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
import { SampleBadge } from '@/app/platform-services/_components/shell'
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

  const knownKeys = new Set(INTEGRATION_PROVIDERS.map((provider) => provider.key))
  const otherConfigs = configs.filter((config) => !knownKeys.has(config.provider_key))

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

      {!loading && otherConfigs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Other saved integrations</h2>
          <p className="text-xs text-slate-600">
            Configured for this institute but not one of the providers above.
          </p>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {otherConfigs.map((config) => (
              <li key={config.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{config.display_name}</span>
                  <span className="font-mono text-xs text-slate-500">{config.provider_key}</span>
                  <SampleBadge show={config.is_sample === true} />
                </span>
                <span className="text-xs capitalize text-slate-600">
                  {config.category} - {config.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageFrame>
  )
}
