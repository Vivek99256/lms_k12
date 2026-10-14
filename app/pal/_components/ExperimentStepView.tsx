'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Clock, FlaskConical, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PrayogshalaDetailDialog } from '@/app/course-master/[courseId]/chapters/PrayogshalaDialogs';
import type { PrayogshalaActivity } from '@/app/course-master/data/prayogshala';
import {
  fetchChapterExperiments,
  PrayogshalaApiError,
  type ChapterExperiments,
} from '@/app/pal/data/pal-experiments';

import type { JourneyStepId } from './H5PJourneyCollage';

/**
 * Step 10 of the journey: the chapter's Prayogshala experiments.
 *
 * Nothing here is new content. The list is the chapter's existing Prayogshala
 * activities (see `pal-experiments.ts`), an interactive one opens in the
 * existing `PrayogshalaLab`, and a document-style one opens in the existing
 * `PrayogshalaDetailDialog` — the same two screens Course master uses.
 *
 * The lab is loaded on demand: it carries every simulation engine, and a learner
 * on any other step of the journey should not download them.
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
  | { status: 'ready'; data: ChapterExperiments };

const LOAD_ERROR = 'The experiments for this chapter could not be loaded right now.';

export interface ExperimentStepViewProps {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}

export function ExperimentStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: ExperimentStepViewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [openLab, setOpenLab] = useState<PrayogshalaActivity | null>(null);
  const [openDocument, setOpenDocument] = useState<PrayogshalaActivity | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchChapterExperiments(chapterId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof PrayogshalaApiError ? error.message : LOAD_ERROR,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  const subjectName = state.status === 'ready' ? state.data.chapter.subject_name : null;
  const experiments = state.status === 'ready' ? state.data.experiments : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Experiment</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {subjectName ? `${subjectName} › ` : ''}
              {chapterName} — practical experiments from Prayogshala.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm">
            <FlaskConical className="h-3.5 w-3.5 text-sky-600" />
            Prayogshala
          </span>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">
            Experiments for {chapterName}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Labs are simulations: your choices and reflections are not saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.status === 'loading' ? (
            <div className="flex items-center gap-2 text-xs text-slate-600" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading the experiments for this chapter…
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

          {state.status === 'ready' && experiments.length === 0 ? (
            <EmptyState
              className="py-8"
              icon={<FlaskConical className="h-8 w-8" aria-hidden />}
              title="No experiments for this chapter yet"
              description="Your teacher has not published a Prayogshala experiment for this chapter. You can carry on to the next step."
            />
          ) : null}

          {state.status === 'ready' && experiments.length > 0 ? (
            <ul className="space-y-3">
              {experiments.map((activity) => (
                <ExperimentRow
                  key={activity.id}
                  activity={activity}
                  onOpen={() => (activity.lab_config ? setOpenLab(activity) : setOpenDocument(activity))}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
        <div>
          <p className="text-xs font-bold text-sky-950">Finished your experiment?</p>
          <p className="mt-0.5 text-xs text-sky-900">
            Move on to Step 11 to lock it in with Spaced Recall.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
          onClick={() => {
            onStepComplete?.('experiment');
            onNextStep?.('recall');
          }}
        >
          <span>Continue to Step 11: Spaced Recall</span>
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

function ExperimentRow({
  activity,
  onOpen,
}: {
  activity: PrayogshalaActivity;
  onOpen: () => void;
}) {
  const summary = activity.objective ?? activity.description;
  const isLab = Boolean(activity.lab_config);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
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
          {/* Learners only ever receive published activities, so these appear for staff. */}
          {activity.status !== 'published' ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {activity.status === 'review' ? 'Pending review' : 'Draft'}
            </span>
          ) : null}
          {activity.show_hide !== 1 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Hidden from students
            </span>
          ) : null}
        </div>
        <h3 className="text-sm font-bold text-slate-900">{activity.title}</h3>
        {summary ? <p className="line-clamp-2 text-xs text-slate-600">{summary}</p> : null}
      </div>

      <Button
        size="sm"
        onClick={onOpen}
        className="shrink-0 gap-1.5 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        {isLab ? 'Open lab' : 'View activity'}
      </Button>
    </li>
  );
}
