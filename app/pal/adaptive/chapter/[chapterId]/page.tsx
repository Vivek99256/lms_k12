'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Brain, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchAdaptiveConcepts,
  type AdaptiveConcept,
  type AdaptiveConceptList,
} from '@/app/pal/data/pal-diagnostic';
import { BandChip, LevelBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import { JourneyRail } from '@/app/pal/_components/JourneyRail';

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

  if (loading) return <Centered>Loading concepts…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link href="/pal" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 text-slate-600')}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Back to subjects
        </Link>
      </div>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Adaptive learning</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.chapterName || 'This chapter'} — five questions per round, chosen from how you did.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data.hasDiagnostic && <LevelBadge level={data.diagnosticLevel} />}
          <Link href={`/pal/plan/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>View plan</Link>
        </div>
      </header>

      <JourneyRail current="adaptive" completed={data.hasDiagnostic ? ['diagnostic'] : []} className="mb-5" />

      {!data.hasDiagnostic && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-amber-900">
              You have not taken the diagnostic for this chapter yet, so practice will open at easy
              and adjust as you go.
            </p>
            <Link href={`/pal/diagnostic/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Take diagnostic</Link>
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
    </div>
  );
}

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

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {concept.diagnosticPercentage !== null && (
            <div className="flex gap-1">
              <dt>Diagnostic</dt>
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
          <Button className="w-full" size="sm" onClick={onStart}>
            {attempted ? 'Continue practice' : 'Start practice'}
            <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {concept.availability.total} question{concept.availability.total === 1 ? '' : 's'} available
            {concept.nextDifficulty && ` · opening at ${bandLabel(concept.nextDifficulty).toLowerCase()}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
