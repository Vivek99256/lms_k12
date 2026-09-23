'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  Trophy,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchLearningPlan, type LearningPlan, type PlanStep } from '@/app/pal/data/pal-diagnostic';
import { isConceptCompleted, signalsFromMasteryRow } from '@/app/pal/data/pal-completion';
import { BandChip, StrengthBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedChapterPanel,
  ReadOnlyBadge,
  useChapterCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 5 - the personalised learning plan.
 *
 * ---------------------------------------------------------------------------
 * READ-ONLY IS STRUCTURAL, NOT A UI CHOICE
 * ---------------------------------------------------------------------------
 * The brief requires the plan to be read-only for the student. That is not
 * enforced by hiding controls here: LearningPlanService derives the whole plan
 * on every read from stored evidence, owns no table, and is exposed on a
 * GET-only route. There is no write endpoint for this screen to call, so there
 * is nothing to disable - the absence of editing is a property of the design
 * rather than a rule this component is trusted to follow.
 *
 * Every sentence on this page comes from the server. The ordering is the
 * server's, the reasons are AdaptiveDifficultyRule's own `rationale`, and the
 * mastery wording is MasteryLadder's. Nothing is composed client-side, so the
 * plan cannot drift from the evidence that produced it.
 *
 * ---------------------------------------------------------------------------
 * A COMPLETED CHAPTER HAS NO PLAN
 * ---------------------------------------------------------------------------
 * When every measurable concept is completed there is no remaining work to
 * order, so the plan is replaced by the chapter's mastery record.
 *
 * The verdict comes from the mastery overview, not from the ladders the plan
 * itself carries. The plan reports a ladder per concept but nothing about which
 * difficulty band was actually reached, so a verdict derived here would drift
 * from the one the mastery screen reaches about the same concept. One
 * authority, one answer - see app/pal/data/pal-completion.ts.
 */

export default function LearningPlanPage() {
  return (
    <Suspense fallback={<Centered>Building your plan…</Centered>}>
      <LearningPlanView />
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

function LearningPlanView() {
  const params = useParams();
  const chapterId = String(params?.chapterId ?? '');

  const [plan, setPlan] = useState<LearningPlan | null>(null);
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
      fetchLearningPlan(chapterId, controller.signal)
        .then(setPlan)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Your plan could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => load(), [load]);

  // The mastery overview, not the plan's own ladders, decides what is
  // completed here. The plan reports a ladder per concept but no evidence of
  // which difficulty band was actually reached, so judging from it alone would
  // let this screen and the mastery screen disagree about the same concept.
  // One authority, one answer.
  const { mastery, completion, loading: loadingMastery } = useChapterCompletion(chapterId);

  const completedConceptIds = useMemo(
    () =>
      new Set(
        (mastery?.concepts ?? [])
          .filter((concept) => isConceptCompleted(signalsFromMasteryRow(concept)))
          .map((concept) => String(concept.conceptId))
      ),
    [mastery]
  );

  if (loading || loadingMastery) return <Centered>Building your plan…</Centered>;

  if (error || !plan) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'Your plan could not be built.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>Back to subjects</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No work left to order. The plan stands down and the chapter's mastery
  // record takes its place — read-only, with no route back into a question set.
  if (completion.isComplete && mastery) {
    return (
      <PalWorkspace
        eyebrow={plan.chapterName || 'This chapter'}
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
            <PalRailSection title="Your journey">
              <JourneyRail
                current="mastery"
                completed={COMPLETED_THROUGH_CHECK}
                bypassed={['intervention']}
                orientation="vertical"
              />
            </PalRailSection>

            <p className="px-1 text-xs text-slate-400">
              Generated {formatWhen(plan.generatedAt)} from your saved answers. A completed chapter
              is read only — there is nothing left here to change.
            </p>
          </>
        }
      >
        <CompletedChapterPanel mastery={mastery} completion={completion} />
      </PalWorkspace>
    );
  }

  const noDiagnostic = !plan.hasDiagnostic;

  // Everything that is context rather than the task itself moves to the rail:
  // where the learner is, how the chapter stands, and where else they can go.
  // The main column is then only the ordered work, which is what they came for.
  const rail = (
    <>
      <PalRailSection title="Your journey">
        <JourneyRail
          current={noDiagnostic ? 'diagnostic' : 'plan'}
          completed={noDiagnostic ? [] : stagesBefore('plan')}
          orientation="vertical"
        />
      </PalRailSection>

      {!noDiagnostic && (
        <PalRailSection title="This chapter">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Concepts" value={plan.summary.conceptsServable} hint="with questions" />
            <Metric label="Completed" value={completion.completed} tone="positive" />
            <Metric label="In progress" value={plan.summary.inProgress} />
            <Metric
              label="Need work"
              value={plan.summary.weak}
              tone={plan.summary.weak > 0 ? 'warn' : undefined}
            />
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            A concept is completed once it is cleared to {bandLabel('hard').toLowerCase()} and
            mastery is signed off. The chapter closes when all of them are.
          </p>
        </PalRailSection>
      )}

      <PalRailSection title="Go to">
        <div className="space-y-2">
          <Link
            href={`/pal/mastery/chapter/${chapterId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
          >
            My mastery
          </Link>
          <Link
            href={`/pal/recall?chapterId=${chapterId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
          >
            Recall reviews
          </Link>
        </div>
      </PalRailSection>

      <p className="px-1 text-xs text-slate-400">
        Generated {formatWhen(plan.generatedAt)} from your saved answers. You cannot edit this plan —
        it changes when your answers do.
      </p>
    </>
  );

  return (
    <PalWorkspace
      eyebrow={plan.chapterName || 'This chapter'}
      title="Your learning plan"
      description="Built from your own answers. It updates itself as you work."
      backHref="/pal"
      backLabel="Back to subjects"
      actions={
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
          <Lock aria-hidden className="h-3 w-3" />
          Read only
        </span>
      }
      rail={rail}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What to do, in order</CardTitle>
          <CardDescription>
            {noDiagnostic
              ? 'Start here.'
              : 'Worked out from your chapter diagnostic and practice. Weakest first.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {plan.steps.map((step, index) => (
              <StepRow
                key={`${step.key}-${step.conceptId ?? index}`}
                step={step}
                index={index + 1}
                chapterId={chapterId}
                completed={step.conceptId != null && completedConceptIds.has(String(step.conceptId))}
              />
            ))}
          </ol>
        </CardContent>
      </Card>

      {plan.contentGaps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <AlertTriangle aria-hidden className="h-4 w-4" />
              Not covered yet
            </CardTitle>
            <CardDescription className="text-amber-800">
              {plan.contentGaps.length} concept{plan.contentGaps.length === 1 ? '' : 's'} in this
              chapter cannot be practised yet. This is a gap in the question bank, not something you
              have missed — your teacher sees the same list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {/* Every gap, not the first eight. The heading directly above
                  states the full count, so truncating the list silently made
                  the two disagree. */}
              {plan.contentGaps.map((gap) => (
                <li key={gap.conceptId} className="text-sm text-amber-900">
                  <span className="font-medium">{gap.name}</span>
                  <span className="text-amber-700"> — {gap.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </PalWorkspace>
  );
}

function StepRow({
  step,
  index,
  chapterId,
  completed,
}: {
  step: PlanStep;
  index: number;
  chapterId: string;
  completed: boolean;
}) {
  // The diagnostic and all-mastered steps carry no concept, so they render as a
  // single call to action rather than a sub-journey.
  if (step.key !== 'concept') {
    const done = step.key === 'mastery';

    return (
      <li className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            done ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
          }`}
        >
          {done ? <Trophy aria-hidden className="h-4 w-4" /> : <BookOpen aria-hidden className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{step.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{step.detail}</p>
          {step.key === 'diagnostic' && (
            <Link href={`/pal/diagnostic/chapter/${chapterId}`} className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}>
              Take chapter diagnostic
              <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
          completed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        )}
      >
        {completed ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : index}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{step.title}</p>
          {completed ? (
            <CompletedBadge />
          ) : (
            <>
              <StrengthBadge band={step.band} />
              {step.nextDifficulty && <BandChip band={step.nextDifficulty} />}
            </>
          )}
        </div>

        {step.detail && <p className="mt-1 text-sm text-slate-600">{step.detail}</p>}

        {/* The sub-journey for this concept: weak concept -> misconception ->
            learn -> check -> practice -> mastery. Rendered as a path so the
            learner can see the shape of the work, not just its first step. */}
        {step.path.length > 0 && (
          <ol className="mt-2.5 space-y-1.5 border-l border-slate-200 pl-3">
            {step.path.map((stage) => (
              <li key={stage.stage} className="flex items-start gap-2 text-xs">
                <Circle aria-hidden className="mt-1 h-2 w-2 shrink-0 fill-slate-300 text-slate-300" />
                <span className="min-w-0">
                  <span className="font-medium text-slate-700">{stage.label}</span>
                  {stage.detail && <span className="text-slate-500"> — {stage.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Learn leads, then Practise — the same order as the path listed
            directly above and as the engine itself runs. These were the other
            way round, so the first control under a "Learn -> Practice -> Check"
            path was the one that skipped to practice.

            A completed concept keeps neither: it is read-only, and the only
            route left is its own mastery record. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {completed ? (
            <>
              <Link
                href={`/pal/adaptive/concept/${step.conceptId}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                View mastery
              </Link>
              <ReadOnlyBadge />
            </>
          ) : step.esoReady ? (
            <Link
              href={`/pal/learn/concept/${step.conceptId}?chapterId=${chapterId}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Learn this
              <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          ) : (
            // No ESO node means Learn/Check would lead nowhere. A disabled
            // control with a reason beats a button that silently fails.
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
              <Lock aria-hidden className="h-3 w-3" />
              Guided learning not set up for this concept
            </span>
          )}

          {!completed && (
            <Link href={`/pal/adaptive/concept/${step.conceptId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Practise{step.nextDifficulty ? ` at ${bandLabel(step.nextDifficulty).toLowerCase()}` : ''}
            </Link>
          )}

          {/* Mastered but NOT completed — the ladder signed the concept off
              without the hard rung having been reached, so it is still open to
              practise and says so rather than reading as finished. */}
          {!completed && step.ladder?.mastered && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              Mastered
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'positive' | 'warn';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p
        className={`text-xl font-semibold tabular-nums ${
          tone === 'positive' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-500">
        {label}
        {hint ? ` ${hint}` : ''}
      </p>
    </div>
  );
}

function formatWhen(value: string): string {
  if (!value) return 'just now';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'just now';
  return parsed.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
