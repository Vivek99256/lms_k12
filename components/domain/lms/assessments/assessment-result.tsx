'use client'

/**
 * WHAT I SCORED — the half of the loop that did not exist without this.
 *
 * Ported from g2gv0's `components/domain/competency/cm-assessment-result.tsx`
 * (`CmAssessmentResult`) verbatim in JSX/logic, renamed `AssessmentResult`.
 * Session plumbing changed (`useAuth()` + `getLaravelContext(user)` →
 * `buildSessionContext()`); `aiAssessmentService.myResult` →
 * `lmsAssessmentsService.myResult`.
 *
 * It does not show correct answers, does not present a proposal as an
 * applied result, and does not show an unmarked answer as zero.
 */

import { useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, Clock3, MinusCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { buildSessionContext } from '@/lib/erp-client'
import { lmsAssessmentsService } from './assessments-service'
import type { MyResult } from './types'

export function AssessmentResult({ onRetake }: { onRetake?: () => void }) {
  const session = useMemo(() => buildSessionContext(), [])
  const [result, setResult] = useState<MyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    lmsAssessmentsService
      .myResult(session)
      .then((data) => { if (active) { setResult(data); setError(null) } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Your result could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Your result could not be loaded"
        description={`${error} This is a problem loading the result, not a score of zero.`}
        retry={() => window.location.reload()}
      />
    )
  }

  if (!result) {
    return (
      <EmptyState
        icon={<Award className="size-10" />}
        title="No result yet"
        description="You have not submitted an assessment yet. Your score, and what it suggests about your capability, appear here once you do."
      />
    )
  }

  const { attempt, questions, proposals, passed } = result
  const percent = attempt.percent ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your result</p>
            <h3 className="mt-0.5 truncate text-lg font-semibold text-foreground">{attempt.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {attempt.total_score ?? 0} of {attempt.max_score ?? 0} marks
              {attempt.submitted_at ? ` · submitted ${new Date(attempt.submitted_at).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-3xl font-semibold tabular-nums',
              passed === true ? 'text-success' : passed === false ? 'text-destructive' : 'text-foreground')}>
              {percent.toFixed(0)}%
            </p>
            {passed !== null && (
              <p className={cn('text-xs font-medium', passed ? 'text-success' : 'text-destructive')}>
                {passed ? 'Passed' : 'Below the pass mark'} ({attempt.pass_percent}%)
              </p>
            )}
            {passed === null && <p className="text-xs text-muted-foreground">No pass mark set</p>}
          </div>
        </div>

        <Progress value={percent} className="mt-4" />

        {attempt.awaiting_review > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs">
            <Clock3 className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong>{attempt.awaiting_review}</strong> written answer(s) are still to be marked, so this score
              can still go up. They are <strong>not</strong> counted as zero — they are simply not counted yet.
            </span>
          </p>
        )}
      </div>

      {proposals.length > 0 && (
        <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Award className="size-4" aria-hidden="true" />
            What this suggests about your capability
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            These are <strong>proposals</strong>. Nothing on your record has changed — someone reviews each one
            before it counts.
          </p>

          <div className="mt-3 overflow-hidden rounded-md border border-border">
            {proposals.map((p, index) => {
              const change = p.proposed_rating !== null && p.current_rating !== null
                ? p.proposed_rating - p.current_rating
                : null
              return (
                <div key={`${p.item_label}-${index}`}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{p.item_label ?? 'Capability item'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.kasba_type} · {p.questions} question{p.questions === 1 ? '' : 's'}
                      {p.scored_percent !== null ? ` · ${Number(p.scored_percent).toFixed(0)}% correct` : ''}
                    </p>
                  </div>

                  {p.proposed_rating === null ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MinusCircle className="size-3.5" aria-hidden="true" />
                      too few questions to suggest a level
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {p.current_rating !== null ? `now ${p.current_rating}` : 'unrated'}
                      </span>
                      {change !== null && change !== 0 && (
                        change > 0
                          ? <TrendingUp className="size-3.5 text-success" aria-hidden="true" />
                          : <TrendingDown className="size-3.5 text-warning" aria-hidden="true" />
                      )}
                      <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                        suggests {p.proposed_rating}
                      </span>
                      <span className="text-muted-foreground">pending</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-foreground">Question by question</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Your marks. Correct answers are not shown — the assessment is still in use.
        </p>

        <ol className="mt-3 flex flex-col gap-2">
          {questions.map((q, index) => {
            const unmarked = q.score === null
            const full = !unmarked && Number(q.score) >= Number(q.max_score)
            return (
              <li key={q.id} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{q.question_text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.cited_item_label ?? q.cited_competency_name ?? 'capability item'}
                    {q.cited_kasba_type ? ` · ${q.cited_kasba_type}` : ''}
                    {q.scored_by ? ` · marked ${q.scored_by === 'auto' ? 'automatically'
                      : q.scored_by === 'ai' ? 'by AI' : 'by a person'}` : ''}
                  </p>
                </div>
                <span className={cn('shrink-0 text-xs font-medium tabular-nums',
                  unmarked ? 'text-muted-foreground' : full ? 'text-success' : 'text-warning')}>
                  {unmarked
                    ? (q.answered_at ? 'not marked yet' : 'not answered')
                    : <>{Number(q.score)} / {q.max_score}{full && <CheckCircle2 className="ml-1 inline size-3.5" aria-hidden="true" />}</>}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {onRetake && (
        <div>
          <Button variant="outline" onClick={onRetake}>Back to the assessment</Button>
        </div>
      )}
    </div>
  )
}
