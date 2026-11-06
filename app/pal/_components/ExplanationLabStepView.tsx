'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Database,
  ExternalLink,
  FlaskConical,
  Globe,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Target,
  Trophy,
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
  type AdaptivePracticeAnalysis,
  type ConceptRecommendation,
  type ExplanationLabPlan,
  type SimulationResult,
} from '@/app/pal/data/pal-explanation-lab';

import type { JourneyStepId } from './H5PJourneyCollage';

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
  subjectName?: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}

export function ExplanationLabStepView({
  chapterId,
  chapterName,
  subjectName: propSubjectName,
  onStepComplete,
  onNextStep,
}: ExplanationLabStepViewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selectedConceptIndex, setSelectedConceptIndex] = useState(0);
  const [openLab, setOpenLab] = useState<PrayogshalaActivity | null>(null);
  const [openDocument, setOpenDocument] = useState<PrayogshalaActivity | null>(null);
  const [isLabCompleted, setIsLabCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem(`pal_completed_steps_${chapterId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.includes('explanation_lab');
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchAdaptiveConcepts(chapterId, controller.signal),
      fetchChapterExperiments(chapterId),
    ])
      .then(([adaptive, chapter]) => {
        if (controller.signal.aborted) return;
        const resolvedSubject = propSubjectName || chapter.chapter.subject_name || 'Science';
        const plan = buildExplanationLabPlan(
          adaptive.concepts,
          chapter.experiments,
          adaptive.hasDiagnostic,
          chapterName,
          resolvedSubject,
          chapterId
        );
        setState({
          status: 'ready',
          plan,
          subjectName: resolvedSubject,
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
  }, [chapterId, attempt, propSubjectName, chapterName]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  const handleOpenExperiment = (activity: PrayogshalaActivity) =>
    activity.lab_config ? setOpenLab(activity) : setOpenDocument(activity);

  const handleLabVerificationPassed = () => {
    setIsLabCompleted(true);
    try {
      const key = `pal_completed_steps_${chapterId}`;
      const raw = sessionStorage.getItem(key);
      const set = new Set(raw ? JSON.parse(raw) : []);
      set.add('explanation_lab');
      sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
    onStepComplete?.('explanation_lab');
  };

  const subjectName = state.status === 'ready' ? state.subjectName : propSubjectName ?? null;

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                <FlaskConical className="h-3.5 w-3.5 text-sky-600" />
                Step 6 of 12
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {subjectName ? `${subjectName} › ` : ''}
                {chapterName}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Explanation Lab — Practical & Experiment-Based Learning
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Dynamically generated laboratory experiments and visual demonstrations targeted to your Adaptive Practice results.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLabCompleted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Lab Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm">
                <Compass className="h-3.5 w-3.5 text-sky-600" />
                Prayogshala Engine
              </span>
            )}
          </div>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-600" aria-hidden />
          Analyzing your Adaptive Practice results and generating topic-specific experiments…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{state.message}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={retry}
            className="h-8 gap-1.5 bg-white text-xs text-rose-700 hover:bg-rose-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && !state.plan.hasResults && (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <EmptyState
              className="py-8"
              icon={<Target className="h-8 w-8 text-sky-600" aria-hidden />}
              title="No Practice or Diagnostic Results Available Yet"
              description="Explanation Lab builds customized experiments from your answers in Adaptive Practice or Concept Diagnostic. Complete Adaptive Practice first to generate your hands-on lab."
              action={
                <Link href={`/pal/adaptive/chapter/${chapterId}`} className={buttonVariants()}>
                  Go to Concept Diagnostic
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}

      {state.status === 'ready' && state.plan.hasResults && (
        <>
          {/* Concept Tabs (when multiple weak concepts exist) */}
          {state.plan.recommendations.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-500 mr-1">Focus Concept:</span>
              {state.plan.recommendations.map((rec, idx) => {
                const isSelected = selectedConceptIndex === idx;
                return (
                  <button
                    key={rec.concept.conceptId}
                    type="button"
                    onClick={() => setSelectedConceptIndex(idx)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      isSelected
                        ? 'bg-sky-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    <span>{rec.concept.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                        isSelected ? 'bg-sky-900 text-white' : 'bg-slate-200 text-slate-700'
                      )}
                    >
                      {Math.round(rec.score)}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Topic-Specific Practical Lab Workbench */}
          {state.plan.recommendations[selectedConceptIndex] && (
            <TopicSpecificInteractiveWorkbench
              key={state.plan.recommendations[selectedConceptIndex].concept.conceptId}
              recommendation={state.plan.recommendations[selectedConceptIndex]}
              activeAnalysis={state.plan.activeAnalysis ?? null}
              onVerificationPassed={handleLabVerificationPassed}
              onOpenExperiment={handleOpenExperiment}
            />
          )}

          {/* Next Step Navigation Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/90 p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold text-sky-950">
                {isLabCompleted
                  ? 'Explanation Lab completed & verified!'
                  : 'Ready to continue your learning journey?'}
              </p>
              <p className="mt-0.5 text-xs text-sky-900">
                Proceed to Step 7: Feedback &amp; Review to receive personalized diagnostic insights and track mastery.
              </p>
            </div>
            <Button
              size="sm"
              className={cn(
                'gap-2 text-xs font-semibold text-white shadow-sm transition-all',
                isLabCompleted
                  ? 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-400'
                  : 'bg-sky-700 hover:bg-sky-800'
              )}
              onClick={() => {
                handleLabVerificationPassed();
                onNextStep?.('feedback');
              }}
            >
              <span>Continue to Step 7: Feedback &amp; Review</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}

      {/* Full Modal Simulation if opened */}
      {openLab?.lab_config && (
        <PrayogshalaLab
          activity={openLab}
          lab={openLab.lab_config}
          onClose={() => setOpenLab(null)}
        />
      )}

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

// ---------------------------------------------------------------------------
// Topic-Specific Interactive Workbench Component
// ---------------------------------------------------------------------------

interface TopicSpecificInteractiveWorkbenchProps {
  recommendation: ConceptRecommendation;
  activeAnalysis: AdaptivePracticeAnalysis | null;
  onVerificationPassed: () => void;
  onOpenExperiment: (activity: PrayogshalaActivity) => void;
}

interface RecordedTrial {
  id: number;
  val1: number;
  val2?: number;
  result: SimulationResult;
  timestamp: string;
}

function TopicSpecificInteractiveWorkbench({
  recommendation,
  activeAnalysis,
  onVerificationPassed,
  onOpenExperiment,
}: TopicSpecificInteractiveWorkbenchProps) {
  const lab = recommendation.generatedLab;
  const isTargetOfActiveAnalysis =
    activeAnalysis && activeAnalysis.conceptId === recommendation.concept.conceptId;

  // Interactive slider state
  const [val1, setVal1] = useState<number>(() => lab?.primaryVariable.defaultValue ?? 10);
  const [val2, setVal2] = useState<number>(() => lab?.secondaryVariable?.defaultValue ?? 0);
  const [recordedTrials, setRecordedTrials] = useState<RecordedTrial[]>([]);

  // Verification quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [verificationPassed, setVerificationPassed] = useState<boolean>(false);
  const [showProcedure, setShowProcedure] = useState<boolean>(false);

  // Compute observation dynamically based on current slider values
  const liveObservation: SimulationResult | null = useMemo(() => {
    if (!lab) return null;
    return lab.computeObservation(val1, lab.secondaryVariable ? val2 : undefined);
  }, [lab, val1, val2]);

  if (!lab) {
    return null;
  }

  const handleRecordTrial = () => {
    if (!liveObservation) return;
    const newTrial: RecordedTrial = {
      id: recordedTrials.length + 1,
      val1,
      val2: lab.secondaryVariable ? val2 : undefined,
      result: liveObservation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setRecordedTrials((prev) => [newTrial, ...prev.slice(0, 4)]);
  };

  const handleResetSliders = () => {
    setVal1(lab.primaryVariable.defaultValue);
    if (lab.secondaryVariable) {
      setVal2(lab.secondaryVariable.defaultValue);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    if (quizSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleVerifyUnderstanding = () => {
    if (Object.keys(answers).length < lab.verificationQuestions.length) return;
    setQuizSubmitted(true);

    const allCorrect = lab.verificationQuestions.every((q) => {
      const selected = answers[q.id];
      const opt = q.options.find((o) => o.id === selected);
      return opt?.isCorrect === true;
    });

    if (allCorrect) {
      setVerificationPassed(true);
      onVerificationPassed();
    }
  };

  const statusBg =
    liveObservation?.statusColor === 'rose'
      ? 'bg-rose-50 border-rose-200 text-rose-950'
      : liveObservation?.statusColor === 'amber'
        ? 'bg-amber-50 border-amber-200 text-amber-950'
        : liveObservation?.statusColor === 'sky'
          ? 'bg-sky-50 border-sky-200 text-sky-950'
          : liveObservation?.statusColor === 'purple'
            ? 'bg-purple-50 border-purple-200 text-purple-950'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950';

  const statusPill =
    liveObservation?.statusColor === 'rose'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : liveObservation?.statusColor === 'amber'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : liveObservation?.statusColor === 'sky'
          ? 'bg-sky-100 text-sky-800 border-sky-300'
          : liveObservation?.statusColor === 'purple'
            ? 'bg-purple-100 text-purple-800 border-purple-300'
            : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  return (
    <div className="space-y-5">
      {/* 1. Adaptive Performance & Learning Gap Diagnostic Banner */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                  <Brain className="h-3.5 w-3.5 text-purple-600" />
                  Performance Gap Analysis
                </span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  Concept: {lab.conceptName}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-bold',
                    lab.performanceLevel === 'struggling'
                      ? 'bg-rose-100 text-rose-800'
                      : lab.performanceLevel === 'developing'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                  )}
                >
                  Score: {Math.round(recommendation.score)}% · {lab.difficultyLabel}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 pt-1">
                {lab.learningGapNotice}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Est. {lab.estimatedMinutes} min practical lab</span>
            </div>
          </div>

          {/* Identified specific question mistakes from Adaptive Practice */}
          {isTargetOfActiveAnalysis && activeAnalysis?.wrongQuestions?.length ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-white p-3 text-xs shadow-xs">
              <p className="font-semibold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                Adaptive Practice Misconceptions to Resolve:
              </p>
              <ul className="mt-1.5 space-y-1 text-slate-700 pl-2">
                {activeAnalysis.wrongQuestions.map((wq, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>
                      <strong className="text-slate-900">{wq.title}</strong>
                      {wq.feedback ? ` — ${wq.feedback}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-purple-100 bg-white/80 p-2.5 text-xs text-slate-600">
              <p>
                <strong>Practical Objective:</strong> {lab.objective}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Interactive Virtual Laboratory Workbench */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-3.5 px-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-white shadow-xs">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">{lab.title}</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Manipulate real-time parameters below to observe physical cause-and-effect.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSliders}
                className="h-8 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenExperiment(lab.prayogshalaActivity)}
                className="h-8 gap-1.5 border-sky-300 text-xs text-sky-800 hover:bg-sky-50"
              >
                <ExternalLink className="h-3 w-3" />
                Full Prayogshala View
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-5">
          {/* Laboratory Apparatus Badges */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Laboratory Apparatus & Specimen Setup:
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {lab.materials.map((mat, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span className="font-semibold">{mat.name}</span>
                  <span className="text-[11px] text-slate-400">({mat.purpose})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Simulation Controls & Live Sensor Readout */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column: Sliders */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sliders className="h-4 w-4 text-sky-600" />
                  Interactive Input Controls
                </span>
                <span className="text-[11px] text-slate-400">Adjust variables</span>
              </div>

              {/* Primary Variable Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="primary-slider" className="font-semibold text-slate-800">
                    {lab.primaryVariable.label}
                  </label>
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold text-sky-900">
                    {val1} {lab.primaryVariable.unit}
                  </span>
                </div>
                <input
                  id="primary-slider"
                  type="range"
                  min={lab.primaryVariable.min}
                  max={lab.primaryVariable.max}
                  step={lab.primaryVariable.step}
                  value={val1}
                  onChange={(e) => setVal1(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-sky-700"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{lab.primaryVariable.min} {lab.primaryVariable.unit}</span>
                  <span>Default: {lab.primaryVariable.defaultValue}</span>
                  <span>{lab.primaryVariable.max} {lab.primaryVariable.unit}</span>
                </div>
              </div>

              {/* Secondary Variable Slider (if applicable) */}
              {lab.secondaryVariable && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="secondary-slider" className="font-semibold text-slate-800">
                      {lab.secondaryVariable.label}
                    </label>
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 font-mono text-xs font-bold text-purple-900">
                      {val2} {lab.secondaryVariable.unit}
                    </span>
                  </div>
                  <input
                    id="secondary-slider"
                    type="range"
                    min={lab.secondaryVariable.min}
                    max={lab.secondaryVariable.max}
                    step={lab.secondaryVariable.step}
                    value={val2}
                    onChange={(e) => setVal2(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-purple-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{lab.secondaryVariable.min} {lab.secondaryVariable.unit}</span>
                    <span>Default: {lab.secondaryVariable.defaultValue}</span>
                    <span>{lab.secondaryVariable.max} {lab.secondaryVariable.unit}</span>
                  </div>
                </div>
              )}

              {/* Trial recording action */}
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={handleRecordTrial}
                  className="w-full gap-2 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>Record Observation into Lab Notebook</span>
                </Button>
              </div>
            </div>

            {/* Right Column: Live Calculated Observation */}
            <div className={cn('rounded-xl border p-4 lg:col-span-6 flex flex-col justify-between shadow-xs', statusBg)}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Live Experimental Readout:
                  </span>
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-2xs', statusPill)}>
                    Dynamic Sensor Active
                  </span>
                </div>

                {/* Primary Metric Output */}
                <div className="rounded-xl bg-white/90 p-3.5 shadow-2xs border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Calculated Primary Value:
                  </span>
                  <p className="mt-1 font-mono text-base font-extrabold text-slate-900 sm:text-lg">
                    {liveObservation?.valueDisplay}
                  </p>
                </div>

                {/* Visual Gauges */}
                {liveObservation?.visualMetrics && liveObservation.visualMetrics.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-white/70 p-3 border border-slate-200/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      System Balance Gauges:
                    </span>
                    {liveObservation.visualMetrics.map((vm, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-700">
                          <span>{vm.label}</span>
                          <span className="font-bold">{vm.percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={cn('h-full transition-all duration-300', vm.color || 'bg-sky-600')}
                            style={{ width: `${Math.min(100, Math.max(0, vm.percent))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Scientific Observation & Law */}
                <div className="text-xs space-y-1.5 pt-1">
                  <p className="font-semibold text-slate-900 leading-relaxed">
                    {liveObservation?.observationText}
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    <strong className="text-slate-800">Governing Principle:</strong> {liveObservation?.scientificPrinciple}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Experimental Trials History Log (if student recorded data) */}
          {recordedTrials.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-sky-600" />
                Lab Notebook — Recorded Trial Observations
              </span>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-1.5 px-2">Trial #</th>
                      <th className="py-1.5 px-2">{lab.primaryVariable.label}</th>
                      {lab.secondaryVariable && <th className="py-1.5 px-2">{lab.secondaryVariable.label}</th>}
                      <th className="py-1.5 px-2">Recorded Output</th>
                      <th className="py-1.5 px-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recordedTrials.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="py-1.5 px-2 font-bold text-slate-700">#{t.id}</td>
                        <td className="py-1.5 px-2 font-mono">
                          {t.val1} {lab.primaryVariable.unit}
                        </td>
                        {lab.secondaryVariable && (
                          <td className="py-1.5 px-2 font-mono">
                            {t.val2} {lab.secondaryVariable.unit}
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-semibold text-slate-900">{t.result.valueDisplay}</td>
                        <td className="py-1.5 px-2 text-slate-400 text-[11px]">{t.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Procedure Steps Accordion */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowProcedure((p) => !p)}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-900"
            >
              <span>{showProcedure ? 'Hide Experiment Procedure' : 'Show Step-by-Step Experiment Procedure'}</span>
              {showProcedure ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showProcedure && (
              <ol className="mt-3 space-y-2 text-xs text-slate-700 pl-4 list-decimal">
                {lab.procedureSteps.map((step) => (
                  <li key={step.step} className="leading-relaxed">
                    <span className="font-semibold text-slate-900">{step.instruction}</span>
                    {step.tip && <p className="mt-0.5 text-[11px] text-sky-700 font-medium">Tip: {step.tip}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Real-World Demonstration & Misconception Breakdown Card */}
      <Card className="border-amber-200 bg-amber-50/40 shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white shadow-2xs">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Real-World Demonstration & Misconception Breakdown
              </h4>
              <p className="text-sm font-bold text-slate-900">{lab.realWorldDemonstration.scenarioTitle}</p>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            {lab.realWorldDemonstration.realWorldExample}
          </p>

          <div className="rounded-xl border border-amber-200 bg-white p-3.5 text-xs text-amber-950 shadow-2xs">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
              Why the Common Misconception Occurs:
            </p>
            <p className="mt-1 leading-relaxed text-slate-700">
              {lab.realWorldDemonstration.whyMisconceptionOccurs}
            </p>
            <p className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
              Practical Takeaway: {lab.realWorldDemonstration.practicalTakeaway}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Understanding Evaluation Gate (Concept Verification Quiz) */}
      <Card className={cn('border shadow-sm transition-all', verificationPassed ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white')}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-2xs',
                  verificationPassed ? 'bg-emerald-600' : 'bg-purple-700'
                )}
              >
                {verificationPassed ? <CheckCircle2 className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Concept Verification — Evaluate Understanding
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Answer the verification questions below to confirm you have grasped the concept before moving forward.
                </CardDescription>
              </div>
            </div>

            {verificationPassed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Verified & Ready
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {lab.verificationQuestions.map((q, qIndex) => {
            const selectedOptId = answers[q.id];

            return (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-slate-900">
                  <span className="text-purple-700 font-extrabold mr-1">Q{qIndex + 1}.</span>
                  {q.question}
                </p>

                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const isSelected = selectedOptId === opt.id;
                    const showFeedback = quizSubmitted;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={quizSubmitted}
                        onClick={() => handleSelectAnswer(q.id, opt.id)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-all',
                          isSelected
                            ? 'border-purple-600 bg-purple-50 text-purple-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          showFeedback && opt.isCorrect && 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold',
                          showFeedback && isSelected && !opt.isCorrect && 'border-rose-400 bg-rose-50 text-rose-950'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            isSelected ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700',
                            showFeedback && opt.isCorrect && 'bg-emerald-600 text-white',
                            showFeedback && isSelected && !opt.isCorrect && 'bg-rose-500 text-white'
                          )}
                        >
                          {opt.id.toUpperCase()}
                        </span>
                        <div className="flex-1 space-y-1">
                          <span className="leading-snug">{opt.label}</span>
                          {showFeedback && (isSelected || opt.isCorrect) && (
                            <p
                              className={cn(
                                'text-[11px] pt-1 font-normal',
                                opt.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                              )}
                            >
                              {opt.explanation}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {!quizSubmitted ? (
              <Button
                size="sm"
                disabled={Object.keys(answers).length < lab.verificationQuestions.length}
                onClick={handleVerifyUnderstanding}
                className="gap-2 bg-purple-700 text-xs font-semibold text-white hover:bg-purple-800"
              >
                <span>Verify Practical Understanding</span>
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            ) : !verificationPassed ? (
              <div className="flex items-center gap-3">
                <p className="text-xs text-rose-700 font-medium">
                  Some answers were incorrect. Review the experimental readout above and try again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Concept mastery successfully verified through practical simulation!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
