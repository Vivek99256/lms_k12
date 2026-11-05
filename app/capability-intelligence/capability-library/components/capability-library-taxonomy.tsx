'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLibraryMeta } from '../../_lib/use-libraries-taxonomy'
import type { LibraryTabId } from '../../_lib/libraries-taxonomy-api'

import { LIBRARY_TABS, tabConfig } from './library-config'
import { LibraryTab } from './library-tab'

const TAB_THEMES: Record<string, { activeText: string; activeBorder: string; badge: string; iconColor: string }> = {
  skill: {
    activeText: 'text-violet-600 dark:text-violet-400 font-bold',
    activeBorder: 'border-violet-600 dark:border-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    iconColor: 'text-violet-600',
  },
  jobrole: {
    activeText: 'text-blue-600 dark:text-blue-400 font-bold',
    activeBorder: 'border-blue-600 dark:border-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    iconColor: 'text-blue-600',
  },
  'jobrole-task': {
    activeText: 'text-emerald-600 dark:text-emerald-400 font-bold',
    activeBorder: 'border-emerald-600 dark:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    iconColor: 'text-emerald-600',
  },
  knowledge: {
    activeText: 'text-amber-600 dark:text-amber-400 font-bold',
    activeBorder: 'border-amber-600 dark:border-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    iconColor: 'text-amber-600',
  },
  ability: {
    activeText: 'text-orange-600 dark:text-orange-400 font-bold',
    activeBorder: 'border-orange-600 dark:border-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
    iconColor: 'text-orange-600',
  },
  attitude: {
    activeText: 'text-rose-600 dark:text-rose-400 font-bold',
    activeBorder: 'border-rose-600 dark:border-rose-400',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    iconColor: 'text-rose-600',
  },
  behaviour: {
    activeText: 'text-pink-600 dark:text-pink-400 font-bold',
    activeBorder: 'border-pink-600 dark:border-pink-400',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300',
    iconColor: 'text-pink-600',
  },
  invisible: {
    activeText: 'text-indigo-600 dark:text-indigo-400 font-bold',
    activeBorder: 'border-indigo-600 dark:border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
    iconColor: 'text-indigo-600',
  },
}

/**
 * Capability Library — Libraries & Taxonomy.
 *
 * Ported from G2G's `components/domain/competency/cm-libraries-taxonomy.tsx`
 * (the `Cm` prefix dropped per this migration's naming convention).
 *
 * The source libraries the competency model is built from - Job Role, Job Role
 * Task, Knowledge, Ability, Attitude, Behaviour and Invisible - behind one tab
 * strip, each with its own taxonomy editor.
 */
export function CapabilityLibraryTaxonomy() {
  const [activeTab, setActiveTab] = useState<LibraryTabId>('skill')
  const { meta, loading: metaLoading } = useLibraryMeta()

  const config = tabConfig(activeTab)

  return (
    <div
      style={{
        '--primary': '#4F46E5',
        '--primary-foreground': '#ffffff',
        '--ring': '#4F46E5',
      } as React.CSSProperties}
      className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Capability</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The building blocks every competency is assembled from: job roles, tasks, and the knowledge, ability, behaviour and attitude items behind them.
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div
        className="g2g-scrollbar -mx-1 flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800"
        role="tablist"
        aria-label="Library"
      >
        {LIBRARY_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const count = meta.counts?.[tab.id]

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all',
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
              {metaLoading ? (
                <Skeleton className="h-4 w-8 rounded-full" />
              ) : count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count.toLocaleString()}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="-mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">{config.description}</p>

      {/* Only the active tab is mounted */}
      <LibraryTab key={activeTab} config={config} meta={meta} active />
    </div>
  )
}
