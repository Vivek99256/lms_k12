'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Lock, Sparkles, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  defaultLearnerId,
  fetchDiagnosticItems,
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
  type EsoAction,
  type EsoQuestion,
  type ConceptMasteryDetails,
  type MasteryGate,
  type PracticeItem,
} from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';

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

  const refresh = useCallback(async () => {
    if (!conceptId || !learnerId) return;
    setRefreshing(true);
    setError(null);
    try {
      const next = await fetchNextAction(learnerId, conceptId);
      setAction((previous) => {
        // Diagnostic just finished: show the Plan before the first teaching
        // step, so the learner sees where they stand before being taught.
        // Never skipped by the UI — only the engine skips steps, and only when
        // its own policy says the step does not apply.
        if (previous?.action === 'diagnostic' && next.action !== 'diagnostic') {
          setPlanPending(true);
        }
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the next learning step.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [learnerId, conceptId]);

  useEffect(() => {
    // Deferred to a microtask so the setLoading/setError calls inside
    // refresh() don't fire synchronously within the effect body — same
    // convention as pal-view-as.ts's useViewAsStudent().
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  if (!conceptId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert>A concept must be selected to start the adaptive flow (add ?conceptId=... to the URL).</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto  px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Sparkles className="h-4 w-4 text-violet-500" />
        Adaptive learning
      </div>

      {/* Cold start: the rail is static, so it paints immediately instead of
          leaving the student on a bare spinner while the engine resolves. */}
      {loading && (
        <>
          <LearningFlowRail action="" />
          <StepSkeleton />
        </>
      )}
      {!loading && error && <Alert tone="error">{error}</Alert>}

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
            <div className="mb-3 flex items-center gap-2 text-xs text-violet-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working out your next step...
            </div>
          )}
          <LearningFlowRail action={action.action} stageKey={planPending ? 'plan' : undefined} />

          {/* Sits at the top of the learning section, directly under the
              progression rail: plan first, then the step it explains. Its data
              is fetched independently and never blocks the step below — the
              backend is remote, and this is supporting context, not the task. */}
          <PlanAndSuggestions learnerId={learnerId} conceptId={conceptId} actionKey={action.action} />

          {planPending ? (
            <PlanStep action={action} onContinue={() => setPlanPending(false)} />
          ) : (
            <FlowStep
              key={`${action.action}-${action.nodeId ?? ''}-${action.conceptId ?? conceptId}`}
              action={action}
              learnerId={learnerId}
              conceptId={conceptId}
              onAdvance={refresh}
              onNavigateToConcept={(id) => router.push(`/pal/eso?conceptId=${id}${learnerId ? `&learnerId=${learnerId}` : ''}`)}
            />
          )}
        </div>
      )}
    </div>
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
function PlanStep({ action, onContinue }: { action: EsoAction; onContinue: () => void }) {
  const nextLabel =
    FLOW_STAGES.find((stage) => stage.actions.includes(action.action))?.label ?? 'the next step';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-500" />
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
            className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-violet-500' : 'bg-slate-200'}`}
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
                  className="inline-flex items-center gap-1.5 font-medium text-violet-700 underline hover:text-violet-900"
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
  { key: 'diagnostic', label: 'Diagnostic', actions: ['diagnostic'] },
  // Plan has no engine action of its own, and deliberately so: the engine
  // decides WHAT to teach, and Plan is where the learner is shown what it
  // decided and what remains. It is driven by `planPending` in the page rather
  // than by a policy branch, so no D1-D5 rule changes to accommodate it.
  { key: 'plan', label: 'Plan', actions: [] },
  { key: 'learn', label: 'Learn', actions: ['teach', 'reteach'] },
  { key: 'check', label: 'Check', actions: ['check_understanding'] },
  { key: 'practice', label: 'Practice', actions: ['practice', 'continue_practice'] },
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

function LearningFlowRail({ action, stageKey }: { action: string; stageKey?: string }) {
  // `stageKey` marks a stage the UI owns rather than the engine — currently
  // only Plan, which has no action of its own. Everything else still derives
  // from the resolved action, so the rail can never drift from the engine.
  const activeIndex = stageKey
    ? FLOW_STAGES.findIndex((stage) => stage.key === stageKey)
    : FLOW_STAGES.findIndex((stage) => stage.actions.includes(action));

  return (
    <div data-eso-flow-stage={activeIndex >= 0 ? FLOW_STAGES[activeIndex].key : 'off-path'} className="mb-4 flex flex-wrap items-center gap-1.5">
      {FLOW_STAGES.map((stage, index) => {
        const done = activeIndex >= 0 && index < activeIndex;
        const current = index === activeIndex;
        return (
          <span key={stage.key} className="flex items-center gap-1.5">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                current
                  ? 'border-violet-400 bg-violet-100 text-violet-800'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {stage.label}
            </span>
            {index < FLOW_STAGES.length - 1 && <span className="text-slate-300">›</span>}
          </span>
        );
      })}
      {/* Said explicitly rather than silently showing nothing highlighted. */}
      {activeIndex < 0 && (
        <span className="ml-1 text-xs text-amber-700">
          {action === 'serve_contrast_pair'
            ? 'Clearing up a mix-up first'
            : action === 'remediate_prerequisite' || action === 'prerequisite_quick_probe'
              ? 'Checking a prerequisite first'
              : action === 'content_unavailable'
                ? 'Waiting on content'
                : 'Getting you set up'}
        </span>
      )}
    </div>
  );
}

function Alert({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
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
  onNavigateToConcept,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
  onNavigateToConcept: (conceptId: number) => void;
}) {
  switch (action.action) {
    case 'diagnostic':
      return <DiagnosticStep learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'remediate_prerequisite':
      return <PrerequisiteStep action={action} onNavigateToConcept={onNavigateToConcept} />;
    case 'prerequisite_quick_probe':
      return <PrerequisiteProbeStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    // Teaching is deliberately NOT the same screen as practice any more: it
    // carries no scored question, and the check of understanding sits between
    // the two. `reteach` is the same explanation screen after a failed check.
    case 'teach':
      return <TeachStep action={action} learnerId={learnerId} onAdvance={onAdvance} />;
    // `reteach` is the same gate after a failed check — the engine swaps in a
    // "explain it a different way" instruction, and the check follows on the
    // same screen rather than making the student click through twice.
    case 'check_understanding':
    case 'reteach':
      return <CheckUnderstandingStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'practice':
      return <TeachOrPracticeStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'serve_contrast_pair':
      return <ContrastPairStep action={action} learnerId={learnerId} conceptId={conceptId} onAdvance={onAdvance} />;
    case 'mastered_stop_practice':
      return <MasteredStep action={action} />;
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
    default:
      return <Alert>{action.action}</Alert>;
  }
}

// ── D1: diagnostic ───────────────────────────────────────────────────────

function DiagnosticStep({ learnerId, conceptId, onAdvance }: { learnerId: string; conceptId: number; onAdvance: () => void }) {
  const [items, setItems] = useState<DiagnosticItem[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDiagnosticItems(learnerId, conceptId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the diagnostic.');
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, conceptId]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (items === null) return <CenteredSpinner label="Building your diagnostic..." />;
  if (items.length === 0) {
    return <Alert>No diagnostic questions are tagged for this concept yet — Phase 0 tagging is still in progress.</Alert>;
  }

  const answeredCount = Object.keys(answers).length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitDiagnostic(
        learnerId,
        conceptId,
        items.map((item) => ({ nodeId: item.nodeId, answerMasterId: answers[item.questionId] })).filter((r) => r.answerMasterId != null)
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
        {items.map((item, index) => (
          <div key={item.questionId} data-eso-question-id={item.questionId} data-eso-node-id={item.nodeId} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-600">
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
                    answers[item.questionId] === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`diagnostic-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-violet-600"
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
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
  onAdvance: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = action.item ?? null;

  const submit = async () => {
    if (!action.nodeId || selected == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordAttempt(learnerId, action.nodeId, { conceptId, answerMasterId: selected });
      onAdvance();
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
 */
function LearningContentPanel({ content }: { content: NonNullable<EsoAction['learningContent']> }) {
  const hasMedia = content.mediaUrl != null && content.mediaUrl !== '';

  return (
    <div data-eso-learning-content={content.format} className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-sky-900">{content.title || 'Learning material'}</span>
        {/* Only claim a format when there is an asset behind it. */}
        {hasMedia && <Badge variant="outline">{content.formatLabel}</Badge>}
      </div>

      {hasMedia && <CorrectiveResource url={content.mediaUrl as string} format={content.format} title={content.title} />}

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Let&apos;s learn this</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">{message}</div>
        ) : (
          <CenteredSpinner label="Preparing the explanation..." />
        )}

        {/* Absent whenever the content model has nothing for this concept —
            the common case today, and the required graceful fallback. */}
        {action.learningContent && <LearningContentPanel content={action.learningContent} />}

        <div className="flex justify-end">
          <Button data-eso-acknowledge onClick={onAdvance} disabled={!message}>
            I&apos;ve read this — check my understanding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── D1-CFU: check for understanding ──────────────────────────────────────

/**
 * The gate between being taught and starting scored practice. Answers here are
 * graded but are NOT mastery evidence — the engine records them separately and
 * never applies a mastery update — so the copy says so plainly rather than
 * letting it read as a test the student can fail out of the concept on.
 */
function CheckUnderstandingStep({
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
  const message = usePalRendering(learnerId, action.llmInstruction);
  const [items, setItems] = useState<EsoQuestion[] | null | 'loading'>('loading');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRetry = action.action === 'reteach';

  useEffect(() => {
    if (!action.nodeId) return;
    // Keyed on cfuAttempts too, so a reteach cycle genuinely re-fetches rather
    // than showing the pair the student just failed.
    fetchCheckUnderstandingItems(learnerId, action.nodeId).then((rows) => setItems(rows.length > 0 ? rows : null));
  }, [learnerId, action.nodeId, action.cfuAttempts]);

  const loaded = items !== 'loading' && items !== null ? items : [];
  const allAnswered = loaded.length > 0 && loaded.every((item) => answers[item.questionId] != null);

  const submit = async () => {
    if (!action.nodeId || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitCheckUnderstanding(
        learnerId,
        action.nodeId,
        conceptId,
        loaded.map((item) => ({ answerMasterId: answers[item.questionId] }))
      );
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRetry ? "Let's try that a different way" : 'Quick check'}</CardTitle>
        <Badge variant="outline">not graded</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">{message}</div>
        )}

        {/* On a reteach the engine walks the content model's re-route ladder,
            so this is a genuinely different format where one is authored. */}
        {action.learningContent && <LearningContentPanel content={action.learningContent} />}

        <p className="text-sm text-slate-600">
          This is just to see whether that explanation landed — it doesn&apos;t count towards your mastery either way.
        </p>

        {items === 'loading' && <CenteredSpinner label="Finding a couple of questions..." />}
        {items === null && (
          <Alert>No tagged question is available for this node yet — Phase 0 content tagging is still in progress.</Alert>
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
                    answers[item.questionId] === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`cfu-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-violet-600"
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
  onAdvance,
}: {
  action: EsoAction;
  learnerId: string;
  conceptId: number;
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
    // `item` already initializes to 'loading'; this effect only needs to
    // resolve it via the async .then() callback, never synchronously.
    if (!action.nodeId) return;
    fetchPracticeItem(learnerId, action.nodeId).then(setItem);
  }, [learnerId, action.nodeId]);

  const submit = async () => {
    if (!action.nodeId || selected == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordAttempt(learnerId, action.nodeId, {
        conceptId,
        answerMasterId: selected,
        mode: action.practiceMode,
      });
      onAdvance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{action.action === 'teach' ? "Let's learn this" : 'Practice'}</CardTitle>
        {action.practiceMode && <Badge variant="outline">{action.practiceMode} practice</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">{message}</div>
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
          <Alert>No tagged practice question is available for this node yet — Phase 0 content tagging is still in progress.</Alert>
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
                    selected === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="practice-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-violet-600"
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

// ── D3: misconception contrast pair ──────────────────────────────────────

function ContrastPairStep({
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
    if (!action.nodeId || selected == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordAttempt(learnerId, action.nodeId, { conceptId, answerMasterId: selected });
      onAdvance();
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
                    selected === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="retest-option"
                    checked={selected === option.id}
                    onChange={() => setSelected(option.id)}
                    className="h-4 w-4 accent-violet-600"
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
 * A corrective's richer resource, launched directly rather than described.
 *
 * Video gets an inline player (the common case, and the one worth not making
 * the student leave the flow for). Anything else — a simulation, an
 * externally-hosted activity, a document — opens in a new tab rather than an
 * iframe: third-party content routinely refuses to be framed, and a blocked
 * blank box is a worse experience than an honest link.
 */
function CorrectiveResource({ url, format, title }: { url: string; format: string | null; title: string | null }) {
  const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url) || (format ?? '').toLowerCase().includes('video');

  if (isVideo) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
        <video src={url} controls className="h-auto w-full" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-100"
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
        <div className="flex gap-4 text-sm text-emerald-800">
          {action.knowledgeMastery != null && <div>Knowledge: {Math.round(action.knowledgeMastery * 100)}%</div>}
          {action.applicationMastery != null && <div>Application: {Math.round(action.applicationMastery * 100)}%</div>}
        </div>

        {/* Enrichment, when the existing PAL content pipeline has something for
            this chapter. Explicitly optional: nothing here is scored, and
            skipping it costs the student nothing. Absent entirely when no
            enrichment is authored — never a placeholder. */}
        {action.enrichment != null && action.enrichment.length > 0 && (
          <div data-eso-enrichment className="space-y-2 rounded-lg border border-emerald-200 bg-white p-4">
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
          <Sparkles className="h-4 w-4 text-violet-500" />
          Quick review
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
                    answers[item.questionId] === option.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`retrieval-${item.questionId}`}
                    checked={answers[item.questionId] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [item.questionId]: option.id }))}
                    className="h-4 w-4 accent-violet-600"
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
