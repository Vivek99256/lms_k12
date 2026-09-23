'use client';

<<<<<<< HEAD
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
=======
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Lock, Sparkles, Target } from 'lucide-react';

import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  defaultLearnerId,
  fetchDiagnostic,
  DIAGNOSTIC_GROUPS,
  fetchNextAction,
  fetchPracticeItem,
  fetchConceptMasteryDetails,
  SAMPLE_SUGGESTED_CONTENT,
  fetchCheckUnderstandingItems,
  submitCheckUnderstanding,
  fetchRetrievalItems,
  recordAttempt,
  renderInstruction,
  submitDiagnostic,
  submitRetrievalCheck,
  type DiagnosticItem,
  type DiagnosticPayload,
  type DiagnosticAvailability,
  type EsoAction,
  type EsoQuestion,
  type ConceptMasteryDetails,
  type MasteryGate,
  type PracticeItem,
} from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';
import { fetchConceptResult } from '@/app/pal/data/pal-diagnostic';
import { buildConceptFeedback, type ConceptFeedback } from '@/app/pal/data/pal-feedback';
import AiTutorPanel from '@/app/pal/eso/_components/AiTutorPanel';
import { isDirectMediaFile, looksLikeFile, toEmbedUrl } from '@/lib/video-embed';

/**
 * Whether to show the "Your plan / Suggested content" panel above the step.
 *
 * Turned off: it duplicated what /pal/plan/chapter/[chapterId] now says, and
 * its raw evidence counts read as jargon mid-lesson. Set to true to restore.
 */
const SHOW_SUPPORTING_PANELS = false;

/**
 * The Adaptive Learning Engine's guided concept flow — Developer Brief v1,
 * Phase 11/§H. Sequences diagnostic -> skip/teach -> misconception
 * correction -> practice -> mastery -> retention as ONE screen, calling
 * app/pal/data/pal-eso.ts throughout. This screen never decides what to
 * teach; it only renders whatever `action`/`llmInstruction` the engine
 * returns (see EsoPolicyService on the backend) — Pal's rendered text is a
 * courtesy, the plain instruction is always shown as a fallback.
 */
export default function EsoConceptFlowPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." />}>
      <EsoConceptFlow />
    </Suspense>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EsoConceptFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAsStudent = useViewAsStudent();

  const conceptId = Number(searchParams.get('conceptId') || '0');
  // The real student entry point (AdaptiveLearningButton) never puts
  // learnerId in this URL — it always resolves to defaultLearnerId(), the
  // authenticated session's own id. `?learnerId=` is read here only for
  // backward compatibility with any old link; it is never authoritative —
  // the backend independently derives and enforces the learner from the
  // caller's own JWT for every route below (EsoStudentOnlyAuth), so a
  // student-role caller passing anyone else's id is rejected regardless of
  // what this resolves to, and a staff/admin caller is rejected outright.
  const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();

  const [action, setAction] = useState<EsoAction | null>(null);
  // Bumped every time a freshly RESOLVED action is applied, and mixed into the
  // FlowStep key below.
  //
  // Without it a repeated stage is invisible. The engine legitimately answers
  // `practice` again for the 2nd and 3rd question of a practice phase - same
  // action, same node, same concept - so a key built from those three alone is
  // byte-identical, React reuses the step instance, its question-fetch effect
  // does not re-run, and the student is looking at the question they just
  // answered with their own answer still selected. It reads as a frozen screen.
  const [stepSeq, setStepSeq] = useState(0);
  // Two different states, deliberately. `loading` is the genuine cold start,
  // when there is nothing on screen yet. `refreshing` is resolving the NEXT
  // step while the student is still looking at the current one — that must not
  // blank the screen. It used to: every answer replaced the whole card with a
  // spinner for as long as the engine took to respond, which on this estate
  // (remote database, see the performance notes) reads as a hung app.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Plan step. It has no engine action — the engine decides what to teach,
  // and Plan is where the learner is shown what it decided and what remains.
  // Held in UI state so no D1-D5 rule had to change to make room for it, and
  // so it can never be mistaken for learner evidence.
  const [planPending, setPlanPending] = useState(false);

<<<<<<< HEAD
  // The Feedback step, on exactly the same terms as Plan: no engine action, no
  // D1-D5 change, held in UI state so it can never be mistaken for evidence.
  // It runs when the practice phase ends, so the learner reads what the set
  // showed BEFORE the check rather than after it.
  const [feedbackPending, setFeedbackPending] = useState(false);

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  /**
   * Put a newly resolved action on screen.
   *
   * The single place `action` is set, so the step-sequence bump can never be
   * forgotten on one path and not another. Still no interpretation of the
   * engine's decision here - the action is applied exactly as received.
   */
  const applyAction = useCallback((next: EsoAction) => {
    setAction((previous) => {
      // Diagnostic just finished: show the Plan before the first teaching
      // step, so the learner sees where they stand before being taught.
      // Never skipped by the UI — only the engine skips steps, and only when
      // its own policy says the step does not apply.
      if (previous?.action === 'diagnostic' && next.action !== 'diagnostic') {
        setPlanPending(true);
      }
<<<<<<< HEAD
      // The practice phase has just ended. Show the synthesis before the
      // consequential check, never after it - after it, it would be a
      // post-mortem of a decision already taken.
      if (
        previous &&
        PRACTICE_ACTIONS.includes(previous.action) &&
        !PRACTICE_ACTIONS.includes(next.action)
      ) {
        setFeedbackPending(true);
      }
      return next;
    });
=======
      return next;
    });
    setStepSeq((n) => n + 1);
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  }, []);

  /**
   * Is a resolve already in flight?
   *
   * nextAction() is not a read. It stamps `taught_at`, it writes an
   * eso_decision_log row, and — because the first call has already moved state
   * — a second concurrent call can resolve to a DIFFERENT step than the first.
   * Two overlapping resolves therefore do not merely waste a round trip; they
   * produce two different answers and the slower one wins, which is what put a
   * practice question on screen a second or two after the Learn card appeared.
   */
  const resolving = useRef(false);

  const refresh = useCallback(async () => {
    if (!conceptId || !learnerId || resolving.current) return;
    resolving.current = true;
    setRefreshing(true);
    setError(null);
    try {
<<<<<<< HEAD
      const next = await fetchNextAction(learnerId, conceptId);
      applyAction(next);
=======
      applyAction(await fetchNextAction(learnerId, conceptId));
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the next learning step.');
    } finally {
      resolving.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [learnerId, conceptId, applyAction]);
<<<<<<< HEAD
=======

  /**
   * Adopt the action a submit already returned, instead of asking again.
   *
   * Every ESO submit endpoint answers with the resolved next action (the
   * practice attempt ends at EsoPolicyService::evaluateProgress(), which IS
   * nextAction()). Discarding it and re-fetching was not merely a wasted round
   * trip: nextAction() writes an eso_decision_log row per call, so each answer
   * logged two decisions, and because the first call has already mutated state
   * the second could resolve DIFFERENTLY - showing the student a decision the
   * engine never made for their attempt.
   */
  const resolved = useCallback(
    (next: EsoAction) => {
      setError(null);
      applyAction(next);
    },
    [applyAction]
  );

  /**
   * The learner/concept pair the opening resolve has already been started for.
   *
   * React runs this effect twice on mount in development, and `learnerId`
   * legitimately changes once after mount when a staff "view as student"
   * selection resolves. Without a key, the first of those asked the engine for
   * a second decision it had not earned; with it, the opening resolve happens
   * exactly once per pair, and a genuine change of learner still re-resolves.
   */
  const opened = useRef<string | null>(null);

  /**
   * Learning happens on the Learn screen, including the second time round.
   *
   * The engine answers `teach` on a first pass and `reteach` after a failed
   * check. Both are "go and read", and the Learn page is where reading lives -
   * it shows every video, presentation, note and classroom resource for the
   * concept, where this screen's TeachStep could only show the single item the
   * content model picked. A learner re-learning got one video and no sense that
   * the rest was still there.
   *
   * `replace`, not `push`: the engine screen is a waypoint here, and leaving it
   * in history means Back lands on a screen that immediately forwards again.
   *
   * This cannot loop. The Learn page's continue button stamps taught_at before
   * returning, so the next resolve is `practice`.
   */
  const handedToLearn = useRef<string | null>(null);
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

  useEffect(() => {
    if (!action || !conceptId) return;
    if (action.action !== 'teach' && action.action !== 'reteach') return;

    const key = `${conceptId}:${action.action}:${action.nodeId ?? ''}`;
    if (handedToLearn.current === key) return;
    handedToLearn.current = key;

    router.replace(`/pal/learn/concept/${conceptId}`);
  }, [action, conceptId, router]);

  useEffect(() => {
    const key = `${learnerId}:${conceptId}`;
    if (opened.current === key) return;
    opened.current = key;

    // Deferred to a microtask so the setLoading/setError calls inside
    // refresh() don't fire synchronously within the effect body — same
    // convention as pal-view-as.ts's useViewAsStudent().
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh, learnerId, conceptId]);

  if (!conceptId) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Alert>A concept must be selected to start the concept diagnostic flow (add ?conceptId=... to the URL).</Alert>
      </div>
    );
  }

  // The stage list, and - while practising - how far through the phase they
  // are. Both were inline above the step before; in the rail they stay visible
  // without pushing the question itself down the page.
  const rail = (
    <>
      <PalRailSection title="Your progress">
        <LearningFlowRail
          action={action?.action ?? ''}
          stageKey={planPending ? 'plan' : undefined}
          orientation="vertical"
        />
      </PalRailSection>

      {action?.practiceProgress && action.practiceProgress.needed > 0 && (
        <PalRailSection title="This step">
          <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-sm text-slate-600">Question</span>
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {Math.min(action.practiceProgress.done + 1, action.practiceProgress.needed)} of{' '}
              {action.practiceProgress.needed}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{
                width: `${(action.practiceProgress.done / action.practiceProgress.needed) * 100}%`,
              }}
              role="progressbar"
              aria-valuenow={action.practiceProgress.done}
              aria-valuemin={0}
              aria-valuemax={action.practiceProgress.needed}
              aria-label="Practice questions answered"
            />
          </div>
        </PalRailSection>
      )}

      <PalRailSection title="Go to">
        <Link
          href="/pal"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
        >
          All subjects
        </Link>
      </PalRailSection>
    </>
  );

  return (
    <PalWorkspace
      eyebrow="Concept diagnostic"
      title="Practice"
      description="The engine picks each step from what you have already shown it."
      rail={rail}
    >
      {/* Cold start: the step skeleton paints immediately instead of leaving
          the student on a bare spinner while the engine resolves. The stage
          list is in the rail and is static, so it is already on screen. */}
      {loading && <StepSkeleton />}
      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm text-rose-800">{error}</p>
          {/* Without this the screen is a dead end - the only recovery was a
              manual page reload. */}
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && action && (
        <div
          data-eso-action={action.action}
          data-eso-node-id={action.nodeId ?? ''}
          data-eso-refreshing={refreshing ? 'true' : 'false'}
          // The current step stays on screen and readable while the next one is
          // resolved — dimmed and non-interactive so a second submit can't land,
          // but never blanked.
          className={refreshing ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}
        >
          {refreshing && (
            <div className="mb-3 flex items-center gap-2 text-xs text-indigo-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working out your next step...
            </div>
          )}

          {/* Hidden by request: the "Your plan / Suggested content" panel and
              its evidence-count breakdown ("3 more demonstrations", "Not part
              of this concept") are noise on the learning screen. The learner
              gets the same information, better framed, on the dedicated plan
              page at /pal/plan/chapter/[chapterId].

              Kept behind a flag rather than deleted: PlanAndSuggestions,
              PlanRow and the mastery-plan fetch are all still here and intact,
              so flipping this to true restores it exactly as it was. */}
          {SHOW_SUPPORTING_PANELS && (
            <PlanAndSuggestions learnerId={learnerId} conceptId={conceptId} actionKey={action.action} />
          )}

          {planPending ? (
            <PlanStep action={action} onContinue={() => setPlanPending(false)} />
          ) : feedbackPending ? (
            <FeedbackStep
              conceptId={action.conceptId ?? conceptId}
              action={action}
              onContinue={() => setFeedbackPending(false)}
            />
          ) : (
            <FlowStep
              // stepSeq is what makes a REPEATED stage remount. practice ->
              // practice on the same node is a different question, so the step
              // must be rebuilt: remounting resets item, selected, error and
              // submitting together, which no per-field reset can be trusted to
              // keep in step with.
              key={`${action.action}-${action.nodeId ?? ''}-${action.conceptId ?? conceptId}-${stepSeq}`}
              action={action}
              learnerId={learnerId}
              conceptId={conceptId}
              onAdvance={refresh}
              onResolved={resolved}
              onNavigateToConcept={(id) => router.push(`/pal/eso?conceptId=${id}${learnerId ? `&learnerId=${learnerId}` : ''}`)}
            />
          )}

          {/* Below the step, for the same reason PlanAndSuggestions sits above
              it: supporting context, fetched independently, never blocking the
              task. Keyed on the action so the governance re-reads after an
              attempt is logged. */}
          <AiTutorPanel learnerId={learnerId} conceptId={conceptId} actionKey={action.action} />
        </div>
      )}
    </PalWorkspace>
  );
}

/**
 * A step the engine wanted to serve but has no authored content for.
 *
 * Deliberately reassuring rather than apologetic about the learner: D2
 * guarantees `mastery_retained`, so nothing they earned is at risk. The
 * authoring gap is already logged server-side for whoever maintains content.
 */
function ContentUnavailableStep({ action }: { action: EsoAction }) {
  const router = useRouter();

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Nothing to show here yet
        </CardTitle>
        <CardDescription className="text-amber-800">
          This step is ready for you, but the material for it hasn&apos;t been added yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-amber-900">
          Your progress is safe — nothing you&apos;ve earned is affected, and this will pick up
          again as soon as the content is available.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/pal')}>
            Back to subjects
          </Button>
          {action.conceptId != null && (
            <Button variant="outline" onClick={() => router.push(`/pal/eso/mastery/${action.conceptId}`)}>
              See your progress
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The Plan step: the pause between finding out where the learner stands and
 * starting to teach them.
 *
 * It deliberately renders no content of its own — the plan and the suggestions
 * are already on screen in the tabs directly above, which is the point. This
 * card names the step, says what the engine decided to do next, and hands
 * control back. Duplicating the plan here would put two copies of the same
 * numbers on one screen.
 */
/**
 * The in-flow Feedback step.
 *
 * Compact on purpose, and it does not navigate. The engine flow is one screen
 * and has to stay one screen - sending a learner mid-flow to another route and
 * back would break the step sequence the whole page is built around. The
 * standalone page at /pal/feedback/concept/[conceptId] serves the ADAPTIVE
 * practice path, which is a different set of screens entirely.
 *
 * The reading itself comes from the same pure module both surfaces use, so the
 * two can never tell a learner different things about one practice set.
 */
function FeedbackStep({
  conceptId,
  action,
  onContinue,
}: {
  conceptId: number;
  action: EsoAction;
  onContinue: () => void;
}) {
  const [feedback, setFeedback] = useState<ConceptFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  const nextLabel =
    FLOW_STAGES.find((stage) => stage.actions.includes(action.action))?.label ?? 'the next step';

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      fetchConceptResult(conceptId, controller.signal)
        // Swallowed: this is an interstitial between two engine steps. A
        // failed read must never strand a learner mid-flow, so the step still
        // renders and still continues - just without the detail.
        .then((result) => setFeedback(buildConceptFeedback(result)))
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [conceptId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500" />
          What that practice showed
        </CardTitle>
        <CardDescription>
          A quick read of how that went, before the check.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Working that out…</p>
        ) : feedback && !feedback.isEmpty ? (
          <>
            <p className="text-sm text-slate-700">{feedback.headline}</p>

            {feedback.wentWell[0] && (
              <p className="text-sm text-slate-700">
                <span className="font-medium">Going well: </span>
                {feedback.wentWell[0].claim}
              </p>
            )}

            {feedback.toFix[0] && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800">
                <span className="font-medium">Worth fixing: </span>
                {feedback.toFix[0].claim}
              </p>
            )}

            <p className="text-sm text-slate-600">{feedback.checkReadiness.reason}</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Have a look at how that went, then carry on.
          </p>
        )}

        <div className="flex justify-end">
          <Button data-eso-feedback-continue onClick={onContinue}>
            Continue to {nextLabel.toLowerCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanStep({ action, onContinue }: { action: EsoAction; onContinue: () => void }) {
  const nextLabel =
    FLOW_STAGES.find((stage) => stage.actions.includes(action.action))?.label ?? 'the next step';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500" />
          Your plan
        </CardTitle>
        <CardDescription>
          Here&apos;s where you stand and what&apos;s left. Have a look above, then carry on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Based on your diagnostic, the next step is <span className="font-medium text-slate-900">{nextLabel}</span>.
        </p>
        <div className="flex justify-end">
          <Button data-eso-plan-continue onClick={onContinue}>
            Continue to {nextLabel.toLowerCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * "Plan" and "Suggested content" — the two supporting panels under the step.
 *
 * Both are evidence-derived. The plan counts DEMONSTRATIONS REMAINING straight
 * from the D1 verdict, so the number a student reads and the rule that grants
 * mastery are the same number; there is no separate progress figure to drift.
 * Suggested content comes from the existing PAL pedagogy pipeline, with the
 * bucket chosen server-side from the learner's actual concept state.
 *
 * Neither panel invents anything. Where nothing is authored, they say so.
 */
function PlanAndSuggestions({ learnerId, conceptId, actionKey }: { learnerId: string; conceptId: number; actionKey: string }) {
  const [details, setDetails] = useState<ConceptMasteryDetails | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    // Deferred to a microtask so setDetails doesn't fire synchronously within
    // the effect body — same convention as refresh() above.
    queueMicrotask(() => {
      if (cancelled) return;
      setDetails('loading');
      fetchConceptMasteryDetails(learnerId, conceptId)
        .then((d) => {
          if (!cancelled) setDetails(d);
        })
        .catch(() => {
          // Supporting context must never break the learning step.
          if (!cancelled) setDetails(null);
        });
    });
    return () => {
      cancelled = true;
    };
    // Re-read after each step so the remaining count stays truthful.
  }, [learnerId, conceptId, actionKey]);

  const [tab, setTab] = useState<'plan' | 'suggested'>('plan');

  if (details === 'loading') {
    return (
      <div className="my-6">
        <PanelTabs tab={tab} onChange={setTab} suggestedCount={null} />
        <Card className="mt-3">
          <CardContent className="space-y-2 pt-6">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (details === null) return null;

  return (
    <div className="my-6" data-eso-support-tab={tab}>
      <PanelTabs tab={tab} onChange={setTab} suggestedCount={details.suggestedContent.length} />
      <Card className="mt-3">
        <CardContent className="pt-6">
          {tab === 'plan' ? <PlanBody details={details} /> : <SuggestedContentBody details={details} />}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Tab strip for the two supporting panels.
 *
 * Same shape as GamificationTabs — a pill row on a bordered rail — but these
 * switch local state rather than navigating, because both views belong to the
 * concept already on screen and a route change would lose the learner's step.
 */
function PanelTabs({
  tab,
  onChange,
  suggestedCount,
}: {
  tab: 'plan' | 'suggested';
  onChange: (t: 'plan' | 'suggested') => void;
  suggestedCount: number | null;
}) {
  const tabs: Array<{ key: 'plan' | 'suggested'; label: string; icon: typeof Target; count?: number | null }> = [
    { key: 'plan', label: 'Your plan', icon: Target },
    { key: 'suggested', label: 'Suggested content', icon: Sparkles, count: suggestedCount },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist">
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            data-eso-tab={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {/* Only shown when there is something to count — an empty badge
                would imply content exists where none is authored. */}
            {count != null && count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** One gated node type's distance to mastery, in demonstrations. */
function PlanRow({ label, gate }: { label: string; gate: MasteryGate | null }) {
  if (!gate || !gate.applicable) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="text-xs text-slate-400">Not part of this concept</span>
      </div>
    );
  }

  if (gate.notAssessed) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">Not assessed yet</span>
      </div>
    );
  }

  const done = gate.requiredEvents - gate.remainingEvents;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className={`text-xs ${gate.meetsFloor ? 'text-emerald-700' : 'text-slate-500'}`}>
          {gate.meetsFloor
            ? 'Enough demonstrations'
            : `${gate.remainingEvents} more demonstration${gate.remainingEvents === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: gate.requiredEvents }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-indigo-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
      {gate.independentRemaining > 0 && (
        <p className="text-xs text-slate-500">
          Including {gate.independentRemaining} without a hint, on your own.
        </p>
      )}
    </div>
  );
}

function PlanBody({ details }: { details: ConceptMasteryDetails }) {
  const plan = details.plan;

  return (
    <div role="tabpanel" className="space-y-4">
      <p className="text-sm text-slate-500">What&apos;s left before this concept counts as mastered.</p>

      {plan === null ? (
        <p className="text-sm text-slate-500">
          This concept is locked until its prerequisite is in place — that comes first.
        </p>
      ) : (
        <>
          <PlanRow label="Knowledge" gate={plan.knowledge} />
          <PlanRow label="Application" gate={plan.application} />

          {plan.misconceptionBlocks && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              There&apos;s a mix-up to clear up first — that has to be sorted before mastery counts.
            </div>
          )}

          {!plan.misconceptionBlocks && plan.remainingEvents === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Everything needed is in place.
            </div>
          )}

          {plan.remainingEvents > 0 && !plan.misconceptionBlocks && (
            <p className="text-sm font-medium text-slate-900">
              {plan.remainingEvents} demonstration{plan.remainingEvents === 1 ? '' : 's'} to go.
            </p>
          )}

          {plan.stale && (
            <p className="text-xs text-sky-700">It&apos;s been a while — a quick review will confirm this is still solid.</p>
          )}
        </>
      )}
    </div>
  );
}

function SuggestedContentBody({ details }: { details: ConceptMasteryDetails }) {
  // Real content when the pipeline has any; the development placeholder set
  // otherwise, so the tab is never a dead card during a demo. Swapping in real
  // `content_master` rows removes the placeholders with no code change.
  const real = details.suggestedContent;
  const items = real.length > 0 ? real : SAMPLE_SUGGESTED_CONTENT;
  const showingSamples = real.length === 0;

  return (
    <div role="tabpanel" className="space-y-3">
      <p className="text-sm text-slate-500">Optional — nothing here is graded.</p>

      {showingSamples && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sample content — nothing has been authored for this concept yet, so these are
          placeholders to show the shape of the feature.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          {details.status === 'not_started'
            ? 'Once the diagnostic shows where you are, suggestions will appear here.'
            : 'No suggested content available yet.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="text-sm">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-indigo-700 underline hover:text-indigo-900"
                >
                  {item.title}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="font-medium text-slate-800">{item.title}</span>
              )}
              {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Where the student is in the journey, derived ONLY from the action the engine
 * actually resolved — there is no separate progress state to drift out of sync
 * with the resolver. An action that isn't a stage of the main line (a
 * prerequisite gate, a misconception detour) leaves every stage unhighlighted
 * rather than guessing, because the student genuinely is off the main line at
 * that moment.
 */
const FLOW_STAGES: Array<{ key: string; label: string; actions: string[] }> = [
  { key: 'diagnostic', label: 'Chapter diagnostic', actions: ['diagnostic'] },
  // Adaptive has no engine action either — it is the chapter-level practice
  // stage that runs on its own screens (/pal/adaptive/*), before a learner
  // ever reaches this one. Listed so this rail reads the same as the shared
  // JourneyRail every other PAL screen shows; leaving it out made the journey
  // look like two different journeys depending on which screen you were on.
  { key: 'adaptive', label: 'Concept diagnostic', actions: [] },
  // Plan has no engine action of its own, and deliberately so: the engine
  // decides WHAT to teach, and Plan is where the learner is shown what it
  // decided and what remains. It is driven by `planPending` in the page rather
  // than by a policy branch, so no D1-D5 rule changes to accommodate it.
  { key: 'plan', label: 'Plan', actions: [] },
  { key: 'learn', label: 'Learn', actions: ['teach', 'reteach'] },
  // Practice BEFORE check, matching the engine's own phaseFor() order
  // (Learn -> Practice -> Check). These two were the wrong way round, so the
  // rail ticked Check off as already passed while the student was still
  // practising - and since the rail is the only progress indicator on the
  // screen, it never moved across the three practice questions either.
<<<<<<< HEAD
  { key: 'practice', label: 'Practice', actions: ['practice', 'continue_practice'] },
  // Feedback has no engine action, and follows Plan's precedent exactly. The
  // engine's vocabulary goes straight from practice/continue_practice to
  // check_understanding; there is no "synthesise the set" action, and adding
  // one would be a D1-D5 policy change made to serve a screen. It is driven by
  // `feedbackPending` on the practice -> not-practice edge, the same way
  // `planPending` runs on the diagnostic -> not-diagnostic edge.
  { key: 'feedback', label: 'Feedback', actions: [] },
  { key: 'check', label: 'Check', actions: ['check_understanding'] },
  // Extra support has no engine action ON PURPOSE, and this is the
  // load-bearing decision in this list.
  //
  // The tempting mapping is remediate_prerequisite / serve_contrast_pair /
  // reteach. That would be wrong twice. Those are the engine's TIER-1
  // automatic repair - it fixes the next step by itself, nobody is told and
  // nothing is escalated - and they are deliberately off-path today, which is
  // what produces the "Checking a prerequisite first" / "Clearing up a mix-up
  // first" aside below. Mapping them here would delete that note AND light a
  // human-escalation stage every time the engine did its ordinary job.
  //
  // Extra support is TIER 2: a person opens it and a person closes it. It
  // lights only from an open intervention record. See
  // app/pal/data/pal-intervention.ts.
  { key: 'intervention', label: 'Extra support', actions: [] },
  { key: 'check', label: 'Check', actions: ['check_understanding'] },
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  { key: 'practice', label: 'Practice', actions: ['practice', 'continue_practice'] },
  { key: 'check', label: 'Check', actions: ['check_understanding'] },
  { key: 'mastery', label: 'Mastery', actions: ['mastered_stop_practice'] },
  // Recall is the whole D2 retention exchange, not a new retention mechanism:
  // `retrieval_due` is the check being served, and `retained` / `reloop_node`
  // are its outcome. They were briefly two pills, but a learner passing a check
  // moves through both in a single action and never rests on the first — so
  // one stage tells the truth about what they experience. The retention ladder
  // and retrieval-check behaviour are untouched either way.
  { key: 'recall', label: 'Recall', actions: ['retrieval_due', 'retained', 'reloop_node'] },
];

/**
 * The actions that mean "still practising".
 *
 * Read off FLOW_STAGES rather than written out again, so the edge that fires
 * the Feedback step can never disagree with the stage the rail is lighting.
 */
const PRACTICE_ACTIONS: string[] =
  FLOW_STAGES.find((stage) => stage.key === 'practice')?.actions ?? [];

/**
 * Stages that only some learners walk. Kept in step with JourneyRail's
 * CONDITIONAL_STAGES by hand, exactly as the two stage lists themselves are.
 */
const CONDITIONAL_FLOW_STAGES: string[] = ['intervention'];

/**
 * Shape of the step that is coming, shown during the cold start so the first
 * paint is the layout the student is about to use rather than an empty screen.
 * Deliberately not a fake question — it claims nothing about the content.
 */
function StepSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-block h-5 w-40 animate-pulse rounded bg-slate-200 align-middle" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Deciding what you need next...
        </div>
      </CardContent>
    </Card>
  );
}

function LearningFlowRail({
  action,
  stageKey,
  orientation = 'horizontal',
}: {
  action: string;
  stageKey?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
<<<<<<< HEAD
  // `stageKey` marks a stage the UI owns rather than the engine — Plan and
  // Feedback, neither of which has an action of its own. Everything else still
  // derives from the resolved action, so the rail can never drift from the
  // engine.
=======
  // `stageKey` marks a stage the UI owns rather than the engine — currently
  // only Plan, which has no action of its own. Everything else still derives
  // from the resolved action, so the rail can never drift from the engine.
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  const activeIndex = stageKey
    ? FLOW_STAGES.findIndex((stage) => stage.key === stageKey)
    : FLOW_STAGES.findIndex((stage) => stage.actions.includes(action));

<<<<<<< HEAD
  /**
   * Is this a stage the learner was never asked to walk?
   *
   * The "everything before the active index is done" shortcut is a lie for
   * Extra support: a learner on Mastery is past it in the list, and without
   * this a tick would appear claiming they went through an escalation nobody
   * ever opened. Mirrors JourneyRail's `bypassed`, for the same reason and
   * with the same non-colour marker.
   */
  const bypassed = (index: number) =>
    index !== activeIndex && CONDITIONAL_FLOW_STAGES.includes(FLOW_STAGES[index].key);

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  const offPath = activeIndex < 0;
  const asideNote = offPath
    ? action === 'serve_contrast_pair'
      ? 'Clearing up a mix-up first'
      : action === 'remediate_prerequisite' || action === 'prerequisite_quick_probe'
        ? 'Checking a prerequisite first'
        : action === 'content_unavailable'
          ? 'Waiting on content'
          : 'Getting you set up'
    : null;

  // Vertical is the side-rail form, matching JourneyRail's so the two read as
  // one system. The engine still decides which stage is lit; only the axis
  // changes.
  if (orientation === 'vertical') {
    return (
      <div data-eso-flow-stage={offPath ? 'off-path' : FLOW_STAGES[activeIndex].key}>
        <ol className="flex flex-col gap-0">
          {FLOW_STAGES.map((stage, index) => {
<<<<<<< HEAD
            const skipped = bypassed(index);
            const done = !offPath && !skipped && index < activeIndex;
            const current = index === activeIndex;
            return (
              <li key={stage.key} data-eso-flow-bypassed={skipped || undefined} className="flex flex-col">
                <span
                  aria-current={current ? 'step' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
=======
            const done = !offPath && index < activeIndex;
            const current = index === activeIndex;
            return (
              <li key={stage.key} className="flex flex-col">
                <span
                  aria-current={current ? 'step' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
                    current
                      ? 'bg-indigo-50 font-semibold text-indigo-900'
                      : done
                        ? 'text-emerald-700'
<<<<<<< HEAD
                        : skipped
                          ? 'text-slate-400'
                          : 'text-slate-500'
=======
                        : 'text-slate-500'
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      current
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : done
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
<<<<<<< HEAD
                          : skipped
                            ? 'border-dashed border-slate-300 bg-white text-slate-400'
                            : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {done ? '✓' : skipped ? '–' : index + 1}
                  </span>
                  <span className="truncate">{stage.label}</span>
                  {skipped && <span className="sr-only">, not needed</span>}
                  {current && (
                    <span className="ml-auto text-[11px] font-medium text-indigo-600">Now</span>
                  )}
                  {skipped && (
                    <span aria-hidden className="ml-auto text-[11px] font-medium text-slate-400">
                      Not needed
                    </span>
                  )}
=======
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span className="truncate">{stage.label}</span>
                  {current && (
                    <span className="ml-auto text-[11px] font-medium text-indigo-600">Now</span>
                  )}
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
                </span>
                {index < FLOW_STAGES.length - 1 && (
                  <span
                    aria-hidden
<<<<<<< HEAD
                    className={`ml-[1.4rem] h-1.5 w-px shrink-0 ${
                      !offPath && !skipped && index < activeIndex ? 'bg-emerald-300' : 'bg-slate-200'
=======
                    className={`ml-[1.4rem] h-2 w-px shrink-0 ${
                      !offPath && index < activeIndex ? 'bg-emerald-300' : 'bg-slate-200'
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
        {asideNote && <p className="mt-2 px-1 text-xs text-amber-700">{asideNote}</p>}
      </div>
    );
  }

  return (
    <div data-eso-flow-stage={offPath ? 'off-path' : FLOW_STAGES[activeIndex].key} className="mb-4 flex flex-wrap items-center gap-1.5">
      {FLOW_STAGES.map((stage, index) => {
<<<<<<< HEAD
        const skipped = bypassed(index);
        const done = !offPath && !skipped && index < activeIndex;
=======
        const done = !offPath && index < activeIndex;
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
        const current = index === activeIndex;
        return (
          <span key={stage.key} className="flex items-center gap-1.5">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                current
                  ? 'border-indigo-400 bg-indigo-100 text-indigo-800'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : skipped
                      ? 'border-dashed border-slate-300 bg-white text-slate-400'
                      : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {stage.label}
              {skipped && <span className="sr-only">, not needed</span>}
            </span>
            {index < FLOW_STAGES.length - 1 && <span className="text-slate-300">›</span>}
          </span>
        );
      })}
      {/* Said explicitly rather than silently showing nothing highlighted. */}
      {asideNote && <span className="ml-1 text-xs text-amber-700">{asideNote}</span>}
    </div>
  );
}

function Alert({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {children}
    </div>
  );
}

function FlowStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
  onResolved,
  onNavigateToConcept,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
  /**
   * Hand back the action a submit returned, for the steps whose endpoint
   * already resolves the next one. Steps with nothing to record (teach's
   * acknowledge, "keep practising") still use onAdvance.
   */
  onResolved: (next: EsoAction) => void;
  onNavigateToConcept: (conceptId: number) => void;
}) {
  switch (action.action) {
    case 'diagnostic':
      return <DiagnosticStep learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'remediate_prerequisite':
      return <PrerequisiteStep action={action} onNavigateToConcept={onNavigateToConcept} />;
    case 'prerequisite_quick_probe':
      return <PrerequisiteProbeStep action={action} learnerId={learnerId} conceptId={conceptId} onResolved={onResolved} />;
    // Teaching is deliberately NOT the same screen as practice: it carries no
    // scored question. `reteach` is the same screen after a failed check — the
    // engine swaps in an "explain it a different way" instruction and re-opens
    // Learn, so it is an explanation to read, not a form to fill in.
    //
    // `reteach` used to be rendered by CheckUnderstandingStep, which put the
    // check questions directly under the re-explanation. That defeated the
    // engine's own ordering: a failed check nulls `taught_at` precisely so the
    // learner goes Learn -> Practice -> Check again rather than bouncing
    // Learn -> Check, and the engine says as much by returning
    // `expects: 'acknowledge'` on reteach. The client was answering a question
    // the engine had not asked.
    case 'teach':
    case 'reteach':
      return <TeachStep action={action} learnerId={learnerId} onAdvance={onAdvance} />;
    case 'check_understanding':
      return <CheckUnderstandingStep action={action} learnerId={learnerId} conceptId={conceptId} onResolved={onResolved} onAdvance={onAdvance} />;
    case 'practice':
      return <TeachOrPracticeStep action={action} learnerId={learnerId} conceptId={conceptId} onResolved={onResolved} onAdvance={onAdvance} />;
    case 'serve_contrast_pair':
      return <ContrastPairStep action={action} learnerId={learnerId} conceptId={conceptId} onResolved={onResolved} />;
    case 'mastered_stop_practice':
      return <MasteredStep action={action} />;
    // D4 can withhold mastery while leaving NO node to practise - every node is
    // past its own threshold, but the concept's evidence floor is not met yet.
    // nextAction() returns masteryVerdict() directly, so this reaches the top
    // level, and before this case it fell through to `default` and printed the
    // literal string "continue_practice" at the learner in a grey box.
    case 'continue_practice':
      return <KeepPractisingStep action={action} onAdvance={onAdvance} />;
    case 'retrieval_due':
      return <RetrievalDueStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    // D2 can resolve a due review that has no authored item behind it. The
    // learner keeps their mastery — this is our content gap, not their failure
    // — so this says so plainly instead of falling through to the raw action
    // string, which is what it did before.
    case 'content_unavailable':
      return <ContentUnavailableStep action={action} />;
    case 'no_nodes_defined':
      return (
        <Alert>
          This concept has no Knowledge/Ability/Skill nodes tagged yet — Phase 0 content tagging has not reached it.
        </Alert>
      );
    // An action this build does not render yet. The raw machine string used to
    // be printed here, which reads as a crash to a learner; this says what is
    // true and leaves a way forward.
    default:
      return (
        <Alert>
          This step is not available in this version yet. Nothing you have done is lost - your
          progress is saved.
        </Alert>
      );
  }
}

/**
 * D4 withheld mastery, and there is nothing left to practise on this concept.
 *
 * `masteryEvidence.remainingEvents` is an evidence count, so it is stated as
 * one. When the engine reports no count, this says nothing about distance
 * rather than inventing a number or a percentage.
 */
function KeepPractisingStep({ action, onAdvance }: { action: EsoAction; onAdvance: () => void }) {
  const remaining = action.masteryEvidence?.remainingEvents ?? null;
  const blocked = action.masteryEvidence?.misconceptionBlocks === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-600" />
          Nearly there
        </CardTitle>
        <CardDescription>
          {remaining != null && remaining > 0
            ? `This concept needs ${remaining} more demonstration${remaining === 1 ? '' : 's'} before it counts as mastered.`
            : 'This concept needs a little more evidence before it counts as mastered.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          {action.knowledgeMastery != null && (
            <MasteryFigure label="Knowledge" value={action.knowledgeMastery} />
          )}
          {action.applicationMastery != null && (
            <MasteryFigure label="Application" value={action.applicationMastery} />
          )}
        </div>

        {blocked && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            There is still a misconception flagged on this concept. Clearing it up comes before
            mastery.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onAdvance}>Keep going</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MasteryFigure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'positive';
}) {
  const pct = Math.round(value * 100);
  const positive = tone === 'positive';

  return (
    <div
      className={`min-w-[120px] flex-1 rounded-lg border px-3 py-2 ${
        positive ? 'border-emerald-200 bg-white' : 'border-slate-200'
      }`}
    >
      <p className={`text-xs ${positive ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          positive ? 'text-emerald-900' : 'text-slate-900'
        }`}
      >
        {pct}%
      </p>
      <div
        className={`mt-1.5 h-1.5 w-full overflow-hidden rounded-full ${
          positive ? 'bg-emerald-100' : 'bg-slate-100'
        }`}
      >
        <div
          className={`h-full rounded-full ${positive ? 'bg-emerald-600' : 'bg-indigo-600'}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} mastery`}
        />
      </div>
    </div>
  );
}

// ── D1: diagnostic ───────────────────────────────────────────────────────

/**
 * One diagnostic question. Extracted so the grouped and flat renderings share
 * exactly one markup path — the flat list is still how every chapter whose
 * questions carry no authored stage serves its diagnostic.
 */
function DiagnosticQuestion({
  item,
  index,
  selected,
  onSelect,
}: {
  item: DiagnosticItem;
  index: number;
  selected: number | undefined;
  onSelect: (optionId: number) => void;
}) {
  return (
    <div data-eso-question-id={item.questionId} data-eso-node-id={item.nodeId} className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
          {index + 1}
        </span>
        <Badge variant="secondary">{item.nodeType}</Badge>
      </div>
      <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
      <div className="mt-2 space-y-1.5">
        {item.options.map((option) => (
          <label
            key={option.id}
            data-eso-option-id={option.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              selected === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={`diagnostic-${item.questionId}`}
              checked={selected === option.id}
              onChange={() => onSelect(option.id)}
              className="h-4 w-4 accent-indigo-600"
            />
            <span dangerouslySetInnerHTML={{ __html: option.answer }} />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * The empty state, told truthfully.
 *
 * The old copy blamed "Phase 0 tagging" whatever the actual reason, which was
 * misleading whenever questions existed but were draft or unmapped. The
 * student-facing line stays plain in every case; the specific cause is shown
 * only to staff, who are the ones who can act on it.
 */
function DiagnosticUnavailable({ availability }: { availability: DiagnosticAvailability | null }) {
  const viewAsStudent = useViewAsStudent();
  const isStaff = viewAsStudent !== null;

  const staffDetail = (() => {
    if (!availability || availability.reason === 'none_authored') {
      return 'No diagnostic questions have been authored for this concept yet.';
    }
    if (availability.reason === 'awaiting_approval') {
      return `${availability.authored} diagnostic question(s) exist, but none are approved yet.`;
    }
    if (availability.reason === 'awaiting_node_mapping') {
      return `${availability.approved} approved question(s) exist, but none are mapped to a K/A/S node yet.`;
    }
    return `${availability.authored} question(s) exist; none are currently both approved and node-mapped.`;
  })();

  return (
    <Alert>
      <div className="space-y-1">
        <p>No diagnostic questions are currently available for this concept.</p>
        {isStaff && <p className="text-xs text-slate-500">{staffDetail}</p>}
      </div>
    </Alert>
  );
}

function DiagnosticStep({ learnerId, conceptId, onAdvance }: { learnerId: string; conceptId: number; onAdvance: () => void }) {
  const [payload, setPayload] = useState<DiagnosticPayload | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDiagnostic(learnerId, conceptId)
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the diagnostic.');
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, conceptId]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (payload === null) return <CenteredSpinner label="Building your diagnostic..." />;

  const items = payload.items;

  // Global empty state only when nothing is servable at all — never because a
  // single group happens to be empty.
  if (items.length === 0 && payload.groupedTotal === 0) {
    return <DiagnosticUnavailable availability={payload.availability} />;
  }

  // Grouped view when the content is authored with stages; otherwise the flat
  // list, which is how every currently-tagged chapter serves its diagnostic.
  const grouped = payload.groupedTotal > 0;

  // Whichever set is on screen is the set that can be answered and submitted.
  const answerable = grouped ? DIAGNOSTIC_GROUPS.flatMap(({ key }) => payload.groups[key]) : items;
  const answeredCount = Object.keys(answers).length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitDiagnostic(
        learnerId,
        conceptId,
        // Grouped and flat renderings answer into the same `answers` map, so
        // submission walks whichever set was actually shown. Scoring is
        // untouched: every response still carries its own node_id.
        answerable
          .map((item) => ({ nodeId: item.nodeId, answerMasterId: answers[item.questionId] }))
          .filter((r) => r.answerMasterId != null)
      );
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the diagnostic.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick diagnostic</CardTitle>
        <CardDescription>A few questions to find out what you already know, so we can skip it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped &&
          DIAGNOSTIC_GROUPS.map(({ key, label, description }) => {
            const groupItems = payload.groups[key];
            return (
              <section key={key} data-eso-diagnostic-group={key} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                  <span className="text-xs text-slate-500">
                    {groupItems.length === 0
                      ? 'No questions'
                      : `${groupItems.length} question${groupItems.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{description}</p>

                {/* Each group handles its own empty result — one empty group
                    never hides the others. */}
                {groupItems.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No {label.toLowerCase()} questions available for this concept.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {groupItems.map((item, index) => (
                      <DiagnosticQuestion
                        key={item.questionId}
                        item={item}
                        index={index}
                        selected={answers[item.questionId]}
                        onSelect={(optionId) => setAnswers((prev) => ({ ...prev, [item.questionId]: optionId }))}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {!grouped && items.map((item, index) => (
          <div key={item.questionId} data-eso-question-id={item.questionId} data-eso-node-id={item.nodeId} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                {index + 1}
              </span>
              {/* <Badge variant="secondary">{item.nodeType}</Badge> */}
            </div>
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    answers[item.questionId] === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`diagnostic-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {answeredCount} of {items.length} answered
          </span>
          <Button data-eso-submit onClick={submit} disabled={submitting || answeredCount === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Submit diagnostic
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── D2: prerequisite gate ────────────────────────────────────────────────

function PrerequisiteStep({ action, onNavigateToConcept }: { action: EsoAction; onNavigateToConcept: (id: number) => void }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Lock className="h-5 w-5" />
          A prerequisite needs work first
        </CardTitle>
        <CardDescription className="text-amber-700">
          You&apos;re not quite ready for this concept yet — a concept it builds on isn&apos;t solid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => action.prerequisiteConceptId && onNavigateToConcept(action.prerequisiteConceptId)}>
          Review the prerequisite
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * D2 staleness branch: the student passed this prerequisite before, but long
 * enough ago that the engine won't just take the old score's word for it. One
 * quick question re-establishes it — deliberately not a re-teach, and
 * deliberately not a hard block, since they probably do still know it.
 *
 * The answer goes through the ordinary attempt endpoint for the prerequisite's
 * own node, so a correct answer refreshes that node's evidence exactly the
 * same way normal practice does; getting it wrong lets the ordinary
 * unmet-prerequisite path take over on the next resolve.
 */
function PrerequisiteProbeStep({
  action,
  learnerId,
  conceptId,
  onResolved,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onResolved: (next: EsoAction) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = action.item ?? null;

  const submit = async () => {
    // Guarded on `submitting` as well as the disabled button — see the same
    // guard on the check step. A second POST here is worse than a wasted round
    // trip: recordAttempt() writes a response row and resolves the next action
    // from state the first call already moved, so the student could be handed a
    // step that belongs to neither attempt.
    if (!action.nodeId || selected == null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Same contract as the practice step: the attempt POST returns the
      // resolved next action, so it is adopted rather than re-requested.
      onResolved(await recordAttempt(learnerId, action.nodeId, { conceptId, answerMasterId: selected }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-sky-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sky-900">
          <Target className="h-5 w-5" />
          Quick check on something earlier
        </CardTitle>
        <CardDescription className="text-sky-700">
          {action.daysSinceLastEvidence
            ? `You covered this about ${action.daysSinceLastEvidence} days ago — one question to make sure it's still fresh before moving on.`
            : "One question on an earlier concept to make sure it's still fresh before moving on."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!item && <Alert>No check question is available for that earlier concept right now.</Alert>}

        {item && (
          <div data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected === option.id ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="probe-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-sky-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
            {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-3 flex justify-end">
              <Button data-eso-submit onClick={submit} disabled={selected == null || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pal instruction rendering (the one LLM call) ────────────────────────

function usePalRendering(learnerId: string, instruction: string | null) {
  // The plain instruction is the initial value (shown immediately) — the
  // effect below only ever upgrades it via an async callback, never sets
  // state synchronously in its body.
  const [rendered, setRendered] = useState<string | null>(instruction);

  useEffect(() => {
    if (!instruction) return;
    let cancelled = false;
    renderInstruction(learnerId, instruction)
      .then(({ rendered: text }) => {
        if (!cancelled && text) setRendered(text);
      })
      .catch(() => {
        /* keep the plain-instruction fallback already shown */
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, instruction]);

  return rendered;
}

/**
 * Same Pal round-trip as usePalRendering(), but starting from a student-facing
 * fallback instead of the raw instruction — used for the motivation nudge,
 * whose instruction is written about the student rather than to them.
 */
function usePalMotivation(learnerId: string, instruction: string | null, fallback: string | null) {
  const [rendered, setRendered] = useState<string | null>(fallback);

  useEffect(() => {
    if (!instruction) return;
    let cancelled = false;
    renderInstruction(learnerId, instruction)
      .then(({ rendered: text }) => {
        if (!cancelled && text) setRendered(text);
      })
      .catch(() => {
        /* keep the student-facing fallback already shown */
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, instruction]);

  return rendered;
}

// ── learning content from the PAL content model ──────────────────────────

/**
 * The concept's learning object, when the content model has one.
 *
 * Two genuinely different things arrive through the same field and are shown
 * differently on purpose:
 *   - `authored`: a real reviewed asset. It can carry a media URL, so it gets
 *     the same player/link treatment as a misconception corrective.
 *   - `derived`: an authoring SPECIFICATION backed by extracted curriculum
 *     text. Its `format` says what *should* be built. It is rendered as the
 *     text it actually is — never as a video placeholder, which would promise
 *     the student something that does not exist.
 *   - `institute_video` / `curated_video`: an approved video for this concept,
 *     served on a reteach. These carry provenance, which is shown: a student
 *     being handed a third-party video mid-remediation should be able to see
 *     where it came from, and a teacher checking a poor recommendation needs
 *     that on screen rather than in a database.
 */
function LearningContentPanel({ content }: { content: NonNullable<EsoAction['learningContent']> }) {
  const hasMedia = content.mediaUrl != null && content.mediaUrl !== '';

  const provenance =
    content.source === 'institute_video'
      ? "From your school's library"
      : content.source === 'curated_video'
        ? content.attribution
          ? `${content.attribution} on YouTube`
          : 'Recommended for this concept'
        : null;

  return (
    <div
      data-eso-learning-content={content.format}
      data-eso-content-source={content.source}
      className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-sky-900">{content.title || 'Learning material'}</span>
        {/* Only claim a format when there is an asset behind it. */}
        {hasMedia && <Badge variant="outline">{content.formatLabel}</Badge>}
      </div>

      {hasMedia && <CorrectiveResource url={content.mediaUrl as string} format={content.format} title={content.title} />}

      {hasMedia && provenance && <p className="text-xs text-sky-700">{provenance}</p>}

      {content.body && <div className="whitespace-pre-line text-sm text-sky-900">{content.body}</div>}
    </div>
  );
}

// ── D1 (teach) ───────────────────────────────────────────────────────────

/**
 * The explanation, on its own. No scored question lives here — that is the
 * whole point of splitting it out of the old combined teach/practice screen:
 * being taught is no longer practice attempt #1. The student reads, then asks
 * to be checked, which resolves to the CFU gate.
 */
/**
 * The engine's explanation, set to be read rather than skimmed past.
 *
 * ---------------------------------------------------------------------------
 * PRESENTATION ONLY
 * ---------------------------------------------------------------------------
 * This changes nothing about WHAT is said. The engine owns the words and this
 * layer is not permitted to interpret or rewrite them, so the only thing done
 * here is to break the string on its own blank lines and set it at a readable
 * size and measure. Previously the whole explanation arrived as one `text-sm`
 * paragraph in a tinted box however long it was, which is what made the teach
 * step read as a wall.
 *
 * If the text carries no blank lines it renders as one paragraph, exactly as
 * before, just larger and with more line height.
 */
function EngineProse({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3.5">
      <div className="space-y-2.5 text-[15px] leading-relaxed text-indigo-950">
        {(paragraphs.length > 0 ? paragraphs : [text]).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

function TeachStep({
  action,
  learnerId,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  onAdvance: () => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  const isRetry = action.action === 'reteach';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRetry ? "Let's look at this another way" : "Let's learn this"}</CardTitle>
        {isRetry && (
          <CardDescription>
            The same idea explained differently. Practice follows, then the check again.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <EngineProse text={message} />
        ) : (
          <CenteredSpinner label="Preparing the explanation..." />
        )}

        {/* Absent whenever the content model has nothing for this concept —
            the common case today, and the required graceful fallback. */}
        {action.learningContent && <LearningContentPanel content={action.learningContent} />}

        <div className="flex justify-end">
          {/* Practice is what comes next, not the check — the engine runs
              Learn -> Practice -> Check (EsoPolicyService::phaseFor()). This
              button used to promise the check and then open a practice
              question, which is the kind of mismatch that makes a flow feel
              broken even when every step of it is correct. */}
          <Button data-eso-acknowledge onClick={onAdvance} disabled={!message}>
            I&apos;ve read this — start practising
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── D1-CFU: check for understanding ──────────────────────────────────────

/**
 * The check that closes a node out, served AFTER the learner has practised it
 * (EsoPolicyService::phaseFor() runs Learn -> Practice -> Check). Answers here
 * are graded but are not mastery evidence — the engine records them with
 * mode='cfu' and never applies a mastery update — and a failed check re-opens
 * Learn rather than costing the learner anything they have earned.
 *
 * The screen no longer explains any of that to the learner. It used to open
 * with a Pal-rendered "this is just a quick check, not a graded test" preamble
 * and repeat the point underneath; both were removed, because telling someone
 * a step does not count is an invitation to coast through the one step that
 * decides whether they are re-taught. The mechanism is unchanged.
 */
function CheckUnderstandingStep({
  action,
  learnerId,
  conceptId,
  onResolved,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onResolved: (next: EsoAction) => void;
  /**
   * Only for the "nothing is authored for this node" escape hatch below, which
   * records no attempt and so has no returned action to adopt.
   */
  onAdvance: () => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  const [items, setItems] = useState<EsoQuestion[] | null | 'loading'>('loading');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A repeat pass, marked by the engine's own cycle count. This used to test
  // `action.action === 'reteach'`, which this component no longer receives —
  // reteach is a Learn screen and is routed to TeachStep.
  const isRetry = (action.cfuAttempts ?? 0) > 0;

  useEffect(() => {
    if (!action.nodeId) {
      queueMicrotask(() => setItems(null));
      return;
    }
    // Cancellable, and a late response is dropped rather than applied. React
    // re-runs this effect in development, and any second response landing on a
    // check the student had already started answering would swap the questions
    // out from under them — the same defect as the practice step below. The
    // server now answers identically within one check cycle, so the two
    // together make the questions fixed for the life of the step.
    const controller = new AbortController();
    let cancelled = false;

    // Keyed on cfuAttempts too, so a second cycle genuinely re-fetches rather
    // than showing the pair the student just failed.
    fetchCheckUnderstandingItems(learnerId, action.nodeId, controller.signal)
      .then((rows) => {
        if (!cancelled) setItems(rows.length > 0 ? rows : null);
      })
      .catch(() => {
        if (!cancelled) setItems(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [learnerId, action.nodeId, action.cfuAttempts]);

  const loaded = items !== 'loading' && items !== null ? items : [];
  const allAnswered = loaded.length > 0 && loaded.every((item) => answers[item.questionId] != null);

  const submit = async () => {
    // `submitting` is part of the guard, not only a spinner flag: the button is
    // disabled while a submit is in flight, but a double click, an Enter key
    // repeat or a re-render between the two can still land a second call, and
    // each one writes its own response rows and resolves its own next action.
    if (!action.nodeId || !allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Load-bearing here specifically: a FAILED check nulls taught_at to
      // re-open Learn, so this response is `reteach`. Asking the engine again
      // instead would re-resolve against the state the check just changed and
      // could answer something else entirely.
      onResolved(
        await submitCheckUnderstanding(
          learnerId,
          action.nodeId,
          conceptId,
          loaded.map((item) => ({ answerMasterId: answers[item.questionId] }))
        )
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRetry ? 'Check, second time round' : 'Check what stuck'}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">not graded</Badge>
          {/* cfuItemCount and cfuAttempts are already fetched and mapped on
              every CFU action and were being dropped. The engine bounds this
              loop at CFU_MAX_CYCLES, so a learner on their last cycle is
              entitled to know that before they answer rather than after. */}
          {action.cfuItemCount != null && action.cfuItemCount > 0 && (
            <span className="text-xs text-slate-500">
              {action.cfuItemCount} question{action.cfuItemCount === 1 ? '' : 's'}
            </span>
          )}
          {action.cfuAttempts != null && action.cfuAttempts > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Check {action.cfuAttempts + 1} — we&apos;ll go over it again if this one doesn&apos;t land
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{message}</div>
        )}

        {items === 'loading' && <CenteredSpinner label="Finding a couple of questions..." />}
        {items === null && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              There is no check question ready for this part yet. That is a gap on our side.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onAdvance}>Continue</Button>
            </div>
          </div>
        )}

        {loaded.map((item) => (
          <div key={item.questionId} data-eso-cfu-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    answers[item.questionId] === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`cfu-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && <Alert tone="error">{error}</Alert>}

        {loaded.length > 0 && (
          <div className="flex justify-end">
            <Button data-eso-cfu-submit onClick={submit} disabled={!allAnswered || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check my understanding
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── D4 (practice) ────────────────────────────────────────────────────────

function TeachOrPracticeStep({
  action,
  learnerId,
  conceptId,
  onResolved,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onResolved: (next: EsoAction) => void;
  /**
   * Only for the "nothing is authored for this node" escape hatch below, which
   * records no attempt and so has no returned action to adopt.
   */
  onAdvance: () => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  // Rendered through the same constrained Pal path as every other
  // instruction — the engine decided WHAT to say (and only when it had a real
  // fact to say it with); Pal only warms up the phrasing. Unlike the other
  // instructions, the fallback here is a purpose-written student-facing line
  // rather than the raw instruction: that text is engine-facing ("The student
  // has just understood…") and reads as meta-commentary if shown verbatim.
  const motivation = usePalMotivation(learnerId, action.motivationInstruction ?? null, action.motivationFallback ?? null);
  const [item, setItem] = useState<PracticeItem | null | 'loading'>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve to null rather than returning early: leaving `item` on
    // 'loading' rendered a full-height spinner with no control on the card,
    // and nothing ever cleared it.
    if (!action.nodeId) {
      // Deferred like every other setState in this file: calling it in the
      // effect body triggers a cascading render (react-hooks/set-state-in-effect).
      queueMicrotask(() => setItem(null));
      return;
    }
    // ───────────────────────────────────────────────────────────────────
    // A LATE RESPONSE MUST NOT REPLACE THE QUESTION ON SCREEN
    // ───────────────────────────────────────────────────────────────────
    // This used to fetch with no cancellation at all. React re-runs effects in
    // development, so two requests went out; the server picked its item with a
    // fresh shuffle() per call, so the two came back DIFFERENT; and the slower
    // one won. The student watched the question change by itself a second or
    // two after the step appeared — sometimes after they had already chosen an
    // answer, which then referred to a question no longer on screen.
    //
    // The server side of that is fixed (EsoPolicyService::practiceItem() is now
    // stable within a practice phase), and this is the client half of the same
    // guarantee: at most one response is ever applied per mounted step.
    //
    // .catch is load-bearing. Without it a rejected fetch never called
    // setItem, so the spinner ran for ever.
    const controller = new AbortController();
    let cancelled = false;

    fetchPracticeItem(learnerId, action.nodeId, controller.signal)
      .then((next) => {
        if (!cancelled) setItem(next);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [learnerId, action.nodeId]);

  const submit = async () => {
    // Guarded on `submitting` as well as the disabled button — see the same
    // guard on the check step. A second POST here is worse than a wasted round
    // trip: recordAttempt() writes a response row and resolves the next action
    // from state the first call already moved, so the student could be handed a
    // step that belongs to neither attempt.
    if (!action.nodeId || selected == null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // The POST answers with the resolved next action, so this is the engine's
      // decision for THIS attempt. Re-fetching it would log a second decision
      // and could come back different, since recording has already moved state.
      onResolved(
        await recordAttempt(learnerId, action.nodeId, {
          conceptId,
          answerMasterId: selected,
          mode: action.practiceMode,
        })
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Straight off the engine - `done` is the same count it gates the phase on and
  // `needed` is its own requirement. Nothing is computed here: the client does
  // not own the threshold and must not look as though it does.
  const progress = action.practiceProgress ?? null;
  const remaining = progress ? Math.max(progress.needed - progress.done, 0) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Only ever `practice` now — `teach` and `reteach` are TeachStep. */}
          <CardTitle>Practice</CardTitle>
          {/* Without this, three practice questions in a row are
              indistinguishable and answering one looks like it did nothing. */}
          {progress && progress.needed > 0 && (
            <span className="text-xs font-semibold tabular-nums text-slate-600">
              Question {Math.min(progress.done + 1, progress.needed)} of {progress.needed}
            </span>
          )}
        </div>
        {action.practiceMode && <Badge variant="outline">{action.practiceMode} practice</Badge>}
        {progress && progress.needed > 0 && (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.needed}
            aria-label="Practice questions answered"
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${(progress.done / progress.needed) * 100}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{message}</div>
        )}

        {/* The one-time "why is this worth practising" nudge, shown when the
            student has just understood this node and now has to practise it.
            Only ever present on the first practice call, and only when the
            concept actually has something concrete to say. */}
        {motivation && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{motivation}</span>
          </div>
        )}

        {item === 'loading' && <CenteredSpinner label="Finding a question..." />}
        {item === null && (
          // Was a bare Alert with no control of any kind — the submit button
          // lives inside the opposite branch, so this was a dead end.
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              There is no practice question ready for this part yet. That is a gap on our side, not
              yours — nothing you have earned is affected.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onAdvance}>Try the next step</Button>
            </div>
          </div>
        )}
        {item && item !== 'loading' && (
          <div data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="practice-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
            {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {/* Says what submitting will do, so it is obvious that it moved.
                  `remaining` counts what is still needed BEFORE this answer is
                  recorded, so 1 means "this is the last one". */}
              {/* Silent when the engine sends no progress, which it does once
                  the practice phase requirement is met and practice continues
                  for mastery reasons — there is no countdown to narrate then,
                  and inventing one is what had this line promising a check
                  that did not come. */}
              <span className="text-xs text-slate-500">
                {progress === null
                  ? ''
                  : remaining > 1
                    ? `${remaining} more after this one`
                    : 'Last one, then we check what stuck'}
              </span>
              <Button data-eso-submit onClick={submit} disabled={selected == null || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── D3: misconception contrast pair ──────────────────────────────────────

function ContrastPairStep({
  action,
  learnerId,
  conceptId,
  onResolved,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onResolved: (next: EsoAction) => void;
}) {
  const message = usePalRendering(learnerId, action.llmInstruction);
  const [explanation, setExplanation] = useState('');
  const [readyToRetest, setReadyToRetest] = useState(false);
  const [item, setItem] = useState<PracticeItem | null | 'loading'>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `item` already initializes to 'loading' and nothing else sets it
    // before this point, so the resolution below is the only setState here.
    if (!readyToRetest || !action.nodeId) return;
    fetchPracticeItem(learnerId, action.nodeId).then(setItem);
  }, [readyToRetest, learnerId, action.nodeId]);

  const submit = async () => {
    // Guarded on `submitting` as well as the disabled button — see the same
    // guard on the check step. A second POST here is worse than a wasted round
    // trip: recordAttempt() writes a response row and resolves the next action
    // from state the first call already moved, so the student could be handed a
    // step that belongs to neither attempt.
    if (!action.nodeId || selected == null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Same contract as the practice step: the attempt POST returns the
      // resolved next action, so it is adopted rather than re-requested.
      onResolved(await recordAttempt(learnerId, action.nodeId, { conceptId, answerMasterId: selected }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose-900">
          <AlertTriangle className="h-5 w-5" />
          Let&apos;s clear up a mix-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The evidence behind the call, before the correction itself: the
            answer they actually picked, what it points at, and whether this
            has come up before. A misconception claim the student can't check
            is a verdict; this makes it evidence. */}
        {(action.evidence?.chosenAnswer || action.misconceptionDescription) && (
          <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm">
            {action.evidence?.chosenAnswer && (
              <p className="text-slate-700">
                <span className="font-medium text-slate-900">You answered:</span>{' '}
                <span className="italic">{action.evidence.chosenAnswer}</span>
              </p>
            )}
            {action.misconceptionDescription && (
              <p className="mt-1.5 text-slate-600">
                <span className="font-medium text-slate-900">What that suggests:</span>{' '}
                {action.misconceptionDescription}
              </p>
            )}
            {(action.evidence?.previousOccurrences ?? 0) > 0 && (
              <p className="mt-1.5 text-xs font-medium text-rose-700">
                This has come up {action.evidence?.previousOccurrences === 1 ? 'once' : `${action.evidence?.previousOccurrences} times`} before on this part of the concept.
              </p>
            )}
          </div>
        )}

        {message && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</div>}

        {action.contrastPair?.body && (
          <div
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: action.contrastPair.body }}
          />
        )}

        {/* The corrective's own richer resource, when one exists. The engine
            has always returned mediaUrl/format here; until now the UI showed
            only `body` and silently dropped them, so a video or simulation
            corrective was never actually reachable. */}
        {action.contrastPair?.mediaUrl && (
          <CorrectiveResource
            url={action.contrastPair.mediaUrl}
            format={action.contrastPair.format}
            title={action.contrastPair.title}
          />
        )}

        {!readyToRetest && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">
              In your own words, what&apos;s the difference between the example and the non-example?
            </label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
            <Button data-eso-ready-to-retest onClick={() => setReadyToRetest(true)} disabled={explanation.trim().length === 0}>
              I understand — retest me
            </Button>
          </div>
        )}

        {readyToRetest && item === 'loading' && <CenteredSpinner label="Preparing a fresh question..." />}
        {readyToRetest && item === null && (
          <Alert>No fresh practice question is tagged for this node yet — Phase 0 content tagging is still in progress.</Alert>
        )}
        {readyToRetest && item && item !== 'loading' && (
          <div data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="retest-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
            {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-3 flex justify-end">
              <Button data-eso-submit onClick={submit} disabled={selected == null || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Retest
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A richer resource, launched directly rather than described.
 *
 * Three branches, in this order, because picking the wrong element gives the
 * student a black box rather than a lesson:
 *
 *   1. Something we can frame (YouTube, Vimeo) — an iframe. The reteach step
 *      can now serve an external video for concepts the school has none for,
 *      and those arrive as watch URLs. They previously fell into the <video>
 *      branch below on the strength of `format` alone and rendered as an empty
 *      black player.
 *   2. A real media file — the inline <video> player, which is what the
 *      school's own uploads are.
 *   3. Anything else — an honest link in a new tab. Third-party pages
 *      routinely refuse to be framed, and a blocked blank box is worse than a
 *      link the student can actually follow.
 */
function CorrectiveResource({ url, format, title }: { url: string; format: string | null; title: string | null }) {
  const embed = toEmbedUrl(url);

  if (embed) {
    return (
      // Capped rather than full-bleed: at card width a 16:9 frame is taller
      // than the viewport, so the questions underneath fall off the screen and
      // the step stops looking like a step. Still fluid below the cap.
      <div data-eso-media-kind="iframe" className="w-full max-w-2xl space-y-1.5">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-black">
          <iframe
            src={embed.src}
            title={title || embed.title}
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            className="h-full w-full border-0"
          />
        </div>
        {/* An owner can withdraw embedding permission after we harvested the
            video, which turns the frame into a refusal notice. This is the way
            out when that happens. */}
        <a
          href={embed.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Open in a new tab
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    );
  }

  const declaredVideo = (format ?? '').toLowerCase().includes('video');

  if (isDirectMediaFile(url) || (declaredVideo && looksLikeFile(url))) {
    return (
      // Same cap as the embed branch, so an uploaded mp4 and a YouTube video
      // sit at the same size on the page.
      <div
        data-eso-media-kind="file"
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-black"
      >
        <video src={url} controls className="h-auto w-full" />
      </div>
    );
  }

  return (
    <a
      data-eso-media-kind="link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800 transition-colors hover:bg-indigo-100"
    >
      <span className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        {title || 'Open the walkthrough for this'}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

// ── D4/D5: mastery + retention ───────────────────────────────────────────

/**
 * The unlock moment, not a status readout.
 *
 * Reaching mastery is the payoff for the practice grind, so this leads with
 * "Concept unlocked" and points at what's next, with the accuracy figures kept
 * as supporting detail rather than the headline. Any badge earned here comes
 * from the existing PAL gamification system (the engine nudges
 * BadgeService::evaluate() once the D4 verdict is logged) and surfaces in the
 * student's own badge view — this screen deliberately doesn't invent a second,
 * parallel reward display of its own.
 */
function MasteredStep({ action }: { action: EsoAction }) {
  const router = useRouter();

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />
          Concept unlocked
        </CardTitle>
        <CardDescription className="text-emerald-700">
          You&apos;ve cleared this concept — practice stops here. A short review will show up in a few days to lock it in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The payoff moment. These two numbers were a bare flex row of text;
            a learner who has just cleared a concept deserves to SEE what they
            cleared it on. Same figures, same source, shown as evidence. */}
        <div className="flex flex-wrap gap-3">
          {action.knowledgeMastery != null && (
            <MasteryFigure label="Knowledge" value={action.knowledgeMastery} tone="positive" />
          )}
          {action.applicationMastery != null && (
            <MasteryFigure label="Application" value={action.applicationMastery} tone="positive" />
          )}
        </div>

        {/* Extension Activity, when the existing PAL content pipeline has something for
            this chapter. Explicitly optional: nothing here is scored, and
            skipping it costs the student nothing. Absent entirely when no
            extension activity is authored — never a placeholder. */}
        {action.enrichment != null && action.enrichment.length > 0 && (
          <div data-eso-extension-activity className="space-y-2 rounded-lg border border-emerald-200 bg-white p-4">
            <div className="text-sm font-medium text-emerald-900">Want to go deeper? (optional)</div>
            <p className="text-xs text-emerald-700">
              Nothing here is graded — it won&apos;t change your mastery either way.
            </p>
            <ul className="space-y-1.5">
              {action.enrichment.map((item, index) => (
                <li key={`${item.title}-${index}`} className="text-sm">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-emerald-800 underline hover:text-emerald-900"
                    >
                      {item.title}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium text-emerald-800">{item.title}</span>
                  )}
                  {item.description && <div className="text-xs text-emerald-700">{item.description}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nothing unmastered and unlocked is left in this chapter. Said
            plainly rather than pointing at a concept that doesn't exist. */}
        {action.chapterComplete && (
          <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
            That&apos;s every concept in this chapter cleared. Reviews will keep coming back to keep it solid.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* The real advance step. The engine resolved this concept from the
              chapter's own relation graph and never offers one whose
              prerequisites are unmet, so this is a plain hand-off. */}
          {action.nextConcept != null && (
            <Button
              data-eso-next-concept={action.nextConcept.conceptId}
              onClick={() => router.push(`/pal/eso?conceptId=${action.nextConcept?.conceptId}`)}
            >
              Continue to {action.nextConcept.name ?? 'the next concept'}
            </Button>
          )}
          {action.conceptId != null && (
            <Button
              variant={action.nextConcept != null ? 'outline' : 'default'}
              onClick={() => router.push(`/pal/eso/mastery/${action.conceptId}`)}
            >
              See what this earned you
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/pal')}>
            Back to subjects
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── D5: delayed retrieval check ──────────────────────────────────────────

function RetrievalDueStep({
  action,
  learnerId,
  conceptId,
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
}) {
  const [items, setItems] = useState<EsoQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EsoAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The memory jog before the check. Null whenever the concept has no approved
  // material to build one from — the student then goes straight to the
  // questions rather than reading an invented refresher.
  const recap = usePalMotivation(learnerId, action.llmInstruction, action.recapFallback ?? null);

  useEffect(() => {
    if (!action.nodeId) return;
    fetchRetrievalItems(learnerId, action.nodeId)
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the review.'));
  }, [learnerId, action.nodeId]);

  const submit = async () => {
    if (!action.nodeId || !items) return;
    setSubmitting(true);
    setError(null);
    try {
      const responses = items.map((item) => ({ answerMasterId: answers[item.questionId] })).filter((r) => r.answerMasterId != null);
      const outcome = await submitRetrievalCheck(learnerId, action.nodeId, conceptId, responses);
      setResult(outcome);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const retained = result.action === 'retained';
    return (
      <Card className={retained ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
        <CardHeader>
          <CardTitle className={retained ? 'text-emerald-900' : 'text-amber-900'}>
            {retained ? 'Retained' : "Let's revisit this"}
          </CardTitle>
          <CardDescription className={retained ? 'text-emerald-700' : 'text-amber-700'}>
            {retained
              ? 'You still had it a few days later — this is locked in.'
              : 'This one slipped — just this part re-loops, nothing else in the chapter is affected.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onAdvance}>Continue</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          Quick review
          {/* retentionStage is mapped on every D5 action and was never shown.
              The ladder is 2/7/30/60/180 days, so the rung is the difference
              between "another quiz" and visible evidence that this is sticking
              for longer each time. */}
          {action.retentionStage != null && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              Review {action.retentionStage + 1}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {action.daysSinceLastEvidence != null && action.daysSinceLastEvidence > 0
            ? `A short check to make sure this is still solid ${action.daysSinceLastEvidence} day${action.daysSinceLastEvidence === 1 ? '' : 's'} on.`
            : 'A short check to make sure this is still solid a few days later.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recap && (
          <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
            <span data-eso-retention-recap>{recap}</span>
          </div>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {!items && !error && <CenteredSpinner label="Loading your review..." />}
        {items && items.length === 0 && <Alert>No review items are tagged for this node yet.</Alert>}
        {items?.map((item, index) => (
          <div key={item.questionId} data-eso-question-id={item.questionId} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-1 text-xs text-slate-400">Item {index + 1}</div>
            <div className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: item.title }} />
            <div className="mt-2 space-y-1.5">
              {item.options.map((option) => (
                <label
                  key={option.id}
                  data-eso-option-id={option.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    answers[item.questionId] === option.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`retrieval-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span dangerouslySetInnerHTML={{ __html: option.answer }} />
                </label>
              ))}
            </div>
          </div>
        ))}
        {items && items.length > 0 && (
          <div className="flex justify-end">
            <Button data-eso-submit onClick={submit} disabled={submitting || Object.keys(answers).length === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
