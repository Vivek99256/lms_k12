'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BAND_ORDER,
  fetchChapterMastery,
  fetchConceptResult,
  type ChapterMastery,
  type ConceptDiagnosticResult,
  type ConceptMasteryRow,
} from '@/app/pal/data/pal-diagnostic';
import {
  chapterCompletionFromRows,
  isConceptCompleted,
  isConceptMeasurable,
  signalsFromConceptResult,
  signalsFromMasteryRow,
  NO_COMPLETION,
  type ChapterCompletion,
} from '@/app/pal/data/pal-completion';
import { BandChip, BandRow, bandLabel } from '@/app/pal/_components/BandMeter';

/**
 * The read-only face of a completed concept or chapter.
 *
 * ---------------------------------------------------------------------------
 * WHAT "READ ONLY" MEANS HERE
 * ---------------------------------------------------------------------------
 * A completed concept shows its mastery and nothing else: no question set, no
 * lesson, no "practise again", no control that would record a further answer.
 * The panels below carry no callbacks and no forms by construction - there is
 * nothing on them to press - so a screen that renders one in place of its own
 * content is read-only without having to remember to disable anything.
 *
 * Navigation out is deliberately still allowed. Read-only is not a trap: a
 * learner who lands on a completed concept must be able to leave it.
 *
 * The completion rule itself is not here - it lives in
 * app/pal/data/pal-completion.ts, shared with every screen that has to make
 * the same call.
 */

// --- badges ----------------------------------------------------------------

export function CompletedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800',
        className
      )}
    >
      <CheckCircle2 aria-hidden className="h-3 w-3" />
      Completed
    </span>
  );
}

export function ReadOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-500',
        className
      )}
    >
      <Lock aria-hidden className="h-3 w-3" />
      Read only
    </span>
  );
}

// --- loading completion ----------------------------------------------------

export interface ConceptCompletionState {
  result: ConceptDiagnosticResult | null;
  completed: boolean;
  loading: boolean;
}

/**
 * Is this ONE concept completed, and what is its mastery?
 *
 * The concept result carries the ladder, so the same request answers both the
 * question and what to render in place of the screen's own content.
 *
 * A failure is swallowed on purpose. Completion is an overlay on a screen that
 * already has its own data and its own error handling; a learner who cannot
 * reach this endpoint should see the ordinary screen, not an error page in
 * front of a lesson that loaded perfectly well.
 */
export function useConceptCompletion(conceptId: string): ConceptCompletionState {
  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    // Deferred - the convention across app/pal, and what
    // react-hooks/set-state-in-effect enforces.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setResult(null);
      if (!conceptId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      fetchConceptResult(conceptId, controller.signal)
        .then(setResult)
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  return { result, completed: isConceptCompleted(signalsFromConceptResult(result)), loading };
}

export interface ChapterCompletionState {
  mastery: ChapterMastery | null;
  completion: ChapterCompletion;
  loading: boolean;
  reload: () => void;
}

/**
 * Is this chapter completed, and where does each of its concepts stand?
 *
 * `enabled` exists for the subject list, where staff browsing a student's
 * chapters must not fire a mastery request that the backend would answer for
 * the staff member's own user id.
 */
export function useChapterCompletion(chapterId: string, enabled = true): ChapterCompletionState {
  const [mastery, setMastery] = useState<ChapterMastery | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !chapterId) {
        setMastery(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      fetchChapterMastery(chapterId, controller.signal)
        .then(setMastery)
        // Swallowed for the same reason as above: no completion verdict means
        // the ordinary screen, never an error in front of working content.
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId, enabled, attempt]);

  return {
    mastery,
    completion: mastery ? chapterCompletionFromRows(mastery.concepts) : NO_COMPLETION,
    loading,
    reload,
  };
}

// --- completed concept -----------------------------------------------------

/**
 * Everything a learner may see about a concept they have finished: how they
 * answered, which rungs of the ladder they cleared, and the ladder's own
 * sentence about why it signed the concept off.
 *
 * Deliberately no controls. See the note at the top of this file.
 */
export function CompletedConceptPanel({ result }: { result: ConceptDiagnosticResult }) {
  const cleared = result.ladder.bandsCleared.map((band) => band.toLowerCase());
  const unavailable = result.ladder.bandsUnavailable.map((band) => band.toLowerCase());
  const pct = Math.round(result.accuracy);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-900">
                <Trophy aria-hidden className="h-4 w-4" />
                Concept completed
                <CompletedBadge />
              </p>
              <p className="mt-1.5 text-sm text-emerald-900">
                {/* A concept with no hard questions written completes on the
                    engine's verdict alone, so it is not told it cleared a
                    level that was never served. */}
                {cleared.includes('hard')
                  ? `You cleared every level up to ${bandLabel('hard').toLowerCase()} and mastery has been signed off.`
                  : 'Mastery has been signed off on every level this concept has questions for.'}{' '}
                There is nothing left to do on this concept.
              </p>
            </div>

            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums text-emerald-900">{pct}%</p>
              <p className="text-xs text-emerald-800">
                {result.correct} correct of {result.attempted}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Level by level</CardTitle>
            <CardDescription>How you answered at each difficulty.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {BAND_ORDER.map((band) => {
              const stats = result.byDifficulty[band];
              const stock = result.availability[band] ?? 0;

              return (
                <BandRow
                  key={band}
                  band={band}
                  correct={stats?.correct ?? 0}
                  served={stock === 0 ? 0 : (stats?.attempted ?? 0)}
                  percentage={stats?.accuracy ?? 0}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mastery</CardTitle>
            {/* The ladder's own words, so this screen and the plan can never
                explain the same verdict differently. */}
            <CardDescription>{result.ladder.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {BAND_ORDER.map((band) => {
                const done = cleared.includes(band);

                return (
                  <li key={band} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span aria-hidden className="h-4 w-4 rounded-full border border-slate-300" />
                      )}
                      <span className="text-slate-700">{bandLabel(band)}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {done
                        ? 'Cleared'
                        : unavailable.includes(band)
                          ? 'No questions written'
                          : 'Not required'}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">
                  {result.attempted}
                </dd>
                <dt className="text-[11px] text-slate-500">Questions answered</dt>
              </div>
              <div>
                <dd className="text-lg font-semibold tabular-nums text-emerald-700">
                  {result.correct}
                </dd>
                <dt className="text-[11px] text-slate-500">Correct</dt>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- completed chapter -----------------------------------------------------

/**
 * Everything a learner may see about a chapter they have finished: the tally,
 * and each concept with the evidence behind it. The per-concept "practise" and
 * "revisit" routes the ordinary mastery screen offers are absent, because a
 * completed chapter is closed.
 */
export function CompletedChapterPanel({
  mastery,
  completion,
}: {
  mastery: ChapterMastery;
  completion: ChapterCompletion;
}) {
  const concepts = [...mastery.concepts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-900">
                <Trophy aria-hidden className="h-4 w-4" />
                Chapter completed
                <CompletedBadge />
              </p>
              <p className="mt-1.5 text-sm text-emerald-900">
                Every concept in {mastery.chapterName || 'this chapter'} is completed &mdash; each
                one shown at every level available and signed off. This chapter is now read only.
              </p>
              {completion.unmeasurable > 0 && (
                <p className="mt-1.5 text-xs text-emerald-800">
                  {completion.unmeasurable} concept{completion.unmeasurable === 1 ? '' : 's'} could
                  not be measured &mdash; a gap in the question bank, not something you missed.
                </p>
              )}
            </div>

            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums text-emerald-900">
                {completion.completed}
              </p>
              <p className="text-xs text-emerald-800">
                of {completion.measurable} concept{completion.measurable === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chapter mastery</CardTitle>
          <CardDescription>
            Concept by concept, from your own answers. Nothing here can be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100">
            {concepts.map((concept) => (
              <CompletedConceptRow key={concept.conceptId} concept={concept} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CompletedConceptRow({ concept }: { concept: ConceptMasteryRow }) {
  const completed = isConceptCompleted(signalsFromMasteryRow(concept));
  const measurable = isConceptMeasurable(concept);
  const pct = concept.pMastery === null ? null : Math.round(concept.pMastery * 100);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {completed ? (
            <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-slate-300" />
          )}
          <span className="text-sm font-medium text-slate-900">{concept.name}</span>
          {completed ? (
            <CompletedBadge />
          ) : !measurable ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              No questions yet
            </span>
          ) : null}
          {concept.band && <BandChip band={concept.band} />}
        </div>

        <p className="mt-1 pl-6 text-xs text-slate-600">{concept.ladder.reason}</p>
      </div>

      {pct !== null && (
        <div className="w-24 shrink-0">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-slate-500">Estimate</span>
            <span className="text-xs font-semibold tabular-nums text-slate-800">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full', completed ? 'bg-emerald-600' : 'bg-indigo-600')}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${concept.name} mastery estimate`}
            />
          </div>
          {concept.attempts > 0 && (
            <p className="mt-0.5 text-[10px] text-slate-400">
              {concept.correct}/{concept.attempts} answered
            </p>
          )}
        </div>
      )}
    </li>
  );
}
