'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDashed, ListChecks, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BandChip } from '@/app/pal/_components/BandMeter';
import { QuestionNavigator } from '@/app/pal/_components/DiagnosticNavigator';
import type { DiagnosticQuestionResult } from '@/app/pal/data/pal-diagnostic';
// The `.h5p-option`/`.h5p-tappable`/`.h5p-enter` classes below come from this
// stylesheet. Every other place that uses them also renders `QuestionPlayer`,
// which imports it as a side effect (see `components/h5p/players/shared.tsx`)
// -- a result page never does, so without this import the classes would be
// inert names with no matching rules loaded at all.
import '@/app/h5p/h5p.css';

/**
 * The post-submission "Review Answers" screen: every question the learner
 * saw, their pick beside the right one, and why -- the one place in PAL
 * where the answer key is meant to be fully visible, because the paper is
 * already scored and closed. See the doc comment on
 * `DiagnosticService::questionResults()` for why that boundary only applies
 * to the live, unsubmitted paper.
 *
 * A dialog rather than a route: this is a deep-dive on a result the learner
 * is already looking at, not a destination of its own, and a modal keeps
 * the result page underneath exactly as it was when they close it.
 */

type Filter = 'all' | 'correct' | 'incorrect' | 'unanswered';

const FILTERS: { key: Filter; label: string; test: (q: DiagnosticQuestionResult) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'correct', label: 'Correct', test: (q) => q.isCorrect === true },
  { key: 'incorrect', label: 'Incorrect', test: (q) => q.answered && q.isCorrect === false },
  { key: 'unanswered', label: 'Unanswered', test: (q) => !q.answered },
];

/** Each filter's own colour, selected and not -- "All" stays brand indigo
 * (it has no status of its own); the other three match the same
 * correct/incorrect/unanswered palette the question navigator below and the
 * per-question verdict chip already use, so a learner never has to learn a
 * second colour language for the same three states on one screen. */
const FILTER_TONE: Record<Filter, { selected: string; unselected: string }> = {
  all: {
    selected: 'border-indigo-600 bg-indigo-600 text-white',
    unselected: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
  },
  correct: {
    selected: 'border-emerald-600 bg-emerald-600 text-white',
    unselected: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300',
  },
  incorrect: {
    selected: 'border-rose-600 bg-rose-600 text-white',
    unselected: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300',
  },
  unanswered: {
    selected: 'border-slate-600 bg-slate-600 text-white',
    unselected: 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300',
  },
};

function verdictOf(question: DiagnosticQuestionResult) {
  if (!question.answered) {
    return { label: 'Unanswered', Icon: CircleDashed, tone: 'text-slate-500', chip: 'border-slate-200 bg-slate-50 text-slate-600' };
  }
  return question.isCorrect
    ? { label: 'Correct', Icon: CheckCircle2, tone: 'text-emerald-600', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    : { label: 'Incorrect', Icon: XCircle, tone: 'text-rose-600', chip: 'border-rose-200 bg-rose-50 text-rose-700' };
}

export function AnswerReviewButton({ results }: { results: DiagnosticQuestionResult[] }) {
  const [open, setOpen] = useState(false);

  if (results.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ListChecks aria-hidden className="mr-1.5 h-4 w-4" />
          Review answers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0 sm:rounded-2xl">
        {open && <AnswerReviewBody results={results} />}
      </DialogContent>
    </Dialog>
  );
}

function AnswerReviewBody({ results }: { results: DiagnosticQuestionResult[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [index, setIndex] = useState(0);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: results.length, correct: 0, incorrect: 0, unanswered: 0 };
    for (const q of results) {
      if (q.isCorrect === true) c.correct += 1;
      else if (q.answered && q.isCorrect === false) c.incorrect += 1;
      else if (!q.answered) c.unanswered += 1;
    }
    return c;
  }, [results]);

  const filtered = useMemo(
    () => results.filter(FILTERS.find((f) => f.key === filter)!.test),
    [results, filter]
  );

  const total = filtered.length;
  const clampedIndex = Math.min(index, Math.max(0, total - 1));
  const current = filtered[clampedIndex] ?? null;

  const changeFilter = (next: Filter) => {
    setFilter(next);
    setIndex(0);
  };

  return (
    <div className="flex flex-col">
      <DialogHeader className="border-b border-slate-100 px-5 py-4">
        <DialogTitle>Review your answers</DialogTitle>
      </DialogHeader>

      {/* Summary statistics. */}
      <div className="grid grid-cols-4 gap-2 px-5 pt-4">
        <SummaryStat label="Total" value={counts.all} tone="text-slate-900" />
        <SummaryStat label="Correct" value={counts.correct} tone="text-emerald-700" />
        <SummaryStat label="Incorrect" value={counts.incorrect} tone="text-rose-700" />
        <SummaryStat label="Unanswered" value={counts.unanswered} tone="text-slate-500" />
      </div>

      {/* Filters. */}
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => changeFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              'h5p-tappable h5p-focusable rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === f.key ? FILTER_TONE[f.key].selected : FILTER_TONE[f.key].unselected
            )}
          >
            {f.label} <span className="tabular-nums opacity-80">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {total === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          No questions match this filter.
        </p>
      ) : (
        <>
          <div className="px-5 pt-4">
            <QuestionNavigator
              items={filtered.map((q) => ({ id: q.questionId, answered: q.answered, isCorrect: q.isCorrect }))}
              currentIndex={clampedIndex}
              onJump={setIndex}
            />
          </div>

          {current && <QuestionReviewCard key={current.questionId} question={current} index={clampedIndex + 1} total={total} />}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <Button variant="outline" size="sm" onClick={() => setIndex((n) => Math.max(0, n - 1))} disabled={clampedIndex <= 0}>
              <ArrowLeft aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs font-medium tabular-nums text-slate-400">
              Question {clampedIndex + 1} of {total}
            </span>
            <Button variant="outline" size="sm" onClick={() => setIndex((n) => Math.min(total - 1, n + 1))} disabled={clampedIndex >= total - 1}>
              Next
              <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2 py-2 text-center">
      <p className={cn('text-lg font-bold tabular-nums', tone)}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function QuestionReviewCard({
  question,
  index,
  total,
}: {
  question: DiagnosticQuestionResult;
  index: number;
  total: number;
}) {
  const verdict = verdictOf(question);

  return (
    <div key={question.questionId} className="h5p-enter px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-slate-400">
            Question {index} of {total}
          </span>
          <BandChip band={question.difficulty} />
          {question.conceptName && (
            <span className="text-[11px] text-slate-400">{question.conceptName}</span>
          )}
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', verdict.chip)}>
          <verdict.Icon aria-hidden className="h-3.5 w-3.5" />
          {verdict.label}
        </span>
      </div>

      <div
        className="mb-4 text-base font-medium text-slate-900 [&_img]:max-w-full"
        dangerouslySetInnerHTML={{ __html: question.title }}
      />

      {question.options.length > 0 && (
        <div className="space-y-2">
          {question.options.map((option, optionIndex) => {
            const isSelected = option.id === question.selectedOptionId;
            const isCorrectOption = option.id === question.correctOptionId;
            const state = isCorrectOption ? 'is-correct' : isSelected ? 'is-wrong' : 'is-dimmed';

            return (
              <div
                key={option.id}
                className={cn('h5p-option flex items-start gap-2.5', state)}
              >
                <span className="h5p-option__marker" aria-hidden="true">
                  {isCorrectOption ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isSelected ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span className="min-w-0 flex-1 [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: option.answer }} />
                {isSelected && !isCorrectOption && (
                  <span className="shrink-0 text-[11px] font-semibold text-rose-600">Your answer</span>
                )}
                {isCorrectOption && (
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-600">Correct answer</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {question.explanation && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Explanation</p>
          <p className="mt-1 text-sm text-indigo-900">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
