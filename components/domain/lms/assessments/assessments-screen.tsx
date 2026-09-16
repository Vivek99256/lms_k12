'use client'

/**
 * Assessments — top-level screen for `app/people-competency/lms/assessments`.
 *
 * g2gv0 mounted `CmAssessmentWorkspace` (admin/HR) and `CmMyAssessment`
 * (employee) as separate routes/screens. This package's page contract is a
 * single `/people-competency/lms/assessments` route, so this thin wrapper
 * adds the one piece of IA g2gv0 did not need: a two-tab switch between the
 * administer view and "My assessment", gated the same way Administration &
 * Governance gates its own writes — on `session.isAdmin` from
 * `buildSessionContext()` (this repo has no dedicated role/auth hook yet).
 * A non-admin session sees only "My assessment".
 */

import { useMemo, useState } from 'react'
import { ClipboardList, User } from 'lucide-react'
import { buildSessionContext } from '@/lib/erp-client'
import { cn } from '@/lib/utils'
import { AssessmentWorkspace } from './assessment-workspace'
import { MyAssessment } from './my-assessment'

type ScreenTab = 'workspace' | 'mine'

export function AssessmentsScreen() {
  const session = useMemo(() => buildSessionContext(), [])
  const canAdminister = session.isAdmin === '1' || session.isAdmin === 'true' || session.isAdmin === '1.0'
  const [tab, setTab] = useState<ScreenTab>(canAdminister ? 'workspace' : 'mine')

  if (!canAdminister) {
    return (
      <div className="p-6">
        <MyAssessment />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-6 border-b border-border px-6 pt-4">
        {([
          ['workspace', 'Assessment workspace', ClipboardList],
          ['mine', 'My assessment', User],
        ] as const).map(([id, label, Icon]) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 pb-3 text-sm font-semibold transition-colors relative',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      {tab === 'workspace' ? <AssessmentWorkspace /> : (
        <div className="p-6">
          <MyAssessment />
        </div>
      )}
    </div>
  )
}
