'use client'

import { Bell, CreditCard, Fingerprint, Mail, MessageCircle, MessageSquare, XCircle, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { IntegrationConfig, IntegrationProviderDef } from '@/app/task-management/_lib/integration-types'

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  MessageCircle,
  Mail,
  Bell,
  CreditCard,
  Fingerprint,
}

function variantForStatus(configured: boolean, status?: string): 'active' | 'inactive' | 'error' | 'processing' {
  if (!configured || !status) return 'inactive'
  if (status === 'active') return 'active'
  if (status === 'error') return 'error'
  return 'processing'
}

export function IntegrationCard({
  provider,
  config,
  isSelected,
  onClick,
  onRemove,
  canAdminister,
}: {
  provider: IntegrationProviderDef
  config?: IntegrationConfig
  isSelected: boolean
  onClick: () => void
  onRemove?: () => void
  canAdminister: boolean
}) {
  const configured = Boolean(config)
  const status = config?.status ?? 'inactive'
  const statusLabel = configured
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : 'Not Configured'
  const badgeVariant = variantForStatus(configured, status)
  const ProviderIcon = PROVIDER_ICONS[provider.icon] ?? MessageSquare

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200',
        isSelected
          ? 'border-primary/40 bg-primary/5 shadow-md ring-2 ring-primary/20'
          : 'border-slate-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md',
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
            <ProviderIcon className="size-6" style={{ color: '#4f46e5' }} aria-hidden="true" />
          </div>
          <StatusBadge variant={badgeVariant} status={statusLabel}>
            {statusLabel}
          </StatusBadge>
        </div>

        <div className="mt-4">
          <h3 className="text-base font-bold text-slate-950">{provider.name}</h3>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {provider.category}
          </span>
        </div>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{provider.description}</p>

        {configured && config?.last_updated_at && (
          <p className="mt-3 text-xs text-muted-foreground">
            Updated {new Date(config.last_updated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 p-4">
        <Button
          size="sm"
          variant={isSelected ? 'default' : 'outline'}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          disabled={!canAdminister}
        >
          {configured ? 'Edit' : 'Configure'}
        </Button>
        {configured && canAdminister && onRemove && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Remove ${provider.name} configuration? This cannot be undone.`)) {
                onRemove()
              }
            }}
            aria-label={`Remove ${provider.name}`}
          >
            <XCircle className="size-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  )
}