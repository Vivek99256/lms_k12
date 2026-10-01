'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  fetchChapterMastery,
  fetchConceptResult,
  type ConceptDiagnosticResult,
  type ConceptMasteryRow,
} from '@/app/pal/data/pal-diagnostic';
import {
  isConceptCompleted,
  signalsFromConceptResult,
  signalsFromMasteryRow,
} from '@/app/pal/data/pal-completion';
import { bandLabel } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ConceptEvidence,
  ReadOnlyBadge,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * One concept's mastery, and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT THE CONCEPT DIAGNOSTIC PAGE
 * ---------------------------------------------------------------------------
 * "View mastery" used to link to /pal/adaptive/concept/{id}, relying on that
 * page to swap its question set for the mastery record once it saw the concept
 * was completed. But the two pages decide "completed" from different payloads:
 * the chapter screens read the mastery overview row, which carries the
 * engine's sign-off (`stage`, `engineStatus`), while the diagnostic page reads
 * only the concept's practice record, which does not. A concept the engine had
 * signed off therefore showed "View mastery" on the chapter and a fresh
 * diagnostic one click later.
 *
 * This page has no question set to fall back to. It reads both payloads, judges
 * completion on either (see app/pal/data/pal-completion.ts), and renders the
 * record read-only whatever the verdict - so the button always lands on the
 * mastery it names.
 *
 * `?chapterId=` is optional. Every chapter screen passes it, so the two reads
 * run in parallel; without it the concept result is read first to learn it.
 */

export default function ConceptMasteryPage() {
  return (
    <Suspense fallback={<Centered>Loading concept mastery…</Centered>}>
      <ConceptMasteryView />
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

/** MasteryOverviewService's reconciled stage, in words. */
const STAGE_LABEL: Record<string, string> = {
  retained: 'Retained',
  mastered: 'Mastered',
  recall_due: 'Review due',
  awaiting_mastery_check: 'Ready to check',
  in_progress: 'In progress',
  not_started: 'Not started',
  no_questions: 'No questions yet',
};

function ConceptMasteryView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterIdParam = searchParams.get('chapterId') ?? '';

  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [row, setRow] = useState<ConceptMasteryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // The overview row only sharpens the verdict and the rail; the concept
    // result is the record itself. So a failed overview is swallowed and the
    // page still renders, while a failed result is the page's error.
    const findRow = (chapterId: string) =>
      fetchChapterMastery(chapterId, signal)
        .then((mastery) => mastery.concepts.find((concept) => String(concept.conceptId) === conceptId) ?? null)
        .catch(() => null);

    const run = async (): Promise<[ConceptDiagnosticResult, ConceptMasteryRow | null]> => {
      if (chapterIdParam) {
        return Promise.all([fetchConceptResult(conceptId, signal), findRow(chapterIdParam)]);
      }
      const conceptResult = await fetchConceptResult(conceptId, signal);
      return [conceptResult, conceptResult.chapterId ? await findRow(conceptResult.chapterId) : null];
    };

    // Every setState deferred - react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      run()
        .then(([conceptResult, masteryRow]) => {
          setResult(conceptResult);
          setRow(masteryRow);
        })
        .catch((reason: unknown) => {
          if (signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Mastery for this concept couldn’t be loaded.');
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId, chapterIdParam]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading concept mastery…</Centered>;

  const chapterId = result?.chapterId || chapterIdParam;

  if (error || !result) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'Nothing could be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link
                href={chapterId ? `/pal/mastery/chapter/${chapterId}` : '/pal'}
                className={buttonVariants({ size: 'sm' })}
              >
                {chapterId ? 'Chapter mastery' : 'Back to subjects'}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Either store's sign-off is enough - the same call the chapter screens make.
  const completed =
    isConceptCompleted(row ? signalsFromMasteryRow(row) : null) ||
    isConceptCompleted(signalsFromConceptResult(result));

  // The highest rung actually cleared, not the one the rule aims at - a
  // concept with no hard questions written completes without it.
  const cleared = result.ladder.bandsCleared.map((band) => band.toLowerCase());
  const topCleared = ['hard', 'medium', 'easy'].find((band) => cleared.includes(band));
  const estimate = row?.pMastery == null ? null : Math.round(row.pMastery * 100);
  const stage = row ? (STAGE_LABEL[row.stage] ?? row.stage) : null;

  return (
    <PalWorkspace
      eyebrow="Concept mastery"
      title={result.conceptName || row?.name || 'Concept'}
      description={
        completed
          ? 'This concept is completed. Everything below is a record of how you got there.'
          : 'Where you stand on this concept, from your own answers.'
      }
      backHref={chapterId ? `/pal/adaptive/chapter/${chapterId}` : '/pal'}
      backLabel={chapterId ? 'All concepts' : 'Back to subjects'}
      actions={
        <>
          {completed && <CompletedBadge />}
          <ReadOnlyBadge />
        </>
      }
      rail={
        <>
          <PalRailSection title={completed ? 'Where you finished' : 'Where you stand'}>
            {stage && <PalRailStat label="Stage" value={stage} tone={completed ? 'positive' : 'default'} />}
            {estimate !== null && <PalRailStat label="Mastery estimate" value={`${estimate}%`} />}
            <PalRailStat label="Accuracy" value={`${Math.round(result.accuracy)}%`} />
            <PalRailStat label="Correct" value={`${result.correct} of ${result.attempted}`} />
            <PalRailStat label="Top level cleared" value={topCleared ? bandLabel(topCleared) : 'None recorded'} />
          </PalRailSection>

          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={completed ? COMPLETED_THROUGH_CHECK : stagesBefore('mastery')}
              bypassed={['intervention']}
              orientation="vertical"
              chapterId={chapterId}
              conceptId={conceptId}
              conceptName={result.conceptName || row?.name}
            />
          </PalRailSection>
        </>
      }
    >
      {completed ? (
        <CompletedConceptPanel result={result} />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-slate-900">Not completed yet</p>
              <p className="mt-1.5 text-sm text-slate-600">{result.ladder.reason}</p>
              {/* Stated only when the two stores disagree - the same warning
                  the chapter mastery screen gives. */}
              {row?.bktMastered && row.stage !== 'mastered' && row.stage !== 'retained' && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Your estimate is above the mastery line, but the check has not been passed yet.
                </p>
              )}
            </CardContent>
          </Card>
          <ConceptEvidence result={result} completed={false} />
        </div>
      )}

      {chapterId && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <Link href={`/pal/adaptive/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline' })}>
            All concepts
          </Link>
          <Link href={`/pal/mastery/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline' })}>
            Chapter mastery
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      )}
    </PalWorkspace>
  );
}
