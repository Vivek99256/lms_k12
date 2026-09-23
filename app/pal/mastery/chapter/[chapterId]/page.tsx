'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Loader2, Trophy } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchChapterMastery,
  type ChapterMastery,
  type ConceptMasteryRow,
} from '@/app/pal/data/pal-diagnostic';
import {
  chapterCompletionFromRows,
  isConceptCompleted,
  signalsFromMasteryRow,
} from '@/app/pal/data/pal-completion';
import {
  CompletedBadge,
  CompletedChapterPanel,
  ReadOnlyBadge,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 10 - mastery across a chapter.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SHOWS THREE NUMBERS INSTEAD OF ONE
 * ---------------------------------------------------------------------------
 * Mastery is recorded in two stores that answer different questions, and the
 * question bank imposes a third limit on what can be proved at all:
 *
 *   - the BKT estimate over every answer (pal_concept_mastery)
 *   - the engine's own verdict, which applies an evidence floor and judges
 *     Knowledge and Application separately (learner_node_state)
 *   - the ladder, which can only test the bands that actually have questions
 *
 * These legitimately disagree. A concept on this estate sits at p_mastery 0.99
 * while the engine still holds it in `learning` and no band is cleared. Showing
 * only the flattering number would tell a learner they had mastered something
 * the system will not let them past. So the page shows the stage, and the
 * evidence behind it, and says plainly what is still outstanding.
 *
 * ---------------------------------------------------------------------------
 * COMPLETED IS NARROWER THAN MASTERED
 * ---------------------------------------------------------------------------
 * `stage: 'mastered'` is the reconciled verdict above. COMPLETED additionally
 * requires the ladder to have been climbed to hard, and it is what turns a
 * concept read-only - see app/pal/data/pal-completion.ts. So a row can read
 * "Mastered" without being completed, which is the honest answer when the hard
 * rung was never reached, and this page keeps its practice routes open in that
 * case rather than closing a concept the learner can still climb.
 */

export default function ChapterMasteryPage() {
  return (
    <Suspense fallback={<Centered>Loading your mastery…</Centered>}>
      <ChapterMasteryView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

/** Stage -> how it reads. Colour is never the only signal; each carries words. */
const STAGE: Record<string, { label: string; chip: string; rank: number }> = {
  retained: { label: 'Retained', chip: 'border-emerald-200 bg-emerald-50 text-emerald-800', rank: 0 },
  mastered: { label: 'Mastered', chip: 'border-emerald-200 bg-emerald-50 text-emerald-800', rank: 1 },
  recall_due: { label: 'Review due', chip: 'border-sky-200 bg-sky-50 text-sky-800', rank: 2 },
  awaiting_mastery_check: { label: 'Ready to check', chip: 'border-indigo-200 bg-indigo-50 text-indigo-800', rank: 3 },
  in_progress: { label: 'In progress', chip: 'border-amber-200 bg-amber-50 text-amber-800', rank: 4 },
  not_started: { label: 'Not started', chip: 'border-slate-200 bg-white text-slate-500', rank: 5 },
  no_questions: { label: 'No questions yet', chip: 'border-slate-200 bg-slate-50 text-slate-400', rank: 6 },
};

function stageOf(key: string) {
  return STAGE[key] ?? { label: key, chip: 'border-slate-200 bg-white text-slate-500', rank: 9 };
}

function ChapterMasteryView() {
  const params = useParams();
  const chapterId = String(params?.chapterId ?? '');

  const [data, setData] = useState<ChapterMastery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    // Every setState deferred - react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchChapterMastery(chapterId, controller.signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Your mastery could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading your mastery…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'Nothing could be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>Back to subjects</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary } = data;
  const provable = summary.conceptsTotal - summary.noQuestions;
  const pct = provable > 0 ? Math.round((summary.mastered / provable) * 100) : 0;
  const completion = chapterCompletionFromRows(data.concepts);

  // A completed chapter is closed: the mastery record, and no route back into
  // a question set from anywhere on the page.
  if (completion.isComplete) {
    return (
      <PalWorkspace
        eyebrow={data.chapterName || 'This chapter'}
        title="Chapter mastery"
        description="This chapter is completed. Everything below is a record of how you got there."
        backHref="/pal"
        backLabel="Back to subjects"
        actions={
          <>
            <CompletedBadge />
            <ReadOnlyBadge />
          </>
        }
        rail={
          <>
            <PalRailSection title="Where you finished">
              <PalRailStat label="Completed" value={completion.completed} tone="positive" />
              <PalRailStat label="Mastered" value={summary.mastered} tone="positive" />
              <PalRailStat label="Retained" value={summary.retained} tone="positive" />
              {completion.unmeasurable > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {completion.unmeasurable} concept{completion.unmeasurable === 1 ? '' : 's'} cannot
                  be practised yet — a gap in the question bank.
                </p>
              )}
            </PalRailSection>

            <PalRailSection title="Your journey">
              <JourneyRail
                current="mastery"
                completed={COMPLETED_THROUGH_CHECK}
                bypassed={['intervention']}
                orientation="vertical"
              />
            </PalRailSection>
          </>
        }
      >
        <CompletedChapterPanel mastery={data} completion={completion} />
      </PalWorkspace>
    );
  }

  // Furthest along first, so progress is what the learner sees.
  const concepts = [...data.concepts].sort(
    (a, b) => stageOf(a.stage).rank - stageOf(b.stage).rank || a.name.localeCompare(b.name)
  );

  return (
    <PalWorkspace
      eyebrow={data.chapterName || 'This chapter'}
      title="Mastery"
      description="Concept by concept, from your own answers."
      backHref="/pal"
      backLabel="Back to subjects"
      rail={
        <>
          <PalRailSection title="Where you stand">
            <PalRailStat label="Mastered" value={summary.mastered} tone="positive" />
            <PalRailStat label="Retained" value={summary.retained} tone="positive" />
            <PalRailStat label="In progress" value={summary.inProgress} />
            <PalRailStat label="Not started" value={summary.notStarted} />
            {summary.recallDue > 0 && (
              <PalRailStat label="Recall due" value={summary.recallDue} tone="warning" />
            )}
            {summary.noQuestions > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {summary.noQuestions} concept{summary.noQuestions === 1 ? '' : 's'} cannot be
                practised yet — a gap in the question bank.
              </p>
            )}
          </PalRailSection>

          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={COMPLETED_THROUGH_CHECK}
              bypassed={['intervention']}
              orientation="vertical"
            />
          </PalRailSection>

          <PalRailSection title="Go to">
            <div className="space-y-2">
              <Link
                href={`/pal/plan/chapter/${chapterId}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
              >
                My plan
              </Link>
              <Link
                href={`/pal/recall?chapterId=${chapterId}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
              >
                Recall reviews
              </Link>
            </div>
          </PalRailSection>
        </>
      }
    >

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">
                  {summary.mastered}
                </span>
                <span className="text-sm text-slate-600">
                  of {provable} concept{provable === 1 ? '' : 's'} mastered
                </span>
              </div>
              {summary.noQuestions > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {summary.noQuestions} more have no questions yet, so they cannot be measured.
                </p>
              )}
            </div>

            {summary.recallDue > 0 && (
              <Link href={`/pal/recall?chapterId=${chapterId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Clock aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                {summary.recallDue} review{summary.recallDue === 1 ? '' : 's'} due
              </Link>
            )}
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Concepts mastered"
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tally label="Retained" value={summary.retained} tone="good" />
            <Tally label="Ready to check" value={summary.awaitingCheck} tone="go" />
            <Tally label="In progress" value={summary.inProgress} />
            <Tally label="Not started" value={summary.notStarted} />
          </dl>
        </CardContent>
      </Card>

      {concepts.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden className="h-8 w-8" />}
          title="No concepts in this chapter yet"
          description="There is nothing to measure mastery against here."
          action={<Link href="/pal" className={buttonVariants()}>Back to subjects</Link>}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Every concept</CardTitle>
            <CardDescription>
              Furthest along first. A concept counts as mastered only when the engine signs it off,
              not when the estimate alone looks high.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {concepts.map((concept) => (
                <ConceptRow key={concept.conceptId} concept={concept} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Link href={`/pal/plan/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Back to my plan
        </Link>
        <Link href={`/pal/recall?chapterId=${chapterId}`} className={buttonVariants()}>
          Recall reviews
          <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
        </Link>
      </div>
    </PalWorkspace>
  );
}

function ConceptRow({ concept }: { concept: ConceptMasteryRow }) {
  const stage = stageOf(concept.stage);
  const done = concept.stage === 'mastered' || concept.stage === 'retained';
  const completed = isConceptCompleted(signalsFromMasteryRow(concept));
  const pct = concept.pMastery === null ? null : Math.round(concept.pMastery * 100);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {done ? (
              <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle aria-hidden className="h-4 w-4 shrink-0 text-slate-300" />
            )}
            <span className="text-sm font-medium text-slate-900">{concept.name}</span>
            {completed ? (
              <CompletedBadge />
            ) : (
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', stage.chip)}>
                {stage.label}
              </span>
            )}
          </div>

          {/* The ladder's own sentence - what is still outstanding, in words. */}
          <p className="mt-1 pl-6 text-xs text-slate-600">{concept.ladder.reason}</p>

          {/* Stated only when the two stores disagree, because that is exactly
              when a learner would otherwise be confused by the number. */}
          {concept.bktMastered && !done && (
            <p className="mt-1 pl-6 text-xs text-amber-700">
              Your estimate is above the mastery line, but the check has not been passed yet.
            </p>
          )}

          {concept.nextReviewAt && (
            <p className="mt-1 pl-6 text-xs text-sky-700">
              {concept.reviewDue
                ? 'A review is due now.'
                : `Next review ${formatDate(concept.nextReviewAt)}.`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {pct !== null && (
            <div className="w-24">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-slate-500">Estimate</span>
                <span className="text-xs font-semibold tabular-nums text-slate-800">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full', done ? 'bg-emerald-600' : 'bg-indigo-600')}
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

          {/* Completed is read-only: no review, no revisit, no practice. The
              only route left is the concept's own mastery record, which the
              practice page serves in place of a question set. */}
          {completed ? (
            <Link
              href={`/pal/adaptive/concept/${concept.conceptId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              View mastery
            </Link>
          ) : concept.esoReady ? (
            <Link
              href={`/pal/eso?conceptId=${concept.conceptId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {concept.reviewDue ? 'Review' : done ? 'Revisit' : 'Continue'}
            </Link>
          ) : concept.ladder.bandsRequired.length > 0 ? (
            <Link
              href={`/pal/adaptive/concept/${concept.conceptId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Practise
            </Link>
          ) : (
            <span className="text-[11px] text-slate-400">Not ready</span>
          )}
        </div>
      </div>
    </li>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'go' }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <dd
        className={cn(
          'text-lg font-semibold tabular-nums',
          tone === 'good' ? 'text-emerald-700' : tone === 'go' ? 'text-indigo-700' : 'text-slate-900'
        )}
      >
        {value}
      </dd>
      <dt className="text-[11px] text-slate-500">{label}</dt>
    </div>
  );
}

/** Laravel sends "YYYY-MM-DD HH:MM:SS"; Safari will not parse that as-is. */
function formatDate(value: string): string {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
