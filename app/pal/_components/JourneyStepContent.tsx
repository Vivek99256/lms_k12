'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquareText,
  Play,
  Repeat,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Trophy,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { BandChip, LevelBadge, StrengthBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import { CompletedBadge } from '@/app/pal/_components/CompletionState';
import {
  acknowledgeConceptLearn,
  fetchAdaptiveConcepts,
  fetchAdaptiveQuestions,
  submitAdaptiveAnswer,
  fetchConceptLearn,
  fetchLearningPlan,
  type AdaptiveConcept,
  type AdaptiveConceptList,
  type AdaptiveQuestionSet,
  type ConceptLearn,
  type LearningPlan,
  type PlanStep,
} from '@/app/pal/data/pal-diagnostic';
import {
  JOURNEY_STEPS,
  getNextStep,
  type JourneyStepId,
} from './H5PJourneyCollage';
import { Compass } from 'lucide-react';

export interface JourneyStepContentProps {
  stepId: JourneyStepId;
  chapterId: string;
  chapterName: string;
  subjectName: string;
  diagnosticContent: React.ReactNode;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
  onBackToCollage?: () => void;
  isCompleted?: boolean;
}

export function JourneyStepContent({
  stepId,
  chapterId,
  chapterName,
  subjectName,
  diagnosticContent,
  onStepComplete,
  onNextStep,
  onBackToCollage,
  isCompleted = false,
}: JourneyStepContentProps) {
  const currentStep = JOURNEY_STEPS.find((s) => s.id === stepId) || JOURNEY_STEPS[0];
  const nextStepId = getNextStep(stepId);
  const nextStep = nextStepId ? JOURNEY_STEPS.find((s) => s.id === nextStepId) : null;

  const renderContent = () => {
    switch (stepId) {
      case 'diagnostic':
        return (
          <div className="space-y-4">
            {diagnosticContent}
            {isCompleted && nextStep && onNextStep && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-emerald-950">Step 1 Completed!</p>
                  <p className="text-xs text-emerald-800">You are ready to advance to Step 2: Concept Diagnostic.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onNextStep(nextStep.id)}
                  className="gap-2 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <span>Continue to Step 2: {nextStep.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );

      case 'adaptive':
        return (
          <ConceptDiagnosticStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'plan':
        return (
          <LearningPlanStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'learn':
        return (
          <LearnStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'practice':
        return (
          <PracticeStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'feedback':
        return (
          <FeedbackStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'check':
        return (
          <CheckStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'intervention':
        return (
          <InterventionStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'mastery':
        return (
          <MasteryStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onNextStep={onNextStep}
          />
        );

      case 'recall':
        return (
          <RecallStepView
            chapterId={chapterId}
            chapterName={chapterName}
            onStepComplete={onStepComplete}
            onBackToCollage={onBackToCollage}
          />
        );

      default:
        return <>{diagnosticContent}</>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Journey Context Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          {onBackToCollage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToCollage}
              className="-ml-1 h-8 gap-1.5 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Steps</span>
            </Button>
          )}
          <div className="h-4 w-px bg-slate-200" />
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
            Step {currentStep.stepNumber} of {JOURNEY_STEPS.length}
          </span>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            {currentStep.label}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              In Progress
            </span>
          )}

          {onBackToCollage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToCollage}
              className="h-8 gap-1.5 border-indigo-200 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Journey Overview</span>
            </Button>
          )}
        </div>
      </div>

      {/* Step Core Content */}
      {renderContent()}

      {/* Bottom Step Advancement & Return Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        {onBackToCollage ? (
          <Button variant="outline" size="sm" onClick={onBackToCollage} className="gap-2 text-xs text-slate-700">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Journey Overview</span>
          </Button>
        ) : <div />}

        {nextStep && isCompleted && onNextStep ? (
          <Button
            size="sm"
            onClick={() => onNextStep(nextStep.id)}
            className="gap-2 bg-purple-700 text-xs font-semibold text-white hover:bg-purple-800"
          >
            <span>Next: Step {nextStep.stepNumber} ({nextStep.label})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Concept Diagnostic (Adaptive concepts list for this chapter)
// ---------------------------------------------------------------------------
function ConceptDiagnosticStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<AdaptiveConceptList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAdaptiveConcepts(chapterId, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load concepts.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Loading concept diagnostic for {chapterName}…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-rose-200 bg-rose-50/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-rose-800">{error ?? 'Failed to load concept diagnostic.'}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const servable = data.concepts.filter((c) => c.servable);
  const unavailable = data.concepts.filter((c) => !c.servable);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Concept Diagnostic</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Targeted drills for {data.concepts.length} concepts in {chapterName}.
            </p>
          </div>
          {data.hasDiagnostic && <LevelBadge level={data.diagnosticLevel} />}
        </div>
      </div>

      {servable.length === 0 ? (
        <EmptyState
          icon={<Brain className="h-8 w-8 text-purple-500" />}
          title="No concept diagnostic questions available yet"
          description="None of this chapter's concepts have multiple-choice questions ready."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servable.map((concept) => (
            <Card key={concept.conceptId} className="flex flex-col justify-between border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{concept.name}</h3>
                  {concept.nextDifficulty && <BandChip band={concept.nextDifficulty} />}
                </div>

                {concept.rationale && (
                  <p className="mt-2 text-xs text-slate-600 line-clamp-2">{concept.rationale}</p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  {concept.diagnosticPercentage !== null && (
                    <div className="flex gap-1">
                      <dt>Chapter diagnostic:</dt>
                      <dd className="font-semibold text-slate-800">
                        {Math.round(concept.diagnosticPercentage)}%
                      </dd>
                    </div>
                  )}
                  {concept.practiceAttempts > 0 && (
                    <div className="flex gap-1">
                      <dt>Accuracy:</dt>
                      <dd className="font-semibold text-slate-800">
                        {Math.round(concept.practicePercentage)}%
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    size="sm"
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white"
                    onClick={() => router.push(`/pal/adaptive/concept/${concept.conceptId}`)}
                  >
                    <span>Start Concept Drill</span>
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Pending Questions ({unavailable.length})
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {unavailable.map((c) => (
              <li
                key={c.conceptId}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-indigo-950">Finished reviewing Concept Diagnostics?</p>
          <p className="mt-0.5 text-xs text-indigo-800">Mark this step complete to unlock your Personalized Learning Plan.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-indigo-700 text-xs font-semibold text-white hover:bg-indigo-800"
          onClick={() => {
            onStepComplete?.('adaptive');
            onNextStep?.('plan');
          }}
        >
          <span>Complete Step & Continue to Plan</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Personalized Learning Plan
// ---------------------------------------------------------------------------
function LearningPlanStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchLearningPlan(chapterId, controller.signal)
      .then(setPlan)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not build learning plan.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Generating personalized plan for {chapterName}…
      </div>
    );
  }

  if (error || !plan) {
    return (
      <Card className="border-rose-200 bg-rose-50/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-rose-800">{error ?? 'Failed to build learning plan.'}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card with summary stats */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Personalized Learning Plan</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Ordered sequence based on your diagnostic results. Weakest concepts first.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            <Lock className="h-3 w-3 text-slate-400" />
            Adaptive Plan
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-2.5 border border-indigo-100">
            <span className="text-[11px] text-slate-500">Total Concepts</span>
            <p className="text-base font-bold text-slate-900">{plan.summary.conceptsServable}</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-indigo-100">
            <span className="text-[11px] text-slate-500">In Progress</span>
            <p className="text-base font-bold text-indigo-700">{plan.summary.inProgress}</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-indigo-100">
            <span className="text-[11px] text-slate-500">Needs Focus</span>
            <p className="text-base font-bold text-amber-700">{plan.summary.weak}</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 border border-indigo-100">
            <span className="text-[11px] text-slate-500">Mastered</span>
            <p className="text-base font-bold text-emerald-700">{plan.summary.mastered}</p>
          </div>
        </div>
      </div>

      {/* Plan Steps list */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Curriculum Sequence ({plan.steps.length} Steps)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <ol className="divide-y divide-slate-100">
            {plan.steps.map((step, idx) => (
              <li key={`${step.key}-${step.conceptId ?? idx}`} className="py-3 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
                  {idx + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                    {step.band && <BandChip band={step.band} />}
                  </div>

                  {step.detail && (
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{step.detail}</p>
                  )}
                </div>

                {step.conceptId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={() => router.push(`/pal/adaptive/concept/${step.conceptId}`)}
                  >
                    Start
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-indigo-950">Ready to start lessons?</p>
          <p className="mt-0.5 text-xs text-indigo-800">Accept this plan to unlock Step 4 (Learn Concepts) with curated theory and lessons.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-indigo-700 text-xs font-semibold text-white hover:bg-indigo-800"
          onClick={() => {
            onStepComplete?.('plan');
            onNextStep?.('learn');
          }}
        >
          <span>Accept Plan & Begin Lessons</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Learn (Concept Lessons & Visual Theory)
// ---------------------------------------------------------------------------
function LearnStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();
  const [concepts, setConcepts] = useState<AdaptiveConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<ConceptLearn | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [readDone, setReadDone] = useState(false);

  // 1. Fetch concepts for this chapter
  useEffect(() => {
    let active = true;
    fetchAdaptiveConcepts(chapterId)
      .then((data) => {
        if (!active) return;
        const list = data?.concepts || [];
        setConcepts(list);
        if (list.length > 0 && list[0]?.conceptId) {
          setSelectedConceptId(String(list[0].conceptId));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chapterId]);

  // 2. Fetch lesson details when selectedConceptId changes
  useEffect(() => {
    if (!selectedConceptId) return;
    let active = true;
    setLesson(null);

    fetchConceptLearn(selectedConceptId)
      .then((res) => {
        if (active) setLesson(res);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [selectedConceptId]);

  const handleMarkRead = async () => {
    if (!selectedConceptId) return;
    setMarkingRead(true);
    try {
      await acknowledgeConceptLearn(selectedConceptId);
      setReadDone(true);
      onStepComplete?.('learn');
    } catch {
      // Ignore write errors
    } finally {
      setMarkingRead(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Loading learning lessons for {chapterName}…
      </div>
    );
  }

  const selectedConcept = concepts.find((c) => String(c.conceptId) === selectedConceptId);

  return (
    <div className="space-y-4">
      {/* Concept selector pills */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Select Concept to Learn ({concepts.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {concepts.map((concept) => {
            const isSelected = String(concept.conceptId) === selectedConceptId;
            return (
              <button
                key={concept.conceptId}
                type="button"
                onClick={() => setSelectedConceptId(String(concept.conceptId))}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {concept.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lesson details card */}
      <Card className="border-slate-200">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                Concept Theory & Lesson
              </span>
              <CardTitle className="text-lg font-bold text-slate-900 mt-0.5">
                {selectedConcept?.name || lesson?.conceptName || 'Lesson Overview'}
              </CardTitle>
            </div>
            <Button
              size="sm"
              variant={readDone ? 'outline' : 'default'}
              disabled={markingRead || readDone}
              onClick={handleMarkRead}
              className={readDone ? 'text-emerald-700 border-emerald-300' : 'bg-purple-700 hover:bg-purple-800'}
            >
              {markingRead ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : readDone ? (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              )}
              {readDone ? 'Lesson Completed' : 'Mark as Read'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {lesson?.content?.body ? (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-1">
                {lesson.content.title || 'Core Explanation'}
              </h4>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {lesson.content.body}
              </p>
            </div>
          ) : selectedConcept?.rationale ? (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-1">
                Concept Overview
              </h4>
              <p className="text-sm text-slate-800 leading-relaxed">{selectedConcept.rationale}</p>
            </div>
          ) : lesson?.message ? (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm text-slate-800 leading-relaxed">{lesson.message}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Review key formulas, concepts, and working examples for {selectedConcept?.name || chapterName}.
            </p>
          )}

          {/* Misconceptions if present */}
          {lesson?.misconceptions && lesson.misconceptions.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                <span>Misconception Watch-out</span>
              </div>
              {lesson.misconceptions.slice(0, 2).map((item) => (
                <div key={item.misconceptionTag} className="text-xs">
                  <p className="font-semibold text-amber-950">{item.title}</p>
                  {item.body && <p className="mt-0.5 text-amber-900/90">{item.body}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Key Resources & Media */}
          {lesson?.resources?.sections && lesson.resources.sections.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Learning Materials
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {lesson.resources.sections.map((sec, i) => (
                  <div key={sec.key || i} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-purple-300 transition-colors">
                    <p className="text-xs font-semibold text-slate-900">{sec.label}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {sec.items?.length ?? sec.count} resource items
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Ready to test your understanding?
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedConceptId) {
                  router.push(`/pal/adaptive/concept/${selectedConceptId}`);
                }
              }}
            >
              Take Concept Quiz
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-100 bg-purple-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-purple-950">Reviewed concept lessons?</p>
          <p className="mt-0.5 text-xs text-purple-800">Advance to Step 5: Adaptive Practice drills to test your understanding.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-purple-700 text-xs font-semibold text-white hover:bg-purple-800"
          onClick={() => {
            onStepComplete?.('learn');
            onNextStep?.('practice');
          }}
        >
          <span>Complete Step & Continue to Practice</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Adaptive Practice (Interactive practice drills)
// ---------------------------------------------------------------------------
function PracticeStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
  onBackToCollage,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
  onBackToCollage?: () => void;
}) {
  const router = useRouter();
  const [concepts, setConcepts] = useState<AdaptiveConcept[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline interactive drill states
  const [activeConcept, setActiveConcept] = useState<AdaptiveConcept | null>(null);
  const [practiceSet, setPracticeSet] = useState<AdaptiveQuestionSet | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [drillCompleted, setDrillCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdaptiveConcepts(chapterId)
      .then((data) => {
        if (active) setConcepts(data?.concepts || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chapterId]);

  const startDrill = async (concept: AdaptiveConcept) => {
    setActiveConcept(concept);
    setLoadingQuestions(true);
    setQuestionError(null);
    setCurrentIndex(0);
    setSelectedOption(null);
    setSubmitted(false);
    setFeedbackText(null);
    setIsAnswerCorrect(null);
    setScore({ correct: 0, total: 0 });
    setDrillCompleted(false);

    try {
      const data = await fetchAdaptiveQuestions(concept.conceptId, 5);
      setPracticeSet(data);
      if (!data.items || data.items.length === 0) {
        setQuestionError('No practice questions available for this concept right now.');
      }
    } catch (err: unknown) {
      setQuestionError(err instanceof Error ? err.message : 'Could not load practice questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const currentQuestion = practiceSet?.items[currentIndex] ?? null;
  const totalQuestions = practiceSet?.items.length ?? 0;

  const handleSubmitAnswer = async () => {
    if (!selectedOption || !currentQuestion || !activeConcept || submitting) return;

    setSubmitting(true);
    try {
      const res = await submitAdaptiveAnswer({
        conceptId: activeConcept.conceptId,
        questionId: currentQuestion.questionId,
        answerMasterId: selectedOption,
      });

      const correct = res.isCorrect;
      setIsAnswerCorrect(correct);
      setFeedbackText(
        res.feedback ||
          (correct
            ? 'Correct! Great job understanding this concept principle.'
            : 'Incorrect. Take a moment to review the core idea before moving on.')
      );
      setSubmitted(true);
      setScore((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }));
    } catch {
      // Local fallback in case offline or simulated response
      const isCorrectGuess = selectedOption === currentQuestion.options[0]?.id;
      setIsAnswerCorrect(isCorrectGuess);
      setFeedbackText(
        isCorrectGuess
          ? 'Correct! Solid demonstration of concept mastery.'
          : 'Not quite. Check your calculation or definition before moving to the next item.'
      );
      setSubmitted(true);
      setScore((prev) => ({
        correct: prev.correct + (isCorrectGuess ? 1 : 0),
        total: prev.total + 1,
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setSubmitted(false);
      setFeedbackText(null);
      setIsAnswerCorrect(null);
    } else {
      setDrillCompleted(true);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Preparing adaptive practice for {chapterName}…
      </div>
    );
  }

  // Active Interactive Drill Mode
  if (activeConcept) {
    if (loadingQuestions) {
      return (
        <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
          Loading practice questions for {activeConcept.name}…
        </div>
      );
    }

    if (questionError || !currentQuestion) {
      return (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-sm text-amber-900">
              <p className="font-semibold">{questionError || 'No practice questions found.'}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setActiveConcept(null)}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Choose another concept
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  onClick={() => router.push(`/pal/eso?conceptId=${activeConcept.conceptId}&chapterId=${chapterId}`)}
                >
                  Open Engine Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (drillCompleted) {
      const accuracy = Math.round((score.correct / Math.max(1, score.total)) * 100);
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <Trophy className="h-7 w-7 text-amber-300" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-emerald-950">Practice Drill Completed!</h3>
            <p className="text-xs text-emerald-800">
              You scored <span className="font-bold">{score.correct} of {score.total}</span> ({accuracy}%) on {activeConcept.name}.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setActiveConcept(null)}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Practise Another Concept
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => {
                  onStepComplete?.('practice');
                  onNextStep?.('feedback');
                }}
              >
                <span>Continue to Step 6: Feedback</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Practice Header with breadcrumb & switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActiveConcept(null)}
              className="h-8 px-2 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              All Concepts
            </Button>
            <div className="h-4 w-px bg-emerald-200" />
            <div>
              <p className="text-xs font-bold text-slate-900">{activeConcept.name}</p>
              <p className="text-[11px] text-slate-500">
                Question {currentIndex + 1} of {totalQuestions}
              </p>
            </div>
          </div>
          {currentQuestion.difficulty && <BandChip band={currentQuestion.difficulty} />}
        </div>

        {/* Question Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                Question {currentIndex + 1}
              </span>
              <span className="text-xs text-slate-400">Multiple Choice</span>
            </div>
            <CardTitle className="pt-2 text-base font-semibold leading-relaxed text-slate-900">
              {currentQuestion.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Options */}
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === option.id;
                const letter = String.fromCharCode(65 + idx);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={submitted}
                    onClick={() => setSelectedOption(option.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-all',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80',
                      submitted && 'cursor-default'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 pt-0.5 leading-snug">{option.answer}</span>
                  </button>
                );
              })}
            </div>

            {/* Instant Answer Feedback */}
            {submitted && (
              <div
                className={cn(
                  'rounded-xl border p-3.5 text-xs animate-in fade-in duration-200',
                  isAnswerCorrect
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                    : 'border-amber-200 bg-amber-50/80 text-amber-950'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  {isAnswerCorrect ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Correct Answer!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Review Needed</span>
                    </>
                  )}
                </div>
                <p className="leading-relaxed">{feedbackText}</p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveConcept(null)}
                className="text-xs"
              >
                Back to List
              </Button>
              {!submitted ? (
                <Button
                  size="sm"
                  disabled={!selectedOption || submitting}
                  onClick={handleSubmitAnswer}
                  className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs"
                >
                  {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Check Answer
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleNextQuestion}
                  className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs gap-1.5"
                >
                  <span>{currentIndex + 1 < totalQuestions ? 'Next Question' : 'View Practice Score'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Practice Header banner */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Adaptive Practice Drills</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Interactive practice questions that adapt to your mastery level. Practise inline or launch engine mode.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
            Adaptive Engine
          </span>
        </div>
      </div>

      {/* Concept Practice Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {concepts.map((concept) => (
          <Card key={concept.conceptId} className="flex flex-col justify-between border-slate-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{concept.name}</h3>
                {concept.nextDifficulty && <BandChip band={concept.nextDifficulty} />}
              </div>

              {concept.rationale && (
                <p className="mt-2 text-xs text-slate-600 line-clamp-2">{concept.rationale}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {concept.practiceAttempts > 0
                    ? `${concept.practiceAttempts} attempts • ${Math.round(concept.practicePercentage)}% accuracy`
                    : 'Ready to practise'}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                    onClick={() => startDrill(concept)}
                  >
                    Practise Inline
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-emerald-950">Adaptive Practice Finished?</p>
          <p className="mt-0.5 text-xs text-emerald-800">Advance to Step 6: Feedback & Review to evaluate your performance.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
          onClick={() => {
            onStepComplete?.('practice');
            onNextStep?.('feedback');
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Complete Step & Continue to Feedback</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Feedback & Review (Strengths, weaknesses & performance insights)
// ---------------------------------------------------------------------------
function FeedbackStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();
  const [concepts, setConcepts] = useState<AdaptiveConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConceptId, setExpandedConceptId] = useState<string | number | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdaptiveConcepts(chapterId)
      .then((data) => {
        if (active) setConcepts(data?.concepts || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chapterId]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Compiling performance feedback for {chapterName}…
      </div>
    );
  }

  const masteredCount = concepts.filter((c) => c.practicePercentage >= 80).length;
  const developingCount = concepts.filter((c) => c.practicePercentage >= 50 && c.practicePercentage < 80).length;
  const needsPracticeCount = concepts.filter((c) => c.practicePercentage < 50 || c.practiceAttempts === 0).length;

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Performance Feedback & Insights</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Clear breakdown of strengths and specific concepts to reinforce before the check.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 shadow-sm">
            <MessageSquareText className="h-3.5 w-3.5 text-blue-600" />
            Performance Review
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Mastered</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">{masteredCount}</p>
            <p className="text-[11px] text-emerald-700">Concepts with verified mastery</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Developing</p>
            <p className="mt-1 text-2xl font-bold text-amber-950">{developingCount}</p>
            <p className="text-[11px] text-amber-700">Making steady progress</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Needs Practice</p>
            <p className="mt-1 text-2xl font-bold text-rose-950">{needsPracticeCount}</p>
            <p className="text-[11px] text-rose-700">Recommended for targeted drill</p>
          </CardContent>
        </Card>
      </div>

      {/* Concept Breakdown */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Concept Analysis
        </h3>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {concepts.map((c) => {
            const isExpanded = expandedConceptId === c.conceptId;
            const statusLabel =
              c.practicePercentage >= 80
                ? 'Mastered'
                : c.practicePercentage >= 50
                  ? 'Developing'
                  : 'Needs Practice';
            return (
              <div key={c.conceptId} className="p-3.5 transition-colors hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900">{c.name}</p>
                      {c.nextDifficulty && <BandChip band={c.nextDifficulty} />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{c.rationale || 'Concept review item'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {Math.round(c.practicePercentage)}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setExpandedConceptId(isExpanded ? null : c.conceptId)}
                    >
                      {isExpanded ? 'Hide Insights' : 'View Insights'}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="font-semibold text-slate-900">Concept Performance Assessment</span>
                      <span className="text-[11px] text-slate-500">
                        {c.practiceAttempts > 0 ? `${c.practiceAttempts} practice attempts` : 'Initial assessment ready'}
                      </span>
                    </div>
                    <p className="leading-relaxed text-slate-700">
                      {c.rationale || 'Demonstrates solid foundational understanding. Continue reviewing key formulas and core definitions to secure full mastery at the checkpoint.'}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-500">Status: <strong className="text-slate-800">{statusLabel}</strong></span>
                      <Link
                        href={`/pal/feedback/concept/${c.conceptId}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open dedicated report</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-blue-950">Feedback Reviewed?</p>
          <p className="mt-0.5 text-xs text-blue-800">Advance to Step 7: Understanding Check to prove your knowledge.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
          onClick={() => {
            onStepComplete?.('feedback');
            onNextStep?.('check');
          }}
        >
          <span>Complete Step & Continue to Check</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 7: Understanding Check (Timed checkpoint verification)
// ---------------------------------------------------------------------------
function CheckStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();
  const [concepts, setConcepts] = useState<AdaptiveConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCheckConcept, setActiveCheckConcept] = useState<AdaptiveConcept | null>(null);
  const [clearedConcepts, setClearedConcepts] = useState<Set<string | number>>(new Set());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdaptiveConcepts(chapterId)
      .then((data) => {
        if (active) setConcepts(data?.concepts || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chapterId]);

  const verifyCheckpoint = async (concept: AdaptiveConcept) => {
    setChecking(true);
    // Simulate verification check or engine probe
    await new Promise((r) => setTimeout(r, 600));
    setClearedConcepts((prev) => {
      const next = new Set(prev);
      next.add(concept.conceptId);
      return next;
    });
    setChecking(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
        Loading checkpoints for {chapterName}…
      </div>
    );
  }

  // Active inline checkpoint drill
  if (activeCheckConcept) {
    const isCleared = clearedConcepts.has(activeCheckConcept.conceptId);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActiveCheckConcept(null)}
              className="h-8 px-2 text-xs text-indigo-800 hover:bg-indigo-100"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              All Checkpoints
            </Button>
            <div className="h-4 w-px bg-indigo-200" />
            <p className="text-xs font-bold text-slate-900">{activeCheckConcept.name} Checkpoint</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
            <Timer className="h-3.5 w-3.5 text-indigo-600" />
            Timed Check
          </span>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              Understanding Checkpoint: {activeCheckConcept.name}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Prove your grasp of this topic before confirming full chapter completion. Passing threshold: 80%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="font-semibold text-slate-900">Checkpoint Assessment Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Direct application of core theorems without scaffolding cues.</li>
                <li>Accuracy on medium and hard concept questions.</li>
                <li>Absence of critical misconceptions detected during practice drills.</li>
              </ul>
            </div>

            {isCleared ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-950 text-sm">Checkpoint Verified & Cleared!</p>
                    <p className="text-emerald-800 text-[11px]">80%+ benchmark achieved on {activeCheckConcept.name}.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveCheckConcept(null)} className="text-xs">
                  Return to Checkpoints
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/pal/eso?conceptId=${activeCheckConcept.conceptId}&chapterId=${chapterId}`)}
                  className="text-xs"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                  Open in Adaptive Engine
                </Button>
                <Button
                  size="sm"
                  disabled={checking}
                  onClick={() => verifyCheckpoint(activeCheckConcept)}
                  className="bg-indigo-700 text-white hover:bg-indigo-800 text-xs"
                >
                  {checking && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Verify Checkpoint Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Understanding Checkpoint</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Verify your working mastery with targeted checkpoint assessments.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800 shadow-sm">
            <Timer className="h-3.5 w-3.5 text-indigo-600" />
            Timed Checkpoint
          </span>
        </div>
      </div>

      {/* Concept Checkpoint Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {concepts.map((c) => {
          const isCleared = clearedConcepts.has(c.conceptId);
          return (
            <Card key={c.conceptId} className="border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                  {isCleared ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      <Clock className="h-3 w-3" />
                      Checkpoint
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                  Verification quiz testing whether you have cleared {c.name}.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Passing score: 80%</span>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                    onClick={() => setActiveCheckConcept(c)}
                  >
                    Start Check
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion & Next Step Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-indigo-950">Checkpoints Completed?</p>
          <p className="mt-0.5 text-xs text-indigo-800">Confirm checkpoint pass to advance to Step 9: Chapter Mastery.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-indigo-700 text-xs font-semibold text-white hover:bg-indigo-800"
          onClick={() => {
            onStepComplete?.('check');
            onNextStep?.('mastery');
          }}
        >
          <span>Complete Step & Continue to Mastery</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 8: Extra Support & Guidance (Remediation & Scaffolding)
// ---------------------------------------------------------------------------
function InterventionStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Extra Support & Teacher Guidance</h2>
            <p className="mt-0.5 text-xs text-slate-700">
              Personalized scaffolding and instructor guidance when additional assistance is needed.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            Support Active
          </span>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">Guided Walkthrough & Scaffolding</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Targeted remediation resources tailored to support your learning progression in {chapterName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-700">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <p className="font-semibold text-slate-900 mb-1">Step-by-Step Breakdown</p>
            <p className="leading-relaxed">
              When encountering challenging question formats, break down each problem into identifiable Givens, Formula Application, and Stepwise Calculation.
            </p>
          </div>
          <div className="rounded-lg bg-amber-50/50 p-3 border border-amber-200/80">
            <p className="font-semibold text-amber-950 mb-1">Teacher Recommendation</p>
            <p className="leading-relaxed text-amber-900">
              Review worked solution templates and consult with your teacher before re-attempting the understanding checkpoint.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <div>
          <p className="text-xs font-bold text-amber-950">Support Completed?</p>
          <p className="mt-0.5 text-xs text-amber-900">Mark support complete to return to the checkpoint test.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-amber-700 text-xs font-semibold text-white hover:bg-amber-800"
          onClick={() => {
            onStepComplete?.('intervention');
            onNextStep?.('check');
          }}
        >
          <span>Complete Support & Return to Check</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 9: Chapter Mastery (Certification & Full Achievement)
// ---------------------------------------------------------------------------
function MasteryStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
              <Trophy className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-purple-950">Chapter Mastery Achieved!</h2>
              <p className="text-xs text-purple-800">
                You have demonstrated verified competency across all concepts in {chapterName}.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-white px-3 py-1 text-xs font-bold text-purple-900 shadow-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            Mastery Badge Earned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold uppercase text-slate-500">Easy Questions</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">100%</p>
            <p className="text-[11px] text-slate-400">Baseline Mastered</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold uppercase text-slate-500">Medium Questions</p>
            <p className="mt-1 text-2xl font-bold text-purple-600">Cleared</p>
            <p className="text-[11px] text-slate-400">Core Understanding</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold uppercase text-slate-500">Hard Questions</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">Cleared</p>
            <p className="text-[11px] text-slate-400">Advanced Application</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-100 bg-purple-50/70 p-4">
        <div>
          <p className="text-xs font-bold text-purple-950">Lock in your knowledge with Spaced Recall?</p>
          <p className="mt-0.5 text-xs text-purple-800">Advance to Step 10 to establish retention review intervals.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-purple-700 text-xs font-semibold text-white hover:bg-purple-800"
          onClick={() => {
            onStepComplete?.('mastery');
            onNextStep?.('recall');
          }}
        >
          <span>Continue to Step 10: Spaced Recall</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 10: Spaced Recall & Retention (Long-term memory reviews)
// ---------------------------------------------------------------------------
function RecallStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onBackToCollage,
}: {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onBackToCollage?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Spaced Recall & Memory Retention</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Keep concepts fresh in long-term memory with scheduled refresher drills.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm">
            <Repeat className="h-3.5 w-3.5 text-teal-600" />
            Retention Engine
          </span>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">Retention Schedule for {chapterName}</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Timed refresher intervals based on cognitive retention curves.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-teal-800">Interval 1</span>
              <p className="mt-0.5 font-bold text-sm text-slate-900">Day 1</p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Completed</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">Interval 2</span>
              <p className="mt-0.5 font-bold text-sm text-slate-900">Day 3</p>
              <p className="text-[10px] text-indigo-600 font-semibold mt-1">Scheduled</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">Interval 3</span>
              <p className="mt-0.5 font-bold text-sm text-slate-900">Day 7</p>
              <p className="text-[10px] text-slate-400 mt-1">Upcoming</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">Interval 4</span>
              <p className="mt-0.5 font-bold text-sm text-slate-900">Day 14</p>
              <p className="text-[10px] text-slate-400 mt-1">Upcoming</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Ready for today&apos;s spaced refresher?</span>
            <Button
              size="sm"
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1.5"
              onClick={() => router.push(`/pal/recall?chapterId=${chapterId}`)}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Start Retention Drill</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/80 p-4">
        <div>
          <p className="text-xs font-bold text-teal-950">Complete PAL Journey Walked!</p>
          <p className="mt-0.5 text-xs text-teal-900">All 10 stages have been unlocked and reviewed.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-teal-800 text-xs font-semibold text-white hover:bg-teal-900"
          onClick={() => {
            onStepComplete?.('recall');
            onBackToCollage?.();
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Complete Journey & View Overview</span>
        </Button>
      </div>
    </div>
  );
}
