'use client'

/**
 * Ported as-is from G2G's `components/shared/business/kpi-card.tsx`.
 *
 * Decision (KPICard vs target's `components/ui/stat-card.tsx`): NOT reused.
 * `StatCard` only supports `label`/`value`/`hint` — it has no `trend`, `icon`,
 * `unit`, or `variant` (default/primary/success/warning/danger) props. G2G's
 * HRIT dashboards (attendance/leave/payroll KPI rows) rely on the trend arrow
 * + icon + tone styling, so `StatCard` cannot serve as a drop-in replacement.
 * `KPICard` is ported here as a new, HRIT-scoped component instead of
 * modifying `stat-card.tsx`. Only the import paths are adapted; behavior,
 * classes, and props are unchanged.
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const kpiCardVariants = cva(
  'relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-card',
        primary: 'bg-primary/5',
        success: 'bg-success/5',
        warning: 'bg-warning/5',
        danger: 'bg-danger/5',
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

interface KPICardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof kpiCardVariants> {
  label: string
  value: string | number
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down'
    label?: string
  }
  icon?: React.ReactNode
  description?: string
}

const KPICard = React.forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      label,
      value,
      unit,
      trend,
      icon,
      description,
      variant,
      size,
      className,
      ...props
    },
    ref,
  ) => (
    <Card ref={ref} className={cn(kpiCardVariants({ variant, size }), className)} {...props}>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            <span
              className={cn(
                'font-semibold',
                trend.direction === 'up' ? 'text-success' : 'text-danger',
              )}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  ),
)
KPICard.displayName = 'KPICard'

export { KPICard, type KPICardProps }
