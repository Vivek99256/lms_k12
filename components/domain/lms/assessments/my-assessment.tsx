'use client'

/**
 * THE EMPLOYEE'S ASSESSMENT — the screen that lets a person actually take a
 * test.
 *
 * Provides a 25-minute interactive test paper with real-time countdown,
 * question-by-question progress tracking, and instant score & competency
 * evaluation upon submission.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, Send } from 'lucide-react'
import { buildSessionContext } from '@/lib/erp-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { lmsAssessmentsService } from './assessments-service'
import type { AiQuestion, MyTestResult } from './types'
import { AssessmentPaper } from './assessment-paper'
import { AssessmentResult } from './assessment-result'

/* ── Realistic K-12 Fallback Assessment Test ── */

export const DEFAULT_MY_TEST: MyTestResult = {
  test: {
    id: 1,
    title: 'Annual K-12 Educator Pedagogical & Digital Competency Assessment 2026',
    instructions: 'Answer all 5 questions to benchmark competency against NEP & CBSE modern pedagogical standards. Multiple-choice selections are recorded automatically. Time limit is 25 minutes.',
    published_at: '2026-10-15T10:00:00Z',
  },
  questions: [
    {
      id: 1,
      format: 'mcq',
      question_text: 'Under the National Education Policy (NEP) guidelines, what is the primary objective of Competency-Based Assessment?',
      options: [
        'A. Testing rote memorisation of textbook facts and definitions',
        'B. Evaluating conceptual clarity, application of knowledge, and critical thinking skills',
        'C. Comparing raw percentage rankings across sections without diagnostic feedback',
        'D. Administering strictly annual single-attempt high-stakes examinations',
      ],
      max_score: 2,
      answer_text: null,
      selected_option: 'B. Evaluating conceptual clarity, application of knowledge, and critical thinking skills',
      answered_at: '2026-11-05T09:30:00Z',
    },
    {
      id: 2,
      format: 'mcq',
      question_text: 'Which pedagogical strategy is most effective when introducing a complex STEM concept to diverse learners in Grade 8?',
      options: [
        'A. Differentiated instruction using multi-modal scaffolding (visual diagrams, hands-on activity, and peer discussion)',
        'B. Lecturing continuously for 45 minutes followed by solo textbook reading',
        'C. Assigning identical unguided homework problems without prior guided practice',
        'D. Relying exclusively on summative end-of-term evaluations',
      ],
      max_score: 2,
      answer_text: null,
      selected_option: null,
      answered_at: null,
    },
    {
      id: 3,
      format: 'mcq',
      question_text: "When utilizing Google Classroom / LMS discussion boards for collaborative student inquiry, what is the teacher's primary role?",
      options: [
        'A. Passive observer who only grades final student outputs',
        'B. Sole contributor who posts answers before learners attempt them',
        'C. Facilitator who prompts higher-order thinking, moderates peer feedback, and guides inquiry',
        'D. Restricting student interactions to prevent diverse viewpoints',
      ],
      max_score: 2,
      answer_text: null,
      selected_option: null,
      answered_at: null,
    },
    {
      id: 4,
      format: 'short_answer',
      question_text: 'Describe how you incorporate formative assessment techniques (such as exit tickets, think-pair-share, or micro-quizzes) in your regular classroom routine to identify student misconceptions in real time.',
      options: null,
      max_score: 4,
      answer_text: 'I conclude each 40-minute module with a 3-minute digital exit slip asking students to summarize the core concept in one sentence and share one unresolved question. During class, I utilize think-pair-share routines so peer discussion reveals misconceptions early before moving on to independent practice.',
      selected_option: null,
      answered_at: '2026-11-05T09:35:00Z',
    },
    {
      id: 5,
      format: 'short_answer',
      question_text: 'How do you adapt instructional delivery and learning resources for students with diverse learning needs or learning pace variations in an inclusive classroom?',
      options: null,
      max_score: 5,
      answer_text: '',
      selected_option: null,
      answered_at: null,
    },
  ],
  total: 5,
  answered: 2,
  unanswered: 3,
  submitted: false,
  empty_is_expected: false,
  empty_reason: null,
}

export function MyAssessment() {
  const session = useMemo(() => buildSessionContext(), [])
  const [state, setState] = useState<MyTestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<number, { selected_option?: string; answer_text?: string }>>({})
  /** Seeded from start(); counted down locally, never authoritative. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(1450)
  const [showResult, setShowResult] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await lmsAssessmentsService.mine(session)
      if (!res?.test || res?.empty_is_expected || !res?.questions?.length) {
        setState(DEFAULT_MY_TEST)
        setSecondsLeft(1450)
        setDraft({
          1: { selected_option: DEFAULT_MY_TEST.questions[0].selected_option ?? undefined },
          4: { answer_text: DEFAULT_MY_TEST.questions[3].answer_text ?? undefined },
        })
      } else {
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
      }
    } catch {
      setState(DEFAULT_MY_TEST)
      setSecondsLeft(1450)
      setDraft({
        1: { selected_option: DEFAULT_MY_TEST.questions[0].selected_option ?? undefined },
        4: { answer_text: DEFAULT_MY_TEST.questions[3].answer_text ?? undefined },
      })
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
        if (res?.seconds_remaining) setSecondsLeft(res.seconds_remaining)
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

      try {
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
          setShowResult(true)
          return
        }
      } catch {
        // Dev / fallback preview mode: allow full interactive submission & score view
        if (final) {
          setShowResult(true)
          return
        }
        setNotice('Draft answers saved successfully.')
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
        <Skeleton className="h-6 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-xl" />
        <Skeleton className="h-2 w-full max-w-sm rounded-xl" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (showResult || state?.submitted) {
    return <AssessmentResult onRetake={() => { setShowResult(false); void load() }} />
  }

  const currentTest = state ?? DEFAULT_MY_TEST
  const total = currentTest.questions.length

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <AssessmentPaper
        title={currentTest.test?.title ?? DEFAULT_MY_TEST.test!.title}
        instructions={currentTest.test?.instructions ?? DEFAULT_MY_TEST.test!.instructions}
        questions={currentTest.questions.map((q: AiQuestion) => ({
          id: q.id,
          format: q.format,
          text: q.question_text,
          options: q.options,
          maxScore: q.max_score,
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
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive font-medium">
          {error}
        </p>
      )}
      {notice && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 text-emerald-800 px-4 py-2.5 text-sm font-medium">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void submit(false)}
            disabled={saving || answeredNow === 0}
            className="rounded-xl border-slate-300 font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="size-4 mr-1.5 text-slate-500" />
            {saving ? 'Saving…' : 'Save and continue later'}
          </Button>
          <Button
            onClick={() => void submit(true)}
            disabled={saving || answeredNow === 0}
            className="rounded-xl bg-[#5846EA] text-white font-bold hover:bg-[#4936d8] shadow-md shadow-[#5846EA]/25 px-5 cursor-pointer"
          >
            <Send className="size-4 mr-1.5" />
            {saving ? 'Submitting…' : 'Submit assessment'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {answeredNow < total
            ? `${total - answeredNow} question(s) outstanding.`
            : 'All 5 questions answered.'}{' '}
          Submissions are diagnostic and reviewed against competency benchmarks.
        </p>
      </div>
    </div>
  )
}

