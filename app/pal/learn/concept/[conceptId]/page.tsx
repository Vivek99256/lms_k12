'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MonitorPlay,
  Play,
  Presentation,
  Puzzle,
  School,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { QuestionResult } from '@/components/h5p/players/types';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  acknowledgeConceptLearn,
  fetchConceptLearn,
  type ConceptLearn,
  type LearnResourceItem,
  type LearnResourceSection,
} from '@/app/pal/data/pal-diagnostic';
import {
  H5PActivityPlayer,
  isInlineH5PPlayable,
  type H5PActivityTarget,
} from '@/app/pal/_components/H5PActivityPlayer';
import { loadChapterName } from '@/app/pal/_components/interactive-journey/chapterName';
import { generateJourneyRecipe } from '@/app/pal/_components/interactive-journey/generate';
import { JourneyEntryCard, JourneyPlayer } from '@/app/pal/_components/interactive-journey/JourneyPlayer';
import { WebConceptVisual } from '@/app/pal/_components/WebConceptVisual';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ReadOnlyBadge,
  useConceptCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * "Interactive activities" plays in place, directly below the heading, for
 * every concept — no exceptions by concept id.
 *
 * ---------------------------------------------------------------------------
 * HOW THIS GOT HERE (2026-09-29, four revisions)
 * ---------------------------------------------------------------------------
 * Rounds 1–3 built and refined a hand-authored five-step journey
 * (Hook/Explain/Practice/Check/Complete, see ConceptJourney.tsx) for exactly
 * two piloted concepts (2294, 2299), reached by tapping the existing
 * "Interactive activities" resource card. Every other concept's `h5p` card
 * kept opening `InlineActivityOverlay`'s full-screen portal instead — the
 * same button meant two different things depending on which concept happened
 * to be open, and the journey's own Hook/Explain narrative was necessarily
 * hardcoded per concept (a real scenario, real numbers, real copy — not
 * something to generate).
 *
 * ROUND 4 (this revision): the concept-id gate is gone. `onPlayActivity`
 * below now resolves whichever H5P node this specific card's own item is
 * tagged with — `h5pTarget()`, straight off the API response, nothing
 * hardcoded — and plays it in place (`inlineActivity`) for every concept the
 * same way `activeActivity`/`InlineActivityOverlay` already did for the
 * full-screen case. `ConceptJourney` and `IntegerProductVisual` are no longer
 * wired to this card; nothing here deletes that authored content, it just
 * isn't reachable from "Interactive activities" anymore, since a per-concept
 * hardcoded story is the opposite of "every concept, dynamically."
 * `tests/pal-concept-2294-journey.spec.ts` tested the old journey trigger and
 * has been updated to match this page's current behavior.
 */

/**
 * Stage 6 - Learn.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE EXISTS
 * ---------------------------------------------------------------------------
 * "Learn it" used to link at /pal/eso?conceptId=N, which asks the engine what
 * to do next and renders whatever comes back. The engine legitimately answers
 * "practice" for a concept it considers already taught, so the button could not
 * keep its promise - it routinely opened a quiz.
 *
 * This reads the material directly from a read-only endpoint that stamps
 * nothing and moves nobody, so the lesson always opens. The engine is still the
 * only thing that can advance the learner: the CTA at the bottom hands them
 * back to it.
 *
 * ---------------------------------------------------------------------------
 * EXCEPT ON A COMPLETED CONCEPT
 * ---------------------------------------------------------------------------
 * A concept cleared to hard and signed off shows its mastery instead of its
 * lesson. The bottom CTA writes (`acknowledgeConceptLearn` stamps taught_at and
 * hands the learner to the engine), so a completed concept must not reach a
 * screen that carries it. Completion is therefore resolved before the lesson is
 * requested - see app/pal/data/pal-completion.ts for the rule.
 */

export default function ConceptLearnPage() {
  return (
    <Suspense fallback={<Centered>Loading the lesson…</Centered>}>
      <ConceptLearnView />
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

function ConceptLearnView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterHint = searchParams.get('chapterId');

  const [data, setData] = useState<ConceptLearn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  // The interactive activity currently open inline, if any — see
  // `H5PActivityPlayer`. Closing it never navigates; the student stays on
  // this lesson exactly where they left it.
  const [activeActivity, setActiveActivity] = useState<{
    item: LearnResourceItem;
    target: H5PActivityTarget;
  } | null>(null);
  // The "Interactive activities" card's own activity, played in place
  // directly below the page heading instead of in a full-screen overlay —
  // resolved fresh from this item's own H5P node every time, for every
  // concept, never gated on which concept this is. Closing it never
  // navigates, same as activeActivity above.
  const [inlineActivity, setInlineActivity] = useState<{
    item: LearnResourceItem;
    target: H5PActivityTarget;
  } | null>(null);
  // "Learn this concept visually" (additive). Every concept tries a real,
  // openly-licensed web image explaining it (see WebConceptVisual.tsx) — the
  // ordinary resource grid and inlineActivity behavior above are untouched
  // and still render alongside it. Closing it never navigates, same as
  // inlineActivity/activeActivity.
  const [journeyOpen, setJourneyOpen] = useState(false);
  // Flips true the moment WebConceptVisual reports it couldn't find a usable
  // web image for this concept (an ordinary outcome — most concepts won't
  // have one — not an error). From then on this same open session shows the
  // existing rule-based journey (generateJourneyRecipe/JourneyPlayer,
  // unchanged) instead — automatically, never a second button the student
  // has to notice and click. Reset on exit so the next open searches again.
  const [aiVisualUnavailable, setAiVisualUnavailable] = useState(false);

  const {
    result: completedResult,
    completed,
    loading: checkingCompletion,
  } = useConceptCompletion(conceptId);

  // The concept's real chapter NAME — used only to classify which generic
  // visual the journey uses (see interactive-journey/classify.ts); nothing
  // to do with completion/routing. Started from the URL's chapterId
  // immediately (rather than waiting on `data.chapterId`) so the journey
  // classifies correctly on first render instead of reclassifying once the
  // lesson itself finishes loading. `data?.chapterId` is only a fallback for
  // the rare case the URL didn't carry one — kept out of the dependency
  // array on purpose, so this never re-fetches a second time just because
  // `data` finished loading after chapterHint already resolved it once.
  const [chapterName, setChapterName] = useState<string | null>(null);
  const chapterIdForClassification = chapterHint || (data ? String(data.chapterId) : null);
  useEffect(() => {
    if (!chapterIdForClassification) return;
    let cancelled = false;
    loadChapterName(chapterIdForClassification).then((name) => {
      if (!cancelled) setChapterName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterIdForClassification]);

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchConceptLearn(conceptId, controller.signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The lesson could not be loaded.');
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

  /**
   * Record that the lesson was read, then let the engine decide the screen.
   *
   * Deliberately does NOT navigate straight to practice. Once taught_at is
   * stamped the engine answers `practice` by itself, and going through it keeps
   * D0's diagnostic diversion and D2's prerequisite gate intact - a hardcoded
   * jump would have silently overridden both.
   *
   * A concept with no guided-learning node has nothing for the engine to move,
   * and so no practice, check or mastery to go on to - that one returns to the
   * plan rather than re-opening the concept diagnostic as if it were practice.
   */
  const continueToNextStep = useCallback(async () => {
    setContinuing(true);
    setContinueError(null);

    try {
      const outcome = await acknowledgeConceptLearn(conceptId);

      const planChapterId = data?.chapterId || chapterHint;
      router.push(
        outcome.reason === 'no_eso_nodes'
          ? planChapterId
            ? `/pal/plan/chapter/${planChapterId}`
            : '/pal'
          : `/pal/eso?conceptId=${conceptId}`,
      );
    } catch (reason: unknown) {
      // Left on the page with the reason, rather than pushed into a screen that
      // would show the lesson again because the acknowledgement never landed.
      setContinueError(
        reason instanceof Error ? reason.message : 'That could not be recorded. Try again.',
      );
      setContinuing(false);
    }
  }, [conceptId, router, data, chapterHint]);

  if (checkingCompletion) return <Centered>Loading this concept…</Centered>;

  // Read-only: mastery in place of the lesson, and no CTA that would stamp
  // taught_at or hand the learner back to the engine.
  if (completed && completedResult) {
    const masteryChapterId = completedResult.chapterId || chapterHint || '';

    return (
      <PalWorkspace
        eyebrow="Concept mastery"
        title={completedResult.conceptName || 'Concept'}
        description="This concept is completed. Everything below is a record of how you got there."
        backHref={masteryChapterId ? `/pal/plan/chapter/${masteryChapterId}` : '/pal'}
        backLabel={masteryChapterId ? 'Back to my plan' : 'Back to subjects'}
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

  if (loading) return <Centered>Loading the lesson…</Centered>;

  if (error || !data) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'The lesson could not be loaded.'}</p>
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

  const chapterId = data.chapterId || Number(chapterHint) || 0;
  const backHref = chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal';
  // Always generated, for every concept, from that concept's own real name
  // + chapter name (+ authored description, when it has one) — never a
  // concept-id lookup, never defaulting to any one topic's visual (see
  // interactive-journey/generate.ts and classify.ts).
  const journeyRecipe = generateJourneyRecipe({
    conceptId: data.conceptId,
    conceptName: data.conceptName,
    chapterName,
    description: data.content?.body ?? null,
  });
  // There may be no guided LESSON while there is still plenty to read. Saying
  // "nothing has been prepared" above a list of nine resources is worse than
  // saying nothing at all.
  const hasResources = data.resources.sections.length > 0;

  // Pulled out of the ordinary grid below — see isConceptQuickCheck(). What's
  // left renders exactly as before, just without these items counted twice.
  const quickChecks = data.resources.sections
    .flatMap((section) => section.items)
    .filter(isConceptQuickCheck);
  const quickCheckIds = new Set(quickChecks.map((item) => item.id));
  const remainingSections = data.resources.sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !quickCheckIds.has(item.id)) }))
    .filter((section) => section.items.length > 0);

  // What the learner has available, summarised beside the lesson rather than
  // only discoverable by scrolling the list.
  const rail = (
    <>
      <PalRailSection title="Your journey">
        <JourneyRail
          current="learn"
          completed={stagesBefore('learn')}
          orientation="vertical"
        />
      </PalRailSection>

      {hasResources && (
        <PalRailSection title="Material">
          {data.resources.sections.map((section) => (
            <PalRailStat key={section.key} label={section.label} value={section.count} />
          ))}
          {data.resources.totals.conceptScoped > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {data.resources.totals.conceptScoped} matched to this concept; the rest cover the
              whole chapter.
            </p>
          )}
        </PalRailSection>
      )}

      {chapterId > 0 && (
        <PalRailSection title="Go to">
          <div className="space-y-2">
            <Link
              href={`/pal/mastery/chapter/${chapterId}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full justify-start',
              )}
            >
              My mastery
            </Link>
          </div>
        </PalRailSection>
      )}
    </>
  );

  return (
    <>
    <PalWorkspace
      eyebrow="Learn"
      title={data.conceptName || 'Learn'}
      description={
        data.attempt > 0
          ? 'A different explanation of the same idea — the last one did not quite land.'
          : 'Work through this, then practise it.'
      }
      backHref={backHref}
      backLabel={chapterId ? 'Back to my plan' : 'Back to subjects'}
      rail={rail}
    >
      {journeyOpen && aiVisualUnavailable && journeyRecipe ? (
        <JourneyPlayer
          conceptId={conceptId}
          conceptName={data.conceptName}
          recipe={journeyRecipe}
          onExit={() => {
            setJourneyOpen(false);
            setAiVisualUnavailable(false);
          }}
          onContinue={() => void continueToNextStep()}
          continuing={continuing}
          continueError={continueError}
        />
      ) : journeyOpen ? (
        <WebConceptVisual
          conceptId={conceptId}
          conceptName={data.conceptName}
          description={data.content?.body ?? null}
          onExit={() => {
            setJourneyOpen(false);
            setAiVisualUnavailable(false);
          }}
          onUnavailable={() => setAiVisualUnavailable(true)}
          onContinue={() => void continueToNextStep()}
          continuing={continuing}
          continueError={continueError}
        />
      ) : inlineActivity ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setInlineActivity(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to learning
          </button>

          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              Interactive activity
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{data.conceptName}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{inlineActivity.item.title}</p>
          </div>

          <H5PActivityBody target={inlineActivity.target} />
        </div>
      ) : (
        <>
      {/* What tripped this learner up here specifically — routed by
          MisconceptionLibraryService off a wrong diagnostic or practice
          answer (see palController::learnContent()'s own note). Leads the
          page: this is the most targeted material there is, ahead of the
          chapter-wide resources below. */}
      {data.misconceptions.length > 0 && (
        <div className="mb-5 space-y-3">
          {data.misconceptions.map((item) => (
            <Card key={item.misconceptionTag} className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                  <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
                  {item.title}
                </CardTitle>
                <CardDescription className="text-amber-800">
                  What tripped you up on this concept
                </CardDescription>
              </CardHeader>
              {item.body && (
                <CardContent className="text-sm text-amber-900">{item.body}</CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Opens the real-web-image visual explanation (WebConceptVisual) first,
          falling back automatically to the rule-based journey only if no
          usable image is found. Deliberately independent of the resource grid below — most
          concepts have nothing authored in `resources` at all, so this
          cannot be "one more card in the h5p section": it has to stand on
          its own. Always rendered — every concept gets one. */}
      <div className="mb-5">
        <JourneyEntryCard onStart={() => setJourneyOpen(true)} />
      </div>

      {/* A different kind of interaction from everything below: not one more
          card in a resource grid, but a short, tappable challenge built from
          this concept's own question bank (see isConceptQuickCheck()). Sits
          ahead of the reading material on purpose — try it, then read if it
          didn't land, rather than only ever reading first. */}
      {quickChecks.length > 0 && (
        <div className="mb-5 space-y-2.5">
          {quickChecks.map((item) => {
            const target = h5pTarget(item);
            if (!target) return null;
            const label = stripQuickCheckPrefix(item.title);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveActivity({ item, target })}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-white px-4 py-3.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <Zap aria-hidden className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600">
                    <Sparkles aria-hidden className="h-3 w-3" />
                    Quick check — true or false
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{label}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-300 group-hover:scale-105">
                  Try it
                  <Play aria-hidden className="h-3 w-3 fill-current" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {remainingSections.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Everything for this topic</h2>
            <p className="text-xs text-slate-500">
              {data.resources.totals.items - quickChecks.length}{' '}
              {data.resources.totals.items - quickChecks.length === 1 ? 'resource' : 'resources'}
              {data.resources.totals.conceptScoped > 0 &&
                ` · ${data.resources.totals.conceptScoped} matched to this concept`}
            </p>
          </div>

          {remainingSections.map((section) => (
            <ResourceSection
              key={section.key}
              section={section}
              onPlayActivity={(item) => {
                const target = h5pTarget(item);
                if (!target) return;
                // "Interactive activities" plays in place, directly below the
                // heading, for every concept — resolved fresh from this
                // item's own H5P node, never a hardcoded concept or activity.
                // Every other section keeps the full-screen overlay.
                if (section.key === 'h5p') {
                  setInlineActivity({ item, target });
                  return;
                }
                setActiveActivity({ item, target });
              }}
            />
          ))}
        </div>
      )}

      {/* Always shown. It used to be gated on there being a lesson card above
          it, which is gone - and "I have read this" is what records the lesson
          as read and moves the learner to practice, so it must not disappear
          just because a concept has nothing authored. Present for a piloted
          concept too, exactly as before the Interactive Activity card was
          added — that card is purely additive, so this stays the one way to
          move on without opening it. */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        {continueError && (
          <div className="mb-3">
            <p className="text-sm text-rose-700">{continueError}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Records that the lesson was read, THEN hands over to the engine.
                Without the first step taught_at stays null, the engine serves
                `teach` again, and the learner gets a second lesson screen
                showing one video they have just worked through. */}
          <Button onClick={() => void continueToNextStep()} disabled={continuing}>
            {continuing && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}I have
            read this — continue
            {!continuing && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </div>
        </>
      )}
    </PalWorkspace>

    {activeActivity && (
      <InlineActivityOverlay
        title={activeActivity.item.title}
        target={activeActivity.target}
        onClose={() => setActiveActivity(null)}
      />
    )}
    </>
  );
}

/**
 * The activity, mounted in place over the lesson rather than on a page of its
 * own. Closing it is the only exit — never a navigation, so the student is
 * exactly back on Learn where they left it. See `H5PActivityPlayer` for what
 * actually renders inside: the same player the activity's own `/h5p/{type}`
 * page uses, just embedded here.
 */
/**
 * The player, in place — swapped for a plain completion summary the instant
 * it reports a result. A native H5P player's own "finished" screen (e.g.
 * FlashcardPlayerContent's result dialog) is a fixed, full-screen overlay of
 * its own; left in place it would sit on top of whatever "back"/"close"
 * control the caller offers, with no way past it. Shared here so both the
 * full-screen overlay below and the in-page "Interactive activities" view
 * get the same safe behavior instead of duplicating it.
 */
function H5PActivityBody({ target }: { target: H5PActivityTarget }) {
  const [result, setResult] = useState<QuestionResult | null>(null);

  if (result) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white px-6 py-16 text-center shadow-sm animate-in fade-in zoom-in-95 duration-300">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 aria-hidden className="h-7 w-7" />
        </span>
        <p className="mt-1 text-base font-semibold text-emerald-900">Nice work — activity complete.</p>
        {result.score !== null && result.maxScore !== null && (
          <p className="text-sm text-emerald-700">
            Score: {result.score}/{result.maxScore}
          </p>
        )}
      </div>
    );
  }

  return <H5PActivityPlayer target={target} onResult={setResult} />;
}

function InlineActivityOverlay({
  title,
  target,
  onClose,
}: {
  title: string;
  target: H5PActivityTarget;
  onClose: () => void;
}) {
  // A full-screen takeover, not a boxed dialog on a dimmed backdrop: a
  // guided, multi-step lesson (teach -> try it -> check, repeated per topic)
  // reads as its own place to be, not a popup interrupting the page behind
  // it. Still closes back to exactly this Learn page - nothing here
  // navigates.
  //
  // Portalled straight to document.body: DashboardShell (or something
  // between it and here) puts a transform/filter on an ancestor, which pins
  // `position: fixed` to THAT box instead of the real viewport - the exact
  // reason this rendered as a small boxed dialog with page content still
  // visible around every edge instead of a true full-screen takeover. A
  // portal renders outside that ancestor entirely, so `fixed` means the
  // browser viewport again.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-in fade-in duration-200">
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-4 sm:px-8 sm:py-5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, white 0, transparent 35%), radial-gradient(circle at 85% 80%, white 0, transparent 30%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/30">
              <Puzzle aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                Interactive activity
              </p>
              <h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Close and continue learning"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <H5PActivityBody target={target} />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-8">
        <Button
          onClick={onClose}
          className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.99]"
        >
          Continue learning
          <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>,
    document.body
  );
}

/**
 * How each kind of material reads: its icon, the colour that ties its cards
 * together, and the wash a card falls back to when it has no thumbnail.
 * Keyed by `LearnResourceItem['section']` / `LearnResourceSection['key']`.
 */
interface SectionStyle {
  icon: typeof FileText;
  gradient: string;
  accent: string;
  border: string;
  chip: string;
}

const SECTION_STYLE: Record<string, SectionStyle> = {
  video: {
    icon: MonitorPlay,
    gradient: 'from-indigo-500 to-indigo-700',
    accent: 'text-indigo-600',
    border: 'hover:border-indigo-300',
    chip: 'bg-indigo-600',
  },
  presentation: {
    icon: Presentation,
    gradient: 'from-amber-500 to-amber-600',
    accent: 'text-amber-600',
    border: 'hover:border-amber-300',
    chip: 'bg-amber-600',
  },
  notes: {
    icon: FileText,
    gradient: 'from-sky-500 to-sky-700',
    accent: 'text-sky-600',
    border: 'hover:border-sky-300',
    chip: 'bg-sky-600',
  },
  classroom: {
    icon: School,
    gradient: 'from-violet-500 to-violet-700',
    accent: 'text-violet-600',
    border: 'hover:border-violet-300',
    chip: 'bg-violet-600',
  },
  h5p: {
    icon: Puzzle,
    gradient: 'from-fuchsia-500 to-fuchsia-700',
    accent: 'text-fuchsia-600',
    border: 'hover:border-fuchsia-300',
    chip: 'bg-fuchsia-600',
  },
  other: {
    icon: BookOpen,
    gradient: 'from-slate-400 to-slate-600',
    accent: 'text-slate-600',
    border: 'hover:border-slate-300',
    chip: 'bg-slate-600',
  },
};

function sectionStyle(key: string): SectionStyle {
  return SECTION_STYLE[key] ?? SECTION_STYLE.other;
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  pptx: 'Slides',
  ppt: 'Slides',
  docx: 'Document',
  doc: 'Document',
  mp4: 'Video',
  mp3: 'Audio',
  link: 'Web link',
  video: 'Video',
  h5p: 'Interactive',
  jpg: 'Image',
};

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);

  return minutes < 1 ? 'Under a minute' : `${minutes} min`;
}

/**
 * The inline-play target for an H5P resource item, or null when it isn't one
 * (wrong section, a type `H5PActivityPlayer` doesn't cover yet, or the
 * backend couldn't resolve full chapter/subject/standard context for it —
 * see ConceptLearningResourceService::h5pPlayableUrl()). Those items still
 * fall back to `item.url` as an ordinary link further down.
 */
/**
 * A concept-scoped True/False pool generated by
 * `PalH5PModelController::generateTrueFalseFromChapter()` — the first proof
 * that a topic can get an interaction shaped by its own content instead of
 * always landing in the chapter's one course-presentation deck (see that
 * method's docblock). Pulled out of the ordinary resource grid so it reads as
 * the quick, tappable challenge it is, not as one more thumbnail among videos
 * and slides.
 */
function isConceptQuickCheck(item: LearnResourceItem): boolean {
  return item.h5pType === 'true_false' && item.scope === 'concept';
}

/** "Quick check: Multiplying integers" -> "Multiplying integers" — the concept
 *  name is already this page's title, so repeating it here would be noise. */
function stripQuickCheckPrefix(title: string): string {
  return title.replace(/^Quick check:\s*/i, '');
}

function h5pTarget(item: LearnResourceItem): H5PActivityTarget | null {
  if (!isInlineH5PPlayable(item.h5pType)) return null;

  const { h5pNodeId, chapterId, subjectId, standardId } = item.tags;
  if (!item.h5pType || !h5pNodeId || !chapterId || !subjectId || !standardId) return null;

  return { h5pType: item.h5pType, nodeId: h5pNodeId, chapterId, subjectId, standardId };
}

/**
 * One kind of resource.
 *
 * The scope badge is not decoration. Only videos are tagged to a concept; the
 * rest is reachable by chapter only, so the same items appear under every
 * concept in that chapter. Saying "for the whole chapter" is the difference
 * between a useful list and a misleading one.
 */
function ResourceSection({
  section,
  onPlayActivity,
}: {
  section: LearnResourceSection;
  onPlayActivity: (item: LearnResourceItem) => void;
}) {
  const { icon: Icon, accent } = sectionStyle(section.key);

  return (
    <section data-resource-section={section.key}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100', accent)}>
          <Icon aria-hidden className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
        <span className="text-xs text-slate-500">{section.count}</span>
        {section.scope === 'chapter' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            For the whole chapter
          </span>
        )}
        {section.scope === 'concept' && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            Matched to this concept
          </span>
        )}
      </div>

      {/* A grid rather than a list. The workspace gave the main column real
          width, and a card carries what a row could not: the still, the
          description, and the tagging - all of which were being fetched and
          then thrown away by a single truncated line. */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {section.items.map((item) => (
          <li key={item.id} className="flex">
            <ResourceCard item={item} sectionKey={section.key} onPlay={onPlayActivity} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceCard({
  item,
  sectionKey,
  onPlay,
}: {
  item: LearnResourceItem;
  sectionKey: string;
  onPlay: (item: LearnResourceItem) => void;
}) {
  const { icon: Icon, gradient, border, chip } = sectionStyle(sectionKey);
  const playableInline = h5pTarget(item) !== null;
  const typeLabel = item.fileType
    ? (FILE_TYPE_LABEL[item.fileType] ?? item.fileType.toUpperCase())
    : null;

  const difficulty =
    item.tags.difficulty === 'advance'
      ? 'Advanced'
      : item.tags.difficulty === 'basic'
        ? 'Foundational'
        : null;

  // Duration rides on the thumbnail, the way a video site would show it, when
  // there is a thumbnail to sit on; with no image to overlay it falls back
  // into the meta line below instead of disappearing.
  const durationOnThumbnail = Boolean(item.thumbnailUrl && item.durationSeconds);
  const meta = [
    !durationOnThumbnail && item.durationSeconds ? formatDuration(item.durationSeconds) : null,
    item.provider,
    item.h5pType ? item.h5pType.replace(/_/g, ' ') : null,
  ].filter(Boolean) as string[];

  const inner = (
    <>
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-100">
        {item.thumbnailUrl ? (
          // 105 of 109 approved videos carry a still. Decorative alt: the
          // title sits directly beneath, so announcing it twice helps nobody.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // A coloured wash, not a placeholder image: inventing a picture for
          // a PDF would be ornament, and the icon already says what kind of
          // thing this is.
          <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
            <Icon aria-hidden className="h-9 w-9 text-white/85" />
          </div>
        )}

        {typeLabel && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Icon aria-hidden className="h-3 w-3" />
            {typeLabel}
          </span>
        )}

        {durationOnThumbnail && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {formatDuration(item.durationSeconds as number)}
          </span>
        )}

        {item.url && sectionKey === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25">
            <span className="flex h-10 w-10 scale-90 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              <Play aria-hidden className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.category}
          </span>
          {difficulty && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                difficulty === 'Advanced' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {difficulty}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
        )}

        {meta.length > 0 && (
          <p className="mt-1.5 text-[11px] text-slate-500">{meta.join(' · ')}</p>
        )}

        {item.tags.metaTags && item.tags.metaTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.metaTags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.attribution && (
          <p className="mt-1.5 truncate text-[11px] text-slate-400">{item.attribution}</p>
        )}

        {/* mt-auto pins the footer to the bottom so cards in a row line up
            however much description each one happens to have. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', item.scope === 'concept' ? 'bg-indigo-500' : 'bg-slate-300')}
            />
            {item.scope === 'concept' ? 'This concept' : 'Whole chapter'}
          </span>

          {playableInline ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white',
                chip,
              )}
            >
              Play
              <Play aria-hidden className="h-3 w-3 fill-current" />
            </span>
          ) : item.url ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white',
                chip,
              )}
            >
              Open
              <ExternalLink aria-hidden className="h-3 w-3" />
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              Not available yet
            </span>
          )}
        </div>
      </div>
    </>
  );

  const shell = cn(
    'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300',
    (item.url || playableInline) && ['hover:-translate-y-0.5 hover:shadow-lg', border],
  );
  const interactiveClasses = cn(
    shell,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
    'motion-reduce:transition-none',
  );

  // An H5P node PAL Learn knows how to mount inline plays in place - no
  // navigation, no new tab. See H5PActivityPlayer for the registry of which
  // types that covers today; everything else falls through to the plain
  // link (or, with no url at all, the dead-card case) below exactly as
  // before.
  if (playableInline) {
    return (
      <button type="button" onClick={() => onPlay(item)} className={interactiveClasses}>
        {inner}
      </button>
    );
  }

  // No url and not inline-playable: nothing to open yet. Rendered as a plain
  // card rather than a dead link - a control that goes nowhere is worse than
  // none.
  if (!item.url) {
    return <div className={shell}>{inner}</div>;
  }

  return (
    <Link href={item.url} target="_blank" rel="noreferrer" className={interactiveClasses}>
      {inner}
    </Link>
  );
}
