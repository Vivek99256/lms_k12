'use client'

/**
 * Assessments — top-level screen for LMS Operations (tab=637).
 *
 * Provides a clean switch between:
 * 1. "Assessment workspace" (campaigns, review cycles, participant matrix, calibration, approvals)
 * 2. "My assessment (Take Test)" (interactive question paper, timer, submission & competency results)
 *
 * Styled with primary brand color #5846EA.
 */

import { useMemo, useState } from 'react'
import { ClipboardList, GraduationCap } from 'lucide-react'
import { buildSessionContext } from '@/lib/erp-client'
import { cn } from '@/lib/utils'
import { AssessmentWorkspace } from './assessment-workspace'
import { MyAssessment } from './my-assessment'

type ScreenTab = 'workspace' | 'mine'

export function AssessmentsScreen() {
  const session = useMemo(() => buildSessionContext(), [])
  const [tab, setTab] = useState<ScreenTab>('workspace')

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        ['--primary' as string]: '#5846EA',
        ['--primary-foreground' as string]: '#ffffff',
      }}
    >
      <div className="flex items-center gap-6 border-b border-border px-6 pt-4 bg-white/70 backdrop-blur-xs">
        {([
          ['workspace', 'Assessment workspace', ClipboardList],
          ['mine', 'My assessment (Take Test)', GraduationCap],
        ] as const).map(([id, label, Icon]) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 pb-3 text-sm font-semibold transition-colors relative cursor-pointer',
                isActive ? 'text-[#5846EA]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('size-4', isActive ? 'text-[#5846EA]' : 'text-muted-foreground')} />
              {label}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-[#5846EA]" />
              )}
            </button>
          )
        })}
      </div>

      {tab === 'workspace' ? (
        <AssessmentWorkspace />
      ) : (
        <div className="p-6">
          <MyAssessment />
        </div>
      )}
    </div>
  )
}

