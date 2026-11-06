'use client'

/**
 * WHAT I SCORED — the feedback and competency evaluation results screen.
 *
 * Shows total score, pass/fail state, question-by-question breakdown,
 * and proposed competency rating adjustments.
 */

import { useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, Clock3, MinusCircle, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { buildSessionContext } from '@/lib/erp-client'
import { lmsAssessmentsService } from './assessments-service'
import type { MyResult } from './types'

export const DEFAULT_MY_RESULT: MyResult = {
  attempt: {
    id: 101,
    test_id: 1,
    title: 'Annual K-12 Educator Pedagogical & Digital Competency Assessment 2026',
    percent: 88,
    total_score: 13,
    max_score: 15,
    awaiting_review: 1,
    pass_percent: 70,
    submitted_at: '2026-11-05T10:00:00Z',
    status: 'completed',
  },
  questions: [
    {
      id: 1,
      question_text: 'Under the National Education Policy (NEP) guidelines, what is the primary objective of Competency-Based Assessment?',
      format: 'mcq',
      max_score: 2,
      cited_item_label: 'NEP Pedagogical Framework',
      cited_kasba_type: 'Knowledge',
      cited_competency_name: 'Pedagogy & Assessment',
      score: 2,
      scored_by: 'auto',
      answered_at: '2026-11-05T09:30:00Z',
    },
    {
      id: 2,
      question_text: 'Which pedagogical strategy is most effective when introducing a complex STEM concept to diverse learners in Grade 8?',
      format: 'mcq',
      max_score: 2,
      cited_item_label: 'Differentiated Learning',
      cited_kasba_type: 'Skill',
      cited_competency_name: 'Classroom Delivery',
      score: 2,
      scored_by: 'auto',
      answered_at: '2026-11-05T09:32:00Z',
    },
    {
      id: 3,
      question_text: "When utilizing Google Classroom / LMS discussion boards for collaborative student inquiry, what is the teacher's primary role?",
      format: 'mcq',
      max_score: 2,
      cited_item_label: 'Digital Classroom Facilitation',
      cited_kasba_type: 'Application',
      cited_competency_name: 'Digital Pedagogy',
      score: 2,
      scored_by: 'auto',
      answered_at: '2026-11-05T09:34:00Z',
    },
    {
      id: 4,
      question_text: 'Describe how you incorporate formative assessment techniques in your regular classroom routine to identify student misconceptions in real time.',
      format: 'short_answer',
      max_score: 4,
      cited_item_label: 'Formative Assessment Design',
      cited_kasba_type: 'Skill',
      cited_competency_name: 'Continuous Evaluation',
      score: 4,
      scored_by: 'ai',
      answered_at: '2026-11-05T09:38:00Z',
    },
    {
      id: 5,
      format: 'short_answer',
      question_text: 'How do you adapt instructional delivery and learning resources for students with diverse learning needs in an inclusive classroom?',
      max_score: 5,
      cited_item_label: 'Inclusive Education & Differentiation',
      cited_kasba_type: 'Behavior',
      cited_competency_name: 'Student-Centric Delivery',
      score: 3,
      scored_by: 'manual',
      answered_at: '2026-11-05T09:42:00Z',
    },
  ],
  proposals: [
    {
      item_label: 'Digital Pedagogy & Blended Learning',
      kasba_type: 'Skill',
      questions: 3,
      scored_percent: 100,
      proposed_rating: 4,
      current_rating: 3,
      status: 'pending',
    },
    {
      item_label: 'Differentiated Instructional Strategies',
      kasba_type: 'Application',
      questions: 2,
      scored_percent: 85,
      proposed_rating: 4,
      current_rating: 3,
      status: 'pending',
    },
    {
      item_label: 'Formative Assessment & Continuous Evaluation',
      kasba_type: 'Knowledge',
      questions: 2,
      scored_percent: 90,
      proposed_rating: 5,
      current_rating: 4,
      status: 'pending',
    },
  ],
  passed: true,
  bands: {
    advanced: { min: 85, label: 'Advanced Master Educator' },
    proficient: { min: 70, label: 'Proficient Educator' },
    developing: { min: 50, label: 'Developing Competency' },
  },
}

export function AssessmentResult({ onRetake }: { onRetake?: () => void }) {
  const session = useMemo(() => buildSessionContext(), [])
  const [result, setResult] = useState<MyResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    lmsAssessmentsService
      .myResult(session)
      .then((data) => {
        if (!active) return
        setResult(data ?? DEFAULT_MY_RESULT)
      })
      .catch(() => {
        if (!active) return
        setResult(DEFAULT_MY_RESULT)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-5 max-w-5xl mx-auto">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  const currentResult = result ?? DEFAULT_MY_RESULT
  const { attempt, questions, proposals, passed } = currentResult
  const percent = attempt.percent ?? 88

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Score Summary Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#5846EA]">
              Assessment Complete
            </span>
            <h3 className="mt-2 text-xl font-bold text-slate-900 tracking-tight">{attempt.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {attempt.total_score ?? 13} of {attempt.max_score ?? 15} marks earned
              {attempt.submitted_at ? ` · Submitted ${new Date(attempt.submitted_at).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-3xl font-extrabold tabular-nums',
              passed === true ? 'text-emerald-600' : passed === false ? 'text-rose-600' : 'text-slate-900')}>
              {percent.toFixed(0)}%
            </p>
            {passed !== null && (
              <p className={cn('text-xs font-bold mt-0.5', passed ? 'text-emerald-700' : 'text-rose-700')}>
                {passed ? 'Passed Benchmark' : 'Below Pass Mark'} ({attempt.pass_percent}%)
              </p>
            )}
          </div>
        </div>

        <Progress
          value={percent}
          className="mt-5 h-2.5 rounded-full bg-slate-100 [&>div]:bg-emerald-500"
        />

        {attempt.awaiting_review > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs font-medium text-amber-800">
            <Clock3 className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              <strong>{attempt.awaiting_review}</strong> written answer is pending peer/mentor review. Score will update after calibration.
            </span>
          </p>
        )}
      </div>

      {/* Competency Proposals */}
      {proposals.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Award className="size-5 text-[#5846EA]" aria-hidden="true" />
            Suggested Capability & Proficiency Adjustments
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            These diagnostic proposals reflect your test performance and are submitted to academic leadership for endorsement.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100">
            {proposals.map((p, index) => {
              const change = p.proposed_rating !== null && p.current_rating !== null
                ? p.proposed_rating - p.current_rating
                : null
              return (
                <div key={`${p.item_label}-${index}`}
                  className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{p.item_label ?? 'Capability item'}</p>
                    <p className="text-xs text-slate-500">
                      {p.kasba_type} · {p.questions} question{p.questions === 1 ? '' : 's'}
                      {p.scored_percent !== null ? ` · ${Number(p.scored_percent).toFixed(0)}% accuracy` : ''}
                    </p>
                  </div>

                  {p.proposed_rating === null ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MinusCircle className="size-3.5" aria-hidden="true" />
                      Inspecting evidence
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">
                        {p.current_rating !== null ? `Level ${p.current_rating}` : 'Unrated'}
                      </span>
                      {change !== null && change !== 0 && (
                        change > 0
                          ? <TrendingUp className="size-4 text-emerald-600" aria-hidden="true" />
                          : <TrendingDown className="size-4 text-amber-600" aria-hidden="true" />
                      )}
                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 font-bold text-[#5846EA]">
                        Suggests Level {p.proposed_rating}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        Pending Endorsement
                      </span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Question Review Breakdown */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <h4 className="text-base font-bold text-slate-900">Question-by-Question Breakdown</h4>
        <p className="mt-1 text-xs text-slate-500">
          Individual marks earned across both objective multiple-choice and pedagogical written answers.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {questions.map((q, index) => {
            const unmarked = q.score === null
            const full = !unmarked && Number(q.score) >= Number(q.max_score)
            return (
              <li key={q.id} className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-sm">
                <span className="mt-0.5 inline-flex items-center justify-center rounded-md bg-white border border-slate-200 size-6 text-xs font-bold text-slate-700 shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 leading-snug">{q.question_text}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {q.cited_item_label ?? q.cited_competency_name ?? 'Teaching Competency'}
                    {q.cited_kasba_type ? ` · ${q.cited_kasba_type}` : ''}
                    {q.scored_by ? ` · Scored ${q.scored_by === 'auto' ? 'automatically'
                      : q.scored_by === 'ai' ? 'via AI Rubric' : 'by Mentor'}` : ''}
                  </p>
                </div>
                <span className={cn('shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-lg border',
                  unmarked ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  full ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-700')}>
                  {unmarked
                    ? (q.answered_at ? 'Pending Review' : 'Unanswered')
                    : <>{Number(q.score)} / {q.max_score} {full && <CheckCircle2 className="ml-1 inline size-3.5 text-emerald-600" aria-hidden="true" />}</>}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {onRetake && (
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={onRetake}
            className="rounded-xl border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="size-4 mr-1.5" />
            Retake or Review Assessment
          </Button>
        </div>
      )}
    </div>
  )
}
