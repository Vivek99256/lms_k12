'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, HelpCircle, Loader2, X } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fetchConceptResult, type ConceptDiagnosticResult } from '@/app/pal/data/pal-diagnostic';
import {
  buildConceptFeedback,
  type ConceptFeedback,
  type FeedbackBand,
} from '@/app/pal/data/pal-feedback';
import {
  fetchInterventions,
  openIntervention,
  type InterventionQueue,
} from '@/app/pal/data/pal-intervention';
import { defaultLearnerId } from '@/app/pal/data/pal-v4';
import { BandRow } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ReadOnlyBadge,
  useConceptCompletion,
} from '@/app/pal/_components/CompletionState';
import {
  COMPLETED_THROUGH_CHECK,
  JourneyRail,
  stagesBefore,
} from '@/app/pal/_components/JourneyRail';
import { NextStepCard } from '@/app/pal/_components/NextStepCard';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 6 - Feedback. What the practice showed, in words a learner can use.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCREEN EXISTS
 * ---------------------------------------------------------------------------
 * Everything on this page was already being sent to the browser and thrown
 * away. The concept result carries the engine's rationale, the rule that
 * fired, the ladder's own reason, the detected misconception and its authored
 * corrective - and the learner was shown a percentage and a button.
 *
 * A score is not feedback. "Three out of five" tells a learner nothing they
 * can act on; naming the mistake and the single next move does.
 *
 * ---------------------------------------------------------------------------
 * WHY IT SITS BEFORE THE CHECK AND NOT AFTER IT
 * ---------------------------------------------------------------------------
 * Check is the consequential gate. Feedback after it would be a post-mortem of
 * a decision already taken. Before it, the learner walks in with their mistake
 * named - the difference between a fair test and a trap.
 *
 * ---------------------------------------------------------------------------
 * HOW IT IS LAID OUT, AND WHY IT IS ONLY THREE CARDS
 * ---------------------------------------------------------------------------
 * A learner needs three things, in this order:
 *
 *   1. How did I do?          -> one sentence and a picture, no percentage
 *   2. What exactly went wrong? -> ONE thing, not a list
 *   3. What do I do now?        -> ONE button
 *
 * An earlier version of this screen had seven stacked cards, a large accuracy
 * figure, per-claim evidence captions and TWO separate "what next" boxes. Every
 * one of those is defensible to an adult auditing the engine, and together they
 * are unreadable to the child the screen is for. So: the detail still exists,
 * but it is folded away behind "See the full breakdown" and the top of the page
 * is three plain statements.
 *
 * The percentage is deliberately NOT the headline. "40%" is a verdict on the
 * learner; "you got 2 of 5, and here is the one thing that went wrong" is a
 * description of the work. The second is the one they can do something about.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ENGINE'S BUTTON MOVED HERE
 * ---------------------------------------------------------------------------
 * The practice result used to render NextStepCard. It now hands off to this
 * screen instead, and the card is rendered here - the same component, the same
 * table, the same destinations. This page CONSUMES the engine's decision; it
 * never makes one.
 *
 * ---------------------------------------------------------------------------
 * AND WHY THERE IS A WAY TO SAY "I AM STILL STUCK"
 * ---------------------------------------------------------------------------
 * PAL has always been one-directional: the engine decides and the learner
 * complies. This is the first control that runs the other way. It raises a
 * support case rather than resolving anything itself - see
 * app/pal/data/pal-intervention.ts for why a person, not the engine, opens one.
 */

export default function ConceptFeedbackPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <ConceptFeedbackView />
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

function ConceptFeedbackView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterHint = searchParams.get('chapterId') ?? '';
  // See the note on ConceptFeedback.evidencePublished: a refetch may report 0
  // because nothing new was published by a read, so the count the practice
  // screen actually saw is carried forward and the larger of the two wins.
  const publishedHint = Number(searchParams.get('published') ?? 0);

  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [feedback, setFeedback] = useState<ConceptFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [support, setSupport] = useState<InterventionQueue | null>(null);
  const [raising, setRaising] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  const {
    result: completedResult,
    completed,
    loading: checkingCompletion,
  } = useConceptCompletion(conceptId);

  const load = useCallback(() => {
    const controller = new AbortController();
    // Every setState deferred - react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchConceptResult(conceptId, controller.signal)
        .then((payload) => {
          setResult(payload);
          setFeedback(buildConceptFeedback(payload));
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'This could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  useEffect(() => {
    if (checkingCompletion || completed) return;
    return load();
  }, [load, checkingCompletion, completed]);

  // Swallowed on purpose, exactly as useConceptCompletion swallows: support is
  // an overlay on a lesson screen, and a missing endpoint must never be the
  // reason a learner cannot read their own feedback.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      fetchInterventions({ conceptId, status: 'open' }, controller.signal)
        .then(setSupport)
        .catch(() => undefined);
    });
    return () => controller.abort();
  }, [conceptId]);

  const raiseSupport = useCallback(async () => {
    if (!feedback) return;

    setRaising(true);
    setRaiseError(null);
    try {
      const record = await openIntervention({
        // The signed-in learner, always. A learner may only ever raise a case
        // against themselves, and the server enforces that too.
        learnerId: defaultLearnerId(),
        conceptId,
        chapterId: feedback.chapterId || chapterHint,
        triggerKind: 'learner_raised',
        title: `Stuck on ${feedback.conceptName}`,
        rationale: feedback.checkReadiness.reason,
        riskLevel: 'medium',
      });

      // A null is "not written". Saying nothing happened is the honest
      // outcome; claiming a case was opened would be worse than the outage.
      if (!record) {
        setRaiseError(
          support?.access.message ?? 'This cannot be sent on this server yet.'
        );
        return;
      }

      router.push(`/pal/intervention/concept/${conceptId}`);
    } catch (reason: unknown) {
      setRaiseError(reason instanceof Error ? reason.message : 'That could not be sent.');
    } finally {
      setRaising(false);
    }
  }, [feedback, conceptId, chapterHint, router, support]);

  if (checkingCompletion) return <Centered>Loading…</Centered>;

  // A completed concept has no formative feedback to give - there is nothing
  // left to correct before a gate it has already passed.
  if (completed && completedResult) {
    return (
      <PalWorkspace
        eyebrow={completedResult.conceptName}
        title="You have finished this"
        description="Here is how you got there."
        backHref={`/pal/plan/chapter/${completedResult.chapterId || chapterHint}`}
        backLabel="Back to my plan"
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
        <CompletedConceptPanel result={completedResult} />
      </PalWorkspace>
    );
  }

  if (loading) return <Centered>Loading…</Centered>;

  if (error || !feedback || !result) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'This could not be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>
                Back to subjects
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chapterId = feedback.chapterId || chapterHint;
  const published = Math.max(feedback.evidencePublished, publishedHint);
  const openCase = support?.records[0] ?? null;

  // The one thing worth fixing. The misconception wins when there is one: it
  // is the only item that names a specific wrong idea rather than a weak
  // score, and it is what turns "practise more" into "here is what happened".
  const mainFix = feedback.toFix[0] ?? null;
  const goodNews = feedback.wentWell[0] ?? null;

  const rail = (
    <>
      <PalRailSection title="This practice">
        <PalRailStat label="Right" value={`${feedback.correct} of ${feedback.attempted}`} />
        <PalRailStat
          label="How this concept is going"
          value={plainVerdict(feedback.verdict)}
          tone={
            feedback.tone === 'warning'
              ? 'warning'
              : feedback.tone === 'positive'
                ? 'positive'
                : 'default'
          }
        />
        {published > 0 && <PalRailStat label="Answers saved" value={published} />}
      </PalRailSection>

      <PalRailSection title="Your journey">
        <JourneyRail
          current="feedback"
          completed={stagesBefore('feedback')}
          // Only claimed when nothing is open. A learner with a case in flight
          // is genuinely on that stage, and the rail must not tell them they
          // never needed it.
          bypassed={openCase ? [] : ['intervention']}
          orientation="vertical"
        />
      </PalRailSection>

      <PalRailSection title="Go to">
        <div className="space-y-2">
          {chapterId && (
            <Link
              href={`/pal/plan/chapter/${chapterId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
            >
              My plan
            </Link>
          )}
          <Link
            href={`/pal/adaptive/concept/${conceptId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
          >
            Practise again
          </Link>
        </div>
      </PalRailSection>
    </>
  );

  return (
    <PalWorkspace
      eyebrow={feedback.conceptName || 'This concept'}
      title="How your practice went"
      description="Read this before the check. It takes a minute."
      backHref={`/pal/adaptive/concept/${conceptId}`}
      backLabel="Back to practice"
      rail={rail}
    >
      {feedback.isEmpty ? (
        // A real state, not a gap to pad. There is nothing to feed back on.
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing to go over yet</CardTitle>
            <CardDescription>
              You have not answered any questions here, so there is nothing to look at.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/pal/adaptive/concept/${conceptId}`} className={buttonVariants()}>
              Start practice
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 1. How did I do? One sentence, then a picture of the actual
              answers. No percentage: it is a verdict on the learner, where the
              ticks and crosses are a description of the work. */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-xl font-semibold text-slate-900">{feedback.headline}</p>
              <p className="mt-1 text-sm text-slate-600">
                You got <span className="font-semibold text-slate-900">{feedback.correct}</span> of{' '}
                <span className="font-semibold text-slate-900">{feedback.attempted}</span> right.
              </p>

              <div className="mt-4 space-y-2.5">
                {feedback.bands
                  .filter((band) => band.status !== 'unavailable' && band.attempted > 0)
                  .map((band) => (
                    <BandDots key={band.band} band={band} />
                  ))}
              </div>

              {goodNews && (
                <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="font-medium">Going well: </span>
                    {goodNews.claim}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* 2. What exactly went wrong? ONE thing, given the room to be read.
              A list of four bullets here is a list of four things to worry
              about; one is a thing to fix. */}
          {mainFix && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  The main thing to fix
                </p>

                <p className="mt-2 flex items-start gap-2 text-base font-medium text-slate-900">
                  <X aria-hidden className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{mainFix.claim}</span>
                </p>

                {/* The authored corrective. This is the single most useful
                    sentence on the page and it used to be a footnote. */}
                {feedback.misconception?.correctiveAction && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                    <p className="flex items-start gap-2 text-sm text-slate-800">
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        <span className="font-medium">Do this instead: </span>
                        {feedback.misconception.correctiveAction}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. What do I do now? ONE button - the engine's, rendered by the
              component the practice result used to render. The separate
              "ready for the check?" card was removed: when the engine says
              mastery_check, this card already says so, and two boxes both
              answering "what next" is how a learner ends up pressing neither. */}
          {result.next ? (
            <NextStepCard
              next={result.next}
              misconception={result.misconception}
              conceptId={conceptId}
              chapterId={chapterId}
              onPractiseAgain={() => router.push(`/pal/adaptive/concept/${conceptId}`)}
            />
          ) : feedback.checkReadiness.ready ? (
            <Card className="mt-4 border-emerald-200 bg-emerald-50">
              <CardContent className="pt-5">
                <p className="text-sm font-semibold text-slate-900">You are ready for the check</p>
                <p className="mt-1 text-sm text-slate-700">{feedback.checkReadiness.reason}</p>
                <Link href={`/pal/eso?conceptId=${conceptId}`} className={cn(buttonVariants(), 'mt-3')}>
                  Go to the check
                  <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {/* Everything an adult might want to audit, folded away. It is all
              still here - it is just not the first thing a child sees. */}
          <details className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              See the full breakdown
            </summary>

            <div className="mt-3 space-y-4">
              {feedback.bands.map((band) => (
                <BandRow
                  key={band.band}
                  band={band.band}
                  correct={band.correct}
                  served={band.attempted}
                  percentage={band.accuracy}
                />
              ))}

              {feedback.toFix.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-slate-900">Other things to look at</p>
                  <ul className="mt-1 space-y-1">
                    {feedback.toFix.slice(1).map((point, index) => (
                      <li key={index} className="text-sm text-slate-600">
                        · {point.claim}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.wentWell.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-slate-900">Other things going well</p>
                  <ul className="mt-1 space-y-1">
                    {feedback.wentWell.slice(1).map((point, index) => (
                      <li key={index} className="text-sm text-slate-600">
                        · {point.claim}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.provenance.rationale && (
                <div>
                  <p className="text-sm font-medium text-slate-900">Why you got these questions</p>
                  <p className="mt-1 text-sm text-slate-600">{feedback.provenance.rationale}</p>
                  {feedback.priorDiagnostic && (
                    <p className="mt-1 text-xs text-slate-500">
                      The chapter diagnostic had you at {feedback.priorDiagnostic.conceptPct}% on
                      this concept.
                    </p>
                  )}
                </div>
              )}
            </div>
          </details>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Link
          href={`/pal/adaptive/chapter/${chapterId}`}
          className={buttonVariants({ variant: 'outline' })}
        >
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          All concepts
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {openCase ? (
            <Link
              href={`/pal/intervention/concept/${conceptId}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <HelpCircle aria-hidden className="mr-1.5 h-4 w-4" />
              Your support case
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={() => void raiseSupport()}
              disabled={raising || support?.access.readOnly === true}
              title={support?.access.message ?? undefined}
            >
              {raising ? (
                <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <HelpCircle aria-hidden className="mr-1.5 h-4 w-4" />
              )}
              I still do not get it
            </Button>
          )}
        </div>
      </div>

      {(raiseError || support?.access.message) && (
        <p className="mt-2 text-sm text-slate-500">{raiseError ?? support?.access.message}</p>
      )}
    </PalWorkspace>
  );
}

/**
 * One row of ticks and crosses - what the learner actually did, at a glance.
 *
 * Derived only from `correct` and `attempted`, which is all the server sends;
 * it is NOT a claim about which individual question was which. The wording
 * next to it says the same thing in words, so the row never depends on being
 * able to tell a tick from a cross by shape or colour alone.
 */
function BandDots({ band }: { band: FeedbackBand }) {
  const wrong = Math.max(band.attempted - band.correct, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-16 shrink-0 text-sm font-medium capitalize text-slate-700">
        {band.band}
      </span>

      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: band.correct }).map((_, index) => (
          <span
            key={`right-${index}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
          >
            <Check className="h-3 w-3" />
          </span>
        ))}
        {Array.from({ length: wrong }).map((_, index) => (
          <span
            key={`wrong-${index}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <X className="h-3 w-3" />
          </span>
        ))}
      </span>

      <span className="text-sm text-slate-600">
        {band.correct} right
        {wrong > 0 ? `, ${wrong} wrong` : ''}
      </span>
    </div>
  );
}

/** The engine's verdict word, said the way a learner would say it. */
function plainVerdict(verdict: ConceptFeedback['verdict']): string {
  switch (verdict) {
    case 'mastered':
      return 'Finished';
    case 'strong':
      return 'Going well';
    case 'developing':
      return 'Getting there';
    case 'weak':
      return 'Needs work';
    default:
      return 'Not started';
  }
}
