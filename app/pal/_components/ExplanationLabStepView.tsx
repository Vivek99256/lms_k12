'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  FlaskConical,
  Loader2,
  RefreshCw,
  Target,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { PrayogshalaDetailDialog } from '@/app/course-master/[courseId]/chapters/PrayogshalaDialogs';
import type { PrayogshalaActivity } from '@/app/course-master/data/prayogshala';
import { fetchAdaptiveConcepts } from '@/app/pal/data/pal-diagnostic';
import { fetchChapterExperiments, PrayogshalaApiError } from '@/app/pal/data/pal-experiments';
import {
  buildExplanationLabPlan,
  WEAK_BELOW_PERCENT,
  type ConceptRecommendation,
  type ExplanationLabPlan,
} from '@/app/pal/data/pal-explanation-lab';

import type { JourneyStepId } from './H5PJourneyCollage';

/**
 * Step 6 of the journey, straight after Adaptive Practice: experiments chosen
 * from the learner's own concept scores.
 *
 * The ranking and matching live in `pal-explanation-lab.ts`; this file only
 * loads the two inputs (the adaptive results and the chapter's Prayogshala
 * activities), renders the plan, and opens an experiment in the same lab /
 * detail dialog the Application Lab step uses. Nothing is saved: labs are
 * simulations, so the step is a recommendation surface, not a graded one.
 */
const PrayogshalaLab = dynamic(
  () =>
    import('@/app/course-master/[courseId]/chapters/PrayogshalaLab').then(
      (module) => module.PrayogshalaLab
    ),
  { ssr: false }
);

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plan: ExplanationLabPlan; subjectName: string | null };

const LOAD_ERROR = 'Your recommended experiments could not be loaded right now.';

export interface ExplanationLabStepViewProps {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}

export function ExplanationLabStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: ExplanationLabStepViewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [openLab, setOpenLab] = useState<PrayogshalaActivity | null>(null);
  const [openDocument, setOpenDocument] = useState<PrayogshalaActivity | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchAdaptiveConcepts(chapterId, controller.signal),
      fetchChapterExperiments(chapterId),
    ])
      .then(([adaptive, chapter]) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'ready',
          plan: buildExplanationLabPlan(adaptive.concepts, chapter.experiments, adaptive.hasDiagnostic),
          subjectName: chapter.chapter.subject_name ?? null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof PrayogshalaApiError ? error.message : LOAD_ERROR,
        });
      });

    return () => controller.abort();
  }, [chapterId, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  const open = (activity: PrayogshalaActivity) =>
    activity.lab_config ? setOpenLab(activity) : setOpenDocument(activity);

  const subjectName = state.status === 'ready' ? state.subjectName : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Explanation Lab</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {subjectName ? `${subjectName} › ` : ''}
              {chapterName} — experiments picked for the concepts you found hardest.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm">
            <FlaskConical className="h-3.5 w-3.5 text-sky-600" />
            Prayogshala
          </span>
        </div>
      </div>

      {state.status === 'loading' ? (
        <div className="flex items-center gap-2 text-xs text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Reading your practice results…
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span>{state.message}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={retry}
            className="h-8 gap-1.5 bg-white text-xs text-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && !state.plan.hasResults ? (
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <EmptyState
              className="py-8"
              icon={<Target className="h-8 w-8" aria-hidden />}
              title="No concept diagnostic results yet"
              description="Experiments are recommended from how you did on the concept diagnostic. Take it first, then come back here."
              action={
                <Link href={`/pal/adaptive/chapter/${chapterId}`} className={buttonVariants()}>
                  Go to concept diagnostic
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'ready' && state.plan.hasResults ? (
        <PlanSummary plan={state.plan} />
      ) : null}

      {state.status === 'ready' && state.plan.hasResults && state.plan.recommendations.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-5 text-sm text-emerald-900">
            You scored {WEAK_BELOW_PERCENT}% or more on every concept that has been assessed, so there
            is nothing to recommend here. You can carry on to your learning plan.
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'ready'
        ? state.plan.recommendations.map((recommendation, index) => (
            <RecommendationCard
              key={recommendation.concept.conceptId}
              rank={index + 1}
              recommendation={recommendation}
              onOpen={open}
            />
          ))
        : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
        <div>
          <p className="text-xs font-bold text-sky-950">Done with the experiments?</p>
          <p className="mt-0.5 text-xs text-sky-900">
            Move on to Step 7 for feedback on your practice.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
          onClick={() => {
            onStepComplete?.('explanation_lab');
            onNextStep?.('feedback');
          }}
        >
          <span>Continue to Step 7: Feedback</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {openLab?.lab_config ? (
        <PrayogshalaLab
          activity={openLab}
          lab={openLab.lab_config}
          onClose={() => setOpenLab(null)}
        />
      ) : null}

      <PrayogshalaDetailDialog
        activity={openDocument}
        canManage={false}
        onClose={() => setOpenDocument(null)}
        onEdit={() => undefined}
        onRemove={() => undefined}
      />
    </div>
  );
}

function PlanSummary({ plan }: { plan: ExplanationLabPlan }) {
  const weak = plan.recommendations.length;
  return (
    <p className="text-xs text-slate-600">
      {weak} concept{weak === 1 ? '' : 's'} below {WEAK_BELOW_PERCENT}%, lowest first.
      {plan.understoodCount > 0 ? ` ${plan.understoodCount} you already understand are left out.` : ''}
      {plan.notAssessedCount > 0
        ? ` ${plan.notAssessedCount} not assessed yet — take their concept diagnostic to get recommendations.`
        : ''}
    </p>
  );
}

function RecommendationCard({
  rank,
  recommendation,
  onOpen,
}: {
  rank: number;
  recommendation: ConceptRecommendation;
  onOpen: (activity: PrayogshalaActivity) => void;
}) {
  const { concept, score, scoreSource, experiments, chapterWide } = recommendation;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
              {rank}
            </span>
            {concept.name}
          </CardTitle>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700">
            {Math.round(score)}% ·{' '}
            {scoreSource === 'concept-diagnostic' ? 'concept diagnostic' : 'chapter diagnostic'}
          </span>
        </div>
        <CardDescription className="text-xs text-slate-500">
          {experiments.length === 0
            ? 'No experiment has been published for this concept yet.'
            : chapterWide
              ? 'No experiment is tied to this concept yet — these cover the whole chapter.'
              : 'Experiments written for this concept.'}
        </CardDescription>
      </CardHeader>
      {experiments.length > 0 ? (
        <CardContent>
          <ul className="space-y-3">
            {experiments.map((activity) => (
              <ExperimentCard
                key={activity.id}
                activity={activity}
                currentConceptId={concept.conceptId}
                onOpen={() => onOpen(activity)}
              />
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

function ExperimentCard({
  activity,
  currentConceptId,
  onOpen,
}: {
  activity: PrayogshalaActivity;
  currentConceptId: string;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLab = Boolean(activity.lab_config);
  const alsoCovers = (activity.concept_names ?? []).filter(
    (_, index) => String(activity.concept_ids?.[index]) !== currentConceptId
  );
  const hasDetail =
    Boolean(activity.objective) ||
    activity.materials_required.length > 0 ||
    activity.procedure_steps.length > 0 ||
    Boolean(activity.observation) ||
    Boolean(activity.result);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700">
              <FlaskConical className="h-3 w-3" aria-hidden />
              {activity.activity_type_label}
            </span>
            {activity.topic_name ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                Topic: {activity.topic_name}
              </span>
            ) : null}
            {activity.estimated_minutes ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" aria-hidden />
                {activity.estimated_minutes} min
              </span>
            ) : null}
          </div>
          <h3 className="text-sm font-bold text-slate-900">{activity.title}</h3>
          {activity.objective ? (
            <p className="text-xs text-slate-600">{activity.objective}</p>
          ) : activity.description ? (
            <p className="line-clamp-2 text-xs text-slate-600">{activity.description}</p>
          ) : null}
          {alsoCovers.length > 0 ? (
            <p className="text-[11px] text-slate-500">Also covers: {alsoCovers.join(', ')}</p>
          ) : null}
        </div>

        <Button
          size="sm"
          onClick={onOpen}
          className="shrink-0 gap-1.5 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {isLab ? 'Open lab' : 'View activity'}
        </Button>
      </div>

      {hasDetail ? (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800"
          >
            {expanded ? 'Hide experiment details' : 'Show materials, steps and what to expect'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded ? (
            <dl className={cn('mt-3 space-y-3 text-xs text-slate-700')}>
              {activity.objective ? <Detail title="Objective">{activity.objective}</Detail> : null}
              {activity.materials_required.length > 0 ? (
                <Detail title="Materials required">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {activity.materials_required.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </Detail>
              ) : null}
              {activity.procedure_steps.length > 0 ? (
                <Detail title="Procedure">
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {activity.procedure_steps.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ol>
                </Detail>
              ) : null}
              {activity.observation ? (
                <Detail title="Expected observation">{activity.observation}</Detail>
              ) : null}
              {activity.result ? <Detail title="Conclusion">{activity.result}</Detail> : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</dt>
      <dd className="mt-0.5 leading-relaxed">{children}</dd>
    </div>
  );
}
