'use client'

/**
 * Ported from G2G's `components/domain/task/tm-integrations.tsx`.
 *
 * Shows the integrations this backend actually has (n8n task webhook, Gemini
 * generation, FCM push) and whether each is configured — read live from the
 * server, which never exposes the keys themselves.
 *
 * Configuration happens in .env on purpose: these are server credentials, and
 * editing them from a browser form would put secrets in the request log.
 *
 * Adaptation: `taskService` + `getLaravelContext()` -> `useIntegrations()`
 * (`../../../_lib/use-administration.ts`).
 */

import { CheckCircle2, CircleOff, Link2, Webhook } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { PageFrame, PageHeader, InlineMessage } from '../../../_components/task-shared'
import { useIntegrations } from '../../../_lib/use-administration'

export function IntegrationCenter() {
  const { integrations, loading, error } = useIntegrations()

  return (
    <PageFrame>
      <PageHeader
        title="Integrations & webhooks"
        description="Configured server-side via environment variables. Keys are never shown here."
        action={<Link2 className="h-6 w-6 text-primary" />}
      />

      {error && <InlineMessage type="error" text={error} />}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.key}
              className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                    <Webhook className="h-6 w-6" />
                  </div>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold',
                      integration.configured
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {integration.configured
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> Configured</>
                      : <><CircleOff className="h-3.5 w-3.5" /> Not configured</>}
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-foreground">{integration.name}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{integration.description}</p>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {integration.configured ? 'Managed via ' : 'Enable by setting '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{integration.env}</code>
                  {' '}in the server environment.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  )
}
