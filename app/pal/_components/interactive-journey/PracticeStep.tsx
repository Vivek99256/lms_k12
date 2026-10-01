'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Loader2, Target, X, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import { canPlay, selectedOptionId, toPlayerQuestion } from '@/lib/pal/diagnostic-answers';
import {
  fetchAdaptiveQuestions,
  submitAdaptiveAnswer,
  type AdaptiveAnswerOutcome,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';

/**
 * Step 7 — Practice. Fully generic: reads whatever the EXISTING adaptive-
 * practice endpoints serve for this conceptId, and grades through the SAME
 * endpoints every other adaptive-practice screen in PAL already uses. No new
 * grading, no new question type, nothing authored per concept — this is why
 * Practice needs no recipe content at all (see generate.ts).
 *
 * A concept with no question-bank items yet shows that plainly, the same way
 * the rest of PAL already does, rather than inventing a question or
 * blocking the journey from finishing.
 */
export function PracticeStep({ conceptId, onDone }: { conceptId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState<DiagnosticQuestionItem | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AdaptiveAnswerOutcome | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setLoadError(null);
      fetchAdaptiveQuestions(conceptId, 1, controller.signal)
        .then((set) => setQuestion(set.items[0] ?? null))
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setLoadError(reason instanceof Error ? reason.message : 'The practice question could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [conceptId]);

  const playable = useMemo(() => (question ? canPlay(question) : false), [question]);

  const handlePlayerResult = useCallback(
    (result: QuestionResult) => {
      if (!question) return;
      const optionId = selectedOptionId(question, result);
      if (optionId) setSelected(optionId);
    },
    [question]
  );

  const submit = useCallback(async () => {
    if (!question || !selected || submitting || outcome) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitAdaptiveAnswer({ conceptId, questionId: question.questionId, answerMasterId: selected });
      setOutcome(result);
    } catch (reason: unknown) {
      setSubmitError(reason instanceof Error ? reason.message : 'Your answer could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  }, [question, selected, submitting, outcome, conceptId]);

  const correctOption = question?.options.find((o) => o.id === outcome?.correctAnswerId) ?? null;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Target aria-hidden className="h-3.5 w-3.5" />
          Did it make sense? One question, from the question bank
        </p>

        {loading && (
          <div className="mt-4 flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            Loading a question for this concept…
          </div>
        )}

        {!loading && loadError && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
        )}

        {!loading && !loadError && !question && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm text-slate-700">
              Practice questions for this topic are on their way. You've already done the important part —
              understanding it. Continue when you're ready.
            </p>
          </div>
        )}

        {!loading && question && (
          <div className="mt-3">
            {playable ? (
              <QuestionPlayer question={toPlayerQuestion(question)} onResult={handlePlayerResult} embedded instantFeedback={false} />
            ) : (
              <>
                <div className="text-sm font-medium text-slate-900 [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: question.title }} />
                <div className="mt-2.5 space-y-1.5">
                  {question.options.map((option) => {
                    const isSelected = selected === option.id;
                    const isCorrectOption = outcome ? option.id === outcome.correctAnswerId : false;
                    const isWrongPick = outcome ? isSelected && !outcome.isCorrect : false;

                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                          outcome
                            ? isCorrectOption
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : isWrongPick
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : 'border-slate-200 text-slate-500'
                            : isSelected
                              ? 'cursor-pointer border-indigo-400 bg-indigo-50 font-semibold text-indigo-900'
                              : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        <input
                          type="radio"
                          name={`journey-practice-${question.questionId}`}
                          checked={isSelected}
                          disabled={Boolean(outcome) || submitting}
                          onChange={() => setSelected(option.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                        />
                        <span className="min-w-0 flex-1 [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: option.answer }} />
                        {outcome && isCorrectOption && <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                        {outcome && isWrongPick && <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {submitError && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
            )}

            {outcome && (
              <div className={cn('mt-4 rounded-xl border px-4 py-3', outcome.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
                <p className={cn('flex items-center gap-1.5 text-sm font-semibold', outcome.isCorrect ? 'text-emerald-800' : 'text-amber-800')}>
                  {outcome.isCorrect ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <XCircle aria-hidden className="h-4 w-4" />}
                  {outcome.isCorrect ? 'Correct' : 'Not quite'}
                </p>
                {!outcome.isCorrect && correctOption && (
                  <p className="mt-1 text-xs text-amber-900 [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: `Correct answer: ${correctOption.answer}` }} />
                )}
                {outcome.feedback && (
                  <p className="mt-1.5 text-xs text-slate-700 [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: outcome.feedback }} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {!outcome && question ? (
          <Button size="sm" onClick={() => void submit()} disabled={!selected || submitting}>
            {submitting && <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Check my answer
          </Button>
        ) : (
          <Button size="sm" onClick={onDone} disabled={loading}>
            Finish this topic
          </Button>
        )}
      </div>
    </section>
  );
}
