'use client'

/**
 * Ported as-is from G2G's `components/shared/business/shared.tsx` (`Tabs`
 * export only — `SectionCard`, `ReadField`, `FormField` are not part of the
 * HRIT scaffold and were left behind). Target has no existing `Tabs`
 * primitive under `components/ui/`, so this is ported as a new HRIT-scoped
 * component rather than overwriting anything. Only the `cn` import path was
 * adapted; behavior and classes are unchanged.
 */

import { cn } from '@/lib/utils'

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px h-10 px-4 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
