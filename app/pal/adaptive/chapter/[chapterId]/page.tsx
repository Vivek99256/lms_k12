'use client';

<<<<<<< HEAD
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Brain, CheckCircle2, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
=======
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Brain, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchAdaptiveConcepts,
  type AdaptiveConcept,
  type AdaptiveConceptList,
} from '@/app/pal/data/pal-diagnostic';
<<<<<<< HEAD
import { isConceptCompleted, signalsFromMasteryRow } from '@/app/pal/data/pal-completion';
import { BandChip, LevelBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedChapterPanel,
  ReadOnlyBadge,
  useChapterCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
=======
import { BandChip, LevelBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import { JourneyRail } from '@/app/pal/_components/JourneyRail';
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 3 - which concept to practise, and at what level.
 *
 * The ordering, the level and the one-line reason all come from
 * AdaptiveDifficultyRule via ConceptPerformanceAnalyzer. This screen does not
 * rank or re-reason: it shows what the rule decided, including its own
 * `rationale` sentence, so the learner and the engine always tell the same
 * story.
 *
 * Concepts with no servable questions stay in the list, greyed out. Dropping
 * them would quietly remove half a syllabus from view; showing them disabled
 * says plainly that practice is not ready for that topic yet.
<<<<<<< HEAD
 *
 * ---------------------------------------------------------------------------
 * COMPLETED CONCEPTS, AND A COMPLETED CHAPTER
 * ---------------------------------------------------------------------------
 * A concept cleared to hard and signed off is read-only: its card keeps the
 * evidence and loses the button. Once every measurable concept in the chapter
 * is completed, the list itself is replaced by the chapter's mastery - there is
 * no longer a next concept to choose, so offering a choice would be a lie.
 *
 * The verdict comes from the mastery overview (one extra GET) rather than being
 * re-derived here; the rule lives in app/pal/data/pal-completion.ts.
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
 */

export default function AdaptiveConceptsPage() {
  return (
    <Suspense fallback={<Centered>Loading concepts…</Centered>}>
      <AdaptiveConceptsView />
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

function AdaptiveConceptsView() {
  const params = useParams();
  const router = useRouter();
  const chapterId = String(params?.chapterId ?? '');

  const [data, setData] = useState<AdaptiveConceptList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

<<<<<<< HEAD
  const {
    mastery,
    completion,
    loading: checkingCompletion,
  } = useChapterCompletion(chapterId);

  // Concept ids are numbers on the mastery overview and strings on the concept
  // list, so they are normalised once here rather than at every comparison.
  const completedConceptIds = useMemo(
    () =>
      new Set(
        (mastery?.concepts ?? [])
          .filter((concept) => isConceptCompleted(signalsFromMasteryRow(concept)))
          .map((concept) => String(concept.conceptId))
      ),
    [mastery]
  );

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  const load = useCallback(() => {
    const controller = new AbortController();
    // Every setState is deferred, including the loading/error reset: calling
    // them in the effect body triggers a cascading render, which is what
    // react-hooks/set-state-in-effect flags. Same convention as app/pal/eso/*.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchAdaptiveConcepts(chapterId, controller.signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Concepts could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => load(), [load]);

<<<<<<< HEAD
  if (loading || checkingCompletion) return <Centered>Loading concepts…</Centered>;

  // Nothing left to practise in this chapter: the mastery record replaces the
  // list, and every route into a question set goes with it.
  if (completion.isComplete && mastery) {
    return (
      <PalWorkspace
        eyebrow={mastery.chapterName || data?.chapterName || 'This chapter'}
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
          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={COMPLETED_THROUGH_CHECK}
              bypassed={['intervention']}
              orientation="vertical"
            />
          </PalRailSection>
        }
      >
        <CompletedChapterPanel mastery={mastery} completion={completion} />
      </PalWorkspace>
    );
  }
=======
  if (loading) return <Centered>Loading concepts…</Centered>;
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

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

  const servable = data.concepts.filter((concept) => concept.servable);
  const unavailable = data.concepts.filter((concept) => !concept.servable);

  return (
    <PalWorkspace
      eyebrow={data.chapterName || 'This chapter'}
      title="Concept diagnostic"
      description="Five questions per round, chosen from how you did."
      backHref="/pal"
      backLabel="Back to subjects"
      actions={
        <>
          {data.hasDiagnostic && <LevelBadge level={data.diagnosticLevel} />}
          <Link
            href={`/pal/plan/chapter/${chapterId}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            View plan
          </Link>
        </>
      }
      rail={
<<<<<<< HEAD
        <>
          {completion.measurable > 0 && (
            <PalRailSection title="Chapter progress">
              <div className="flex items-baseline justify-between gap-3 py-1">
                <span className="text-sm text-slate-600">Completed</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {completion.completed} of {completion.measurable}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${(completion.completed / completion.measurable) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={completion.completed}
                  aria-valuemin={0}
                  aria-valuemax={completion.measurable}
                  aria-label="Concepts completed"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                A concept is completed once it is cleared to{' '}
                {bandLabel('hard').toLowerCase()} and mastery is signed off. The chapter closes when
                all of them are.
              </p>
            </PalRailSection>
          )}

          <PalRailSection title="Your journey">
            <JourneyRail
              current="adaptive"
              completed={data.hasDiagnostic ? stagesBefore('adaptive') : []}
              orientation="vertical"
            />
          </PalRailSection>
        </>
=======
        <PalRailSection title="Your journey">
          <JourneyRail
            current="adaptive"
            completed={data.hasDiagnostic ? ['diagnostic'] : []}
            orientation="vertical"
          />
        </PalRailSection>
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
      }
    >

      {!data.hasDiagnostic && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-amber-900">
              You have not taken the chapter diagnostic yet, so practice will open at easy
              and adjust as you go.
            </p>
            <Link href={`/pal/diagnostic/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Take chapter diagnostic</Link>
          </CardContent>
        </Card>
      )}

      {servable.length === 0 ? (
        <EmptyState
          icon={<Brain aria-hidden className="h-8 w-8" />}
          title="No practice questions for this chapter yet"
          description="None of this chapter's concepts have multiple-choice questions available."
          action={<Link href="/pal" className={buttonVariants()}>Back to subjects</Link>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servable.map((concept) => (
            <ConceptCard
              key={concept.conceptId}
              concept={concept}
<<<<<<< HEAD
              completed={completedConceptIds.has(String(concept.conceptId))}
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
              onStart={() => router.push(`/pal/adaptive/concept/${concept.conceptId}`)}
            />
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle className="text-base">Not ready for practice yet</CardTitle>
            <CardDescription>
              {unavailable.length} concept{unavailable.length === 1 ? '' : 's'} in this chapter have
              no multiple-choice questions written. Your teacher sees these as content gaps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1.5">
              {unavailable.map((concept) => (
                <li
                  key={concept.conceptId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500"
                >
                  {concept.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PalWorkspace>
  );
}

<<<<<<< HEAD
function ConceptCard({
  concept,
  completed,
  onStart,
}: {
  concept: AdaptiveConcept;
  completed: boolean;
  onStart: () => void;
}) {
  const attempted = concept.practiceAttempts > 0;

  return (
    <Card className={cn('flex h-full flex-col', completed && 'border-emerald-200 bg-emerald-50/40')}>
      <CardContent className="flex flex-1 flex-col pt-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-semibold text-slate-900">{concept.name}</h2>
          {completed ? (
            <CompletedBadge className="shrink-0" />
          ) : (
            concept.nextDifficulty && <BandChip band={concept.nextDifficulty} className="shrink-0" />
          )}
        </div>

        {/* The engine's own sentence. Rewording it here would let this screen
            and the practice screen explain the same decision differently. On a
            completed concept the engine has no next decision to explain, so the
            card says what it has become instead. */}
        {completed ? (
          <p className="text-xs text-emerald-800">
            You have shown this at every level available. Nothing left to practise.
          </p>
        ) : (
          concept.rationale && <p className="text-xs text-slate-600">{concept.rationale}</p>
        )}
=======
function ConceptCard({ concept, onStart }: { concept: AdaptiveConcept; onStart: () => void }) {
  const attempted = concept.practiceAttempts > 0;

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col pt-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-semibold text-slate-900">{concept.name}</h2>
          {concept.nextDifficulty && <BandChip band={concept.nextDifficulty} className="shrink-0" />}
        </div>

        {/* The engine's own sentence. Rewording it here would let this screen
            and the practice screen explain the same decision differently. */}
        {concept.rationale && <p className="text-xs text-slate-600">{concept.rationale}</p>}
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {concept.diagnosticPercentage !== null && (
            <div className="flex gap-1">
              <dt>Chapter diagnostic</dt>
              <dd className="font-semibold tabular-nums text-slate-700">
                {Math.round(concept.diagnosticPercentage)}%
              </dd>
            </div>
          )}
          {attempted && (
            <div className="flex gap-1">
              <dt>Practice</dt>
              <dd className="font-semibold tabular-nums text-slate-700">
                {Math.round(concept.practicePercentage)}% of {concept.practiceAttempts}
              </dd>
            </div>
          )}
          {!concept.conceptExact && <div className="text-slate-400">questions from the chapter</div>}
        </dl>

        <div className="mt-auto pt-4">
<<<<<<< HEAD
          {completed ? (
            // Read-only. The only route out of a completed concept is its own
            // mastery record, which the practice page serves in place of a set.
            <>
              <Link
                href={`/pal/adaptive/concept/${concept.conceptId}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
              >
                <CheckCircle2 aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                View mastery
              </Link>
              <p className="mt-1.5 text-center text-[11px] text-emerald-700">
                Completed &middot; read only
              </p>
            </>
          ) : (
            <>
              <Button className="w-full" size="sm" onClick={onStart}>
                {attempted ? 'Continue practice' : 'Start practice'}
                <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <p className="mt-1.5 text-center text-[11px] text-slate-400">
                {concept.availability.total} question{concept.availability.total === 1 ? '' : 's'} available
                {concept.nextDifficulty && ` · opening at ${bandLabel(concept.nextDifficulty).toLowerCase()}`}
              </p>
            </>
          )}
=======
          <Button className="w-full" size="sm" onClick={onStart}>
            {attempted ? 'Continue practice' : 'Start practice'}
            <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {concept.availability.total} question{concept.availability.total === 1 ? '' : 's'} available
            {concept.nextDifficulty && ` · opening at ${bandLabel(concept.nextDifficulty).toLowerCase()}`}
          </p>
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
        </div>
      </CardContent>
    </Card>
  );
}
