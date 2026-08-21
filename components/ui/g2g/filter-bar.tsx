'use client'

/**
 * Ported as-is from G2G's `components/ui/filter-bar.tsx`. Imports repointed
 * to the shared `@/components/ui/g2g/*` primitives (Button, Input, Select,
 * Badge) so this stays visually identical to every other ported G2G screen -
 * see `components/ui/g2g/button.tsx` for why those, and not the native
 * components, are used. Behavior, props and classes are otherwise unchanged.
 */
import * as React from 'react'
import { Button } from '@/components/ui/g2g/button'
import { Input } from '@/components/ui/g2g/input'
import { Select } from '@/components/ui/g2g/select'
import { Badge } from '@/components/ui/g2g/badge'
import { cn } from '@/lib/utils'

interface FilterOption {
  id: string
  label: string
  value: string
}

interface Filter {
  id: string
  label: string
  type: 'search' | 'select' | 'date' | 'multiselect'
  options?: FilterOption[]
  value?: string | string[]
  onChange: (value: string | string[]) => void
  /** 'select' only - overrides the default `w-40` trigger width, e.g. for options with long labels. */
  triggerClassName?: string
  /** 'select' only - floor for the dropdown panel width (defaults to the trigger width). */
  minPanelWidthPx?: number
  /** 'select' only - extra classes for the dropdown panel, e.g. a taller `max-h-*` to show more options at once. */
  panelClassName?: string
  /** 'select' only - wrap long option labels onto multiple lines instead of truncating them to one line. */
  wrapOptionLabels?: boolean
}

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: Filter[]
  onReset?: () => void
  onApply?: () => void
  loading?: boolean
}

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  ({ filters, onReset, onApply, loading, className, ...props }, ref) => {
    const activeFilters = filters.filter((f) => f.value)

    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        <div className="flex flex-wrap gap-2 items-end justify-end">
          {filters.map((filter) => (
            <div key={filter.id} className={cn("flex flex-col gap-1", filter.type === 'search' && "mr-auto")}>
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === 'search' && (
                <Input
                  placeholder="Search..."
                  value={filter.value as string}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-96 max-w-[100vw]"
                />
              )}
              {filter.type === 'select' && (
                <Select
                  value={filter.value as string}
                  onChange={(val) => filter.onChange(val)}
                  className={cn('w-40', filter.triggerClassName)}
                  minPanelWidthPx={filter.minPanelWidthPx}
                  panelClassName={filter.panelClassName}
                  wrapOptionLabels={filter.wrapOptionLabels}
                  options={[
                    { label: 'All', value: '' },
                    ...(filter.options || []).map(opt => ({ label: opt.label, value: opt.value }))
                  ]}
                />
              )}
              {filter.type === 'date' && (
                <input
                  type="date"
                  value={filter.value as string}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-card"
                />
              )}
            </div>
          ))}
          {onApply && (
            <Button onClick={onApply} size="sm" disabled={loading}>
              Apply Filters
            </Button>
          )}
          {onReset && activeFilters.length > 0 && (
            <Button onClick={onReset} variant="outline" size="sm">
              Reset
            </Button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {activeFilters.map((filter) => (
              <Badge key={filter.id} variant="secondary">
                {filter.label}: {filter.value}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  },
)
FilterBar.displayName = 'FilterBar'

export { FilterBar, type FilterBarProps, type Filter }
