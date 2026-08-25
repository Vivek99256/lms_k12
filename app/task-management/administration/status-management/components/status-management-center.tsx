'use client'

/**
 * Administration > Status Management.
 *
 * Source treats status + priority management as two sibling components
 * (`tm-status-management.tsx`, `tm-priority-management.tsx`) under one
 * Administration menu group; combined here onto one page as two sections/
 * tabs, per this port's routing rule.
 */

import { useState } from 'react'
import { Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PageFrame, PageHeader } from '../../../_components/task-shared'
import { StatusSection } from './status-section'
import { PrioritySection } from './priority-section'

type Section = 'statuses' | 'priorities'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'statuses', label: 'Status management' },
  { id: 'priorities', label: 'Priority management' },
]

export function StatusManagementCenter() {
  const [section, setSection] = useState<Section>('statuses')

  return (
    <PageFrame>
      <PageHeader
        title="Status & priority management"
        description="Manage the tenant's status and priority vocabularies used across every task."
      />

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors',
              section === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Settings2 className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {section === 'statuses' ? <StatusSection /> : <PrioritySection />}
      </div>
    </PageFrame>
  )
}
