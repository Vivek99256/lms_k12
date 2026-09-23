'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchDiagnosticAssessment,
  submitDiagnosticAssessment,
  type DiagnosticConceptResult,
  type DiagnosticData,
  type DiagnosticSubmitResult,
  type PalChapterContext,
} from '@/app/pal/data/pal';

/**
 * "Take diagnostic" — the onboarding assessment step of the learning journey
 * (Learn -> Diagnose -> Determine mastery -> Adapt -> Progress). Distinct from
 * the "Adaptive practice" panel: it doesn't narrow toward a known mastery
 * level, it samples the chapter's concepts plus their prerequisites across
 * the DOK range, then classifies each concept as mastered / partial / gap /
 * prerequisite gap once scored.
 */
export function DiagnosticButton({
  studentId,
  context,
}: {
  studentId: string;
  context: PalChapterContext;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-violet-200 text-violet-700 hover:bg-violet-50"
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        Take diagnostic
      </Button>
      {open && (
        <DiagnosticModal studentId={studentId} context={context} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

const DOK_LABEL: Record<number, string> = {
  1: 'DOK 1 · Recall',
  2: 'DOK 2 · Skill/concept',
  3: 'DOK 3 · Strategic thinking',
  4: 'DOK 4 · Extended thinking',
};

function QuestionMetaBadges({ bloomLevel, dokLevel, difficulty }: { bloomLevel: string; dokLevel: number; difficulty: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {difficulty && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          {difficulty}
        </span>
      )}
      {bloomLevel && (
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
          {bloomLevel}
        </span>
      )}
      {dokLevel > 0 && (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {DOK_LABEL[dokLevel] ?? `DOK ${dokLevel}`}
        </span>
      )}
    </div>
  );
}

function DiagnosticModal({
  studentId,
  context,
  onClose,
}: {
  studentId: string;
  context: PalChapterContext;
  onClose: () => void;
}) {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticSubmitResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setAnswers({});
      try {
        const response = await fetchDiagnosticAssessment(
          { studentId, standardId: context.standardId, subjectId: context.subjectId, chapterId: context.chapterId },
          controller.signal
        );
        if (!controller.signal.aborted) setData(response);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load the diagnostic assessment.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [studentId, context, reloadKey]);

  const conceptNameById = useMemo(() => {
    const map = new Map<string, string>();
    data?.questions.forEach((q) => {
      if (q.conceptId) map.set(q.conceptId, q.conceptName || q.conceptId);
    });
    return map;
  }, [data]);

  const toggleAnswer = (questionId: string, multiple: boolean, optionId: string) => {
    setAnswers((prev) => {
      if (multiple) {
        const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: optionId };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      setResult(await submitDiagnosticAssessment({ studentId, answers }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the diagnostic assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const questions = data?.questions ?? [];
  const answeredCount = Object.values(answers).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Diagnostic assessment</h2>
              <p className="text-xs text-slate-500">
                {context.chapterId
                  ? 'Establishes what you already know before you start this chapter.'
                  : 'Establishes what you already know.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building your diagnostic...
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && result && (
            <DiagnosticResult
              result={result}
              conceptNameById={conceptNameById}
              onRetake={() => setReloadKey((key) => key + 1)}
            />
          )}

          {!loading && !error && !result && questions.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No diagnostic questions are available for this chapter yet.
            </div>
          )}

          {!loading && !error && !result && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {question.conceptName && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {question.conceptName}
                          </span>
                        )}
                        <QuestionMetaBadges
                          bloomLevel={question.bloomLevel}
                          dokLevel={question.dokLevel}
                          difficulty={question.difficulty}
                        />
                      </div>
                      <div
                        className="mt-1.5 text-sm font-medium text-slate-900 [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: question.title }}
                      />
                      {question.options.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {question.options.map((option) => {
                            const selected = question.multipleAnswer
                              ? Array.isArray(answers[question.id]) &&
                                (answers[question.id] as string[]).includes(option.id)
                              : answers[question.id] === option.id;
                            return (
                              <label
                                key={option.id}
                                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                  selected
                                    ? 'border-violet-400 bg-violet-50 text-violet-900'
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type={question.multipleAnswer ? 'checkbox' : 'radio'}
                                  name={`diagnostic-${question.id}`}
                                  checked={selected}
                                  onChange={() => toggleAnswer(question.id, question.multipleAnswer, option.id)}
                                  className="h-4 w-4 accent-violet-600"
                                />
                                <span className="[&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: option.answer }} />
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs italic text-slate-400">
                          This question type is not answerable here.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {answeredCount} of {questions.length} answered
                </span>
                <Button onClick={handleSubmit} disabled={submitting || answeredCount === 0}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  Submit diagnostic
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case 'mastered':
      return { label: 'Mastered', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    case 'partial':
      return { label: 'Partial', badge: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'prerequisite_gap':
      return { label: 'Prerequisite gap', badge: 'border-rose-300 bg-rose-100 text-rose-800' };
    case 'gap':
    default:
      return { label: 'Gap', badge: 'border-rose-200 bg-rose-50 text-rose-700' };
  }
}

function DiagnosticResult({
  result,
  conceptNameById,
  onRetake,
}: {
  result: DiagnosticSubmitResult;
  conceptNameById: Map<string, string>;
  onRetake: () => void;
}) {
  const prerequisiteGaps = result.concepts.filter((c) => c.status === 'prerequisite_gap');

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-6">
        <Sparkles className="h-8 w-8 text-violet-600" />
        <div className="text-sm font-semibold text-violet-800">Diagnostic complete</div>
        <p className="max-w-sm text-center text-xs text-violet-700">
          Here&apos;s where you stand on each concept probed &mdash; this seeds your mastery
          record for adaptive practice going forward.
        </p>
      </div>

      {prerequisiteGaps.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {prerequisiteGaps.length === 1 ? 'One concept looks' : `${prerequisiteGaps.length} concepts look`}{' '}
            weak because of a prerequisite gap, not the concept itself &mdash; review the earlier
            material first.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {result.concepts.map((concept: DiagnosticConceptResult) => {
          const style = statusStyle(concept.status);
          return (
            <div
              key={concept.conceptId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">
                  {conceptNameById.get(concept.conceptId) || `Concept ${concept.conceptId}`}
                </div>
                <div className="text-[11px] text-slate-400">
                  {concept.correct}/{concept.total} correct this sitting &middot; {concept.accuracy}% accuracy
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="text-xs tabular-nums text-slate-500"
                  title="Mastery estimate across your full history for this concept, not just this sitting"
                >
                  {concept.bktMastery}% mastery
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onRetake}>
          <RotateCcw className="h-4 w-4" />
          Retake diagnostic
        </Button>
      </div>
    </div>
  );
}
