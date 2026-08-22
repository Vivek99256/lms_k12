'use client'

/**
 * Ported from G2G's `components/domain/task/tm-permissions.tsx`.
 *
 * Renders the matrix the server actually enforces: profiles come from
 * tbluserprofilemaster and the ability list mirrors TaskPermissionMiddleware.
 *
 * Deliberately read-only: the rule (e.g. Employee is denied privileged
 * abilities) lives in middleware code, so an editable matrix here would be
 * another lie. Per-tenant permission editing needs a storage decision first.
 *
 * Adaptation: `taskService` + `getLaravelContext()` -> `usePermissionsMatrix()`
 * (`../../../_lib/use-administration.ts`).
 */

import { Check, ShieldCheck, X } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { PageFrame, PageHeader, InlineMessage } from '../../../_components/task-shared'
import { usePermissionsMatrix } from '../../../_lib/use-administration'

export function PermissionsMatrixCenter() {
  const { profiles, abilities, note, loading, error } = usePermissionsMatrix()

  return (
    <PageFrame>
      <PageHeader
        title="Permissions matrix"
        description={note || 'The permission matrix exactly as the middleware enforces it.'}
      />

      {error && <InlineMessage type="error" text={error} />}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div
            className="grid border-b border-primary/10 bg-primary/5"
            style={{ gridTemplateColumns: `2fr repeat(${profiles.length}, 1fr)` }}
          >
            <div className="flex items-center gap-2 p-4 text-sm font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Capability
            </div>
            {profiles.map((profile) => (
              <div key={profile} className="flex items-center justify-center p-4 text-sm font-bold text-primary">
                {profile}
              </div>
            ))}
          </div>

          {abilities.map((ability) => (
            <div
              key={ability.key}
              className="grid border-t border-primary/5 transition-colors hover:bg-primary/5"
              style={{ gridTemplateColumns: `2fr repeat(${profiles.length}, 1fr)` }}
            >
              <div className="flex items-center p-4 text-sm font-bold text-foreground">{ability.label}</div>
              {profiles.map((profile) => {
                const allowed = ability.roles[profile] ?? false

                return (
                  <div key={profile} className="flex items-center justify-center p-4">
                    <span
                      title={`${profile} ${allowed ? 'can' : 'cannot'}: ${ability.label}`}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm',
                        allowed
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground/40',
                      )}
                    >
                      {allowed ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-4 w-4" />}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  )
}
