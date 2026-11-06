'use client'

/**
 * The paper itself — questions, progress, the clock. Presentational only.
 *
 * Styled with primary brand color #5846EA and clean card containers.
 */

import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, Radio } from '@/components/ui/g2g/radio-group'
import { Textarea } from '@/components/ui/textarea'

export type PaperQuestion = {
  id: number
  /** 'mcq' | 'short_answer' | 'coding'. Widened so a new format renders as prose rather than vanishing. */
  format: string
  text: string
  /** mcq only. */
  options?: string[] | null
  maxScore?: number | null
  /** Shows the "changing it replaces your earlier answer" note. */
  previouslyAnswered?: boolean
}

export type PaperAnswer = { selectedOption?: string; text?: string }

export function AssessmentPaper({
  title,
  instructions,
  questions,
  answers,
  onAnswer,
  secondsLeft = null,
  disabled = false,
  className,
}: {
  title: string
  instructions?: string | null
  questions: PaperQuestion[]
  answers: Record<number, PaperAnswer>
  onAnswer: (questionId: number, value: PaperAnswer) => void
  /** null when the test is untimed — not 0, which would read as "no time left". */
  secondsLeft?: number | null
  disabled?: boolean
  className?: string
}) {
  const total = questions.length
  const answered = questions.filter((q) => {
    const a = answers[q.id]
    return Boolean(a?.selectedOption || a?.text?.trim())
  }).length

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
          {instructions && <p className="mt-1 text-sm text-slate-600 leading-relaxed">{instructions}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="flex-1 max-w-md flex items-center gap-3">
            <Progress
              value={total ? (answered / total) * 100 : 0}
              className="h-2.5 rounded-full bg-slate-100 [&>div]:bg-[#5846EA]"
            />
            <span className="text-xs font-semibold tabular-nums text-slate-700 shrink-0">
              {Math.round(total ? (answered / total) * 100 : 0)}%
            </span>
          </div>

          <span className="text-xs font-medium tabular-nums text-slate-500">
            {answered} of {total} answered · {total - answered} outstanding
          </span>

          {secondsLeft !== null && (
            <span
              className={cn(
                'ml-auto flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold tabular-nums shadow-2xs',
                secondsLeft <= 60
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : secondsLeft <= 300
                    ? 'border-warning/40 bg-warning/10 text-warning'
                    : 'border-indigo-100 bg-indigo-50 text-[#5846EA]',
              )}
            >
              <Clock3 className="size-3.5" aria-hidden="true" />
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} remaining
            </span>
          )}
        </div>

        {secondsLeft !== null && secondsLeft <= 60 && (
          <p className="text-xs font-medium text-destructive">
            When time expires, your current answers are automatically submitted.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs transition-all hover:border-[#5846EA]/30"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex items-center justify-center rounded-lg bg-indigo-50 text-[#5846EA] px-2.5 py-0.5 text-xs font-bold shrink-0">
                    Q{index + 1}
                  </span>
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {q.text}
                  </p>
                </div>
                {q.maxScore ? (
                  <span className="shrink-0 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#5846EA]">
                    {q.maxScore} {q.maxScore === 1 ? 'mark' : 'marks'}
                  </span>
                ) : null}
              </div>

              {q.format === 'mcq' && q.options ? (
                <div className="pl-9 pt-1">
                  <RadioGroup
                    value={answers[q.id]?.selectedOption ?? ''}
                    onValueChange={(v) => onAnswer(q.id, { selectedOption: v })}
                    disabled={disabled}
                    className="space-y-2.5"
                  >
                    {q.options.map((opt) => (
                      <Radio key={opt} value={opt} label={opt} />
                    ))}
                  </RadioGroup>
                </div>
              ) : (
                <div className="pl-9 pt-1">
                  <Textarea
                    rows={q.format === 'coding' ? 10 : 4}
                    placeholder={q.format === 'coding' ? 'Write your solution here…' : 'Enter your pedagogical reasoning…'}
                    value={answers[q.id]?.text ?? ''}
                    disabled={disabled}
                    onChange={(e) => onAnswer(q.id, { text: e.target.value })}
                    className={cn(
                      'rounded-xl border-slate-200 focus:border-[#5846EA] focus:ring-[#5846EA]',
                      q.format === 'coding' && 'font-mono text-[13px] leading-relaxed',
                    )}
                    spellCheck={q.format !== 'coding'}
                    autoCapitalize={q.format === 'coding' ? 'off' : undefined}
                    autoCorrect={q.format === 'coding' ? 'off' : undefined}
                  />
                </div>
              )}

              {q.previouslyAnswered && (
                <p className="pl-9 text-xs text-muted-foreground">
                  Saved. You can modify your answer anytime before final submission.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
