'use client'

/**
 * THE EMPLOYEE'S ASSESSMENT — the screen that lets a person actually take a
 * test.
 *
 * Ported from g2gv0's `components/domain/competency/cm-my-assessment.tsx`
 * (`CmMyAssessment`) verbatim in JSX/logic, renamed `MyAssessment`. Session
 * plumbing changed (`useAuth()` + `getLaravelContext(user)` →
 * `buildSessionContext()`); `aiAssessmentService` → `lmsAssessmentsService`.
 *
 * SECURITY IS THE ENDPOINT'S SHAPE, NOT THIS COMPONENT'S LOGIC — `mine()` and
 * `submitAnswers()` take no user id; the server derives who you are from the
 * session token. Correct answers never arrive in the payload.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { buildSessionContext } from '@/lib/erp-client'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { lmsAssessmentsService } from './assessments-service'
import type { AiQuestion, MyTestResult } from './types'
import { AssessmentPaper } from './assessment-paper'
import { AssessmentResult } from './assessment-result'

export function MyAssessment() {
  const session = useMemo(() => buildSessionContext(), [])
  const [state, setState] = useState<MyTestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<number, { selected_option?: string; answer_text?: string }>>({})
  /** Seeded from start(); counted down locally, never authoritative. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await lmsAssessmentsService.mine(session)
      setState(res)
      const seeded: Record<number, { selected_option?: string; answer_text?: string }> = {}
      for (const q of res.questions ?? []) {
        if (q.selected_option !== null || q.answer_text !== null) {
          seeded[q.id] = {
            selected_option: q.selected_option ?? undefined,
            answer_text: q.answer_text ?? undefined,
          }
        }
      }
      setDraft(seeded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your assessment could not be loaded.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Opening the test starts the sitting.
  useEffect(() => {
    const testId = state?.test?.id
    if (!testId || state?.submitted) return
    let active = true
    lmsAssessmentsService
      .start(Number(testId), session)
      .then((res) => {
        if (!active) return
        setSecondsLeft(res.seconds_remaining)
      })
      .catch(() => { /* a test with no limit still works; the clock is optional */ })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.test?.id, state?.submitted])

  // One tick a second, and only while there is time to count.
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current === null ? null : Math.max(0, current - 1)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft === null])

  // Time up submits what is there.
  useEffect(() => {
    if (secondsLeft === 0 && !saving && state?.questions?.length && !state?.submitted) {
      void submit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  const answeredNow = useMemo(
    () =>
      Object.values(draft).filter(
        (d) => (d.selected_option ?? '') !== '' || (d.answer_text ?? '').trim() !== '',
      ).length,
    [draft],
  )

  async function submit(final = false) {
    if (!state?.questions?.length) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const answers = Object.entries(draft)
        .filter(([, d]) => (d.selected_option ?? '') !== '' || (d.answer_text ?? '').trim() !== '')
        .map(([id, d]) => ({
          question_id: Number(id),
          selected_option: d.selected_option ?? null,
          answer_text: d.answer_text ?? null,
        }))

      const res = await lmsAssessmentsService.submitAnswers(answers, session, final)

      setNotice(
        [
          `${res.answers_written} answer(s) recorded`,
          res.auto_scored ? `${res.auto_scored} scored automatically` : null,
          res.awaiting_review ? `${res.awaiting_review} awaiting review` : null,
          res.dropped ? `${res.dropped} not accepted` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )

      if (final && res.result) {
        if (res.result.marking_pending && res.result.attempt_id) {
          setNotice('Submitted. Marking your written answers…')
          try {
            await lmsAssessmentsService.markMine(res.result.attempt_id, session)
          } catch {
            // Left for a person to mark. Never scored zero.
          }
        }
        setShowResult(true)
        return
      }

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your answers were not saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-2 w-full max-w-sm" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }

  if (showResult || state?.submitted) {
    return <AssessmentResult onRetake={showResult ? () => { setShowResult(false); void load() } : undefined} />
  }

  if (!state?.test || state.empty_is_expected) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-6 text-muted-foreground" />}
        title="No assessment for you right now"
        description={state?.empty_reason ?? 'Nothing has been published for your job role yet.'}
      />
    )
  }

  const total = state.questions.length

  return (
    <div className="flex flex-col gap-4">
      <AssessmentPaper
        title={state.test.title}
        instructions={state.test.instructions}
        questions={state.questions.map((q: AiQuestion) => ({
          id: q.id,
          format: q.format,
          text: q.question_text,
          options: q.options,
          previouslyAnswered: Boolean(q.answered_at),
        }))}
        answers={Object.fromEntries(
          Object.entries(draft).map(([id, v]) => [
            Number(id),
            { selectedOption: v.selected_option, text: v.answer_text },
          ]),
        )}
        onAnswer={(id, v) =>
          setDraft((d) => ({
            ...d,
            [id]: v.selectedOption !== undefined
              ? { selected_option: v.selectedOption }
              : { answer_text: v.text },
          }))
        }
        secondsLeft={secondsLeft}
      />

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">{notice}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void submit(false)} disabled={saving || answeredNow === 0}>
          {saving ? 'Saving…' : 'Save and continue later'}
        </Button>
        <Button onClick={() => void submit(true)} disabled={saving || answeredNow === 0}>
          {saving ? 'Submitting…' : 'Submit assessment'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {answeredNow < total
            ? `${total - answeredNow} question(s) unanswered — those score nothing, and are not marked wrong.`
            : 'All questions answered.'}{' '}
          Submitting does not change your proficiency level; any rating it suggests is reviewed first.
        </p>
      </div>
    </div>
  )
}
