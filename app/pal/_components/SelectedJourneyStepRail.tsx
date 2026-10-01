'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Compass,
  Layers,
  Lock,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  getStageImage,
  isStepUnlocked,
  JOURNEY_STEPS,
  type JourneyImageInfo,
  type JourneyStepId,
} from './H5PJourneyCollage';
import { stageHref } from './journey-stages';

export interface SelectedJourneyStepRailProps {
  selectedStep: JourneyStepId;
  images?: Record<string, JourneyImageInfo>;
  subjectName?: string;
  chapterName?: string;
  chapterId?: string | number | null;
  conceptId?: string | number | null;
  completedSteps?: Set<JourneyStepId> | readonly JourneyStepId[];
  lockedSteps?: readonly JourneyStepId[];
  bypassedSteps?: readonly JourneyStepId[];
  onSelectStep?: (stepId: JourneyStepId) => void;
  onBackToCollage?: () => void;
  className?: string;
}

export function SelectedJourneyStepRail({
  selectedStep,
  images,
  subjectName = 'Learning Journey',
  chapterName = 'Chapter Curriculum',
  chapterId,
  conceptId,
  completedSteps,
  onSelectStep,
  onBackToCollage,
  className,
}: SelectedJourneyStepRailProps) {
  const router = useRouter();
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Derive effective chapter id from prop, session storage, or route
  const effectiveChapterId =
    chapterId ??
    (typeof window !== 'undefined' ? sessionStorage.getItem('pal_active_chapter_id') : null);

  const completedSet = useMemo(() => {
    return completedSteps instanceof Set ? completedSteps : new Set(completedSteps || []);
  }, [completedSteps]);

  const currentStep = JOURNEY_STEPS.find((s) => s.id === selectedStep) || JOURNEY_STEPS[0];
  const activeImage = getStageImage(images, selectedStep);
  const isCompleted = completedSet.has(selectedStep);
  const totalSteps = JOURNEY_STEPS.length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Return to Journey Button (available whenever onBackToCollage or chapter is known) */}
      {(onBackToCollage || effectiveChapterId) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (onBackToCollage) {
              onBackToCollage();
            } else if (effectiveChapterId) {
              router.push(`/pal/diagnostic/chapter/${effectiveChapterId}`);
            }
          }}
          className="w-full justify-center gap-2 border-indigo-200 bg-white font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Journey Overview</span>
        </Button>
      )}

      {/* Interactive Active Step Image Card (Compact -> Smooth Scale-up on Hover) */}
      <div className="relative isolate group">
        <div
          role="button"
          tabIndex={0}
          aria-label={`View full ${currentStep.label} visual representation`}
          onClick={() => setImageModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setImageModalOpen(true);
            }
          }}
          className={cn(
            'relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm',
            'cursor-pointer transition-all duration-300 ease-out',
            // Smooth enlargement without pushing layout geometry
            'hover:scale-[1.04] hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-400 hover:ring-2 hover:ring-purple-400/40',
            'active:scale-[0.98]'
          )}
        >
          {/* Image Container with compact fixed height */}
          <div className="relative h-48 w-full overflow-hidden bg-slate-950 sm:h-52">
            <img
              src={activeImage.url}
              alt={`${currentStep.label} visual representation`}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-108"
            />

            {/* Dark vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 transition-opacity duration-300 group-hover:from-black/75" />

            {/* Top Left: Step number pill */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                {currentStep.stepNumber}
              </span>
              <span>Step {currentStep.stepNumber} of {totalSteps}</span>
            </div>

            {/* Top Right: Clickable / Active hint badge */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-md transition-all group-hover:bg-purple-600 group-hover:border-purple-300">
                <Maximize2 className="h-3 w-3 text-purple-300" />
                <span className="hidden sm:inline group-hover:inline">Click to zoom</span>
                <span className="sm:hidden group-hover:hidden">Active</span>
              </span>
            </div>

            {/* Center hover indicator */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-purple-600/90 text-white shadow-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            {/* Bottom Title on Image */}
            <div className="absolute right-3 bottom-2.5 left-3 z-10">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                Current Journey Stage
              </p>
              <h3 className="text-base font-bold text-white drop-shadow-md">
                {currentStep.label}
              </h3>
            </div>
          </div>

          {/* Card body information */}
          <div className="border-t border-slate-100 bg-white p-3.5">
            <p className="text-xs leading-relaxed text-slate-600">
              {currentStep.detail}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
              <span className="max-w-[130px] truncate font-medium text-slate-700">
                {chapterName}
              </span>
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Step Completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  In Progress
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Step Switcher Strip with Sequential Locks */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Journey Steps
          </h4>
          <span className="text-[10px] text-slate-400">Sequential</span>
        </div>

        <div className="space-y-1">
          {JOURNEY_STEPS.map((step) => {
            const isCurrent = step.id === selectedStep;
            const isUnlocked = isStepUnlocked(step.id, completedSet);
            const isDone = completedSet.has(step.id);
            const stepImg = getStageImage(images, step.id);

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  if (isUnlocked) {
                    if (onSelectStep) {
                      onSelectStep(step.id);
                    } else {
                      const href = stageHref(step.id, { chapterId: effectiveChapterId, conceptId });
                      if (href) router.push(href);
                    }
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-xs transition-colors',
                  isCurrent
                    ? 'border border-purple-200 bg-purple-50 font-semibold text-purple-900 shadow-sm'
                    : isUnlocked
                    ? 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                    : 'cursor-not-allowed bg-slate-50/50 text-slate-400 opacity-60'
                )}
              >
                {/* Mini thumbnail */}
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  <img
                    src={stepImg.thumbnailUrl || stepImg.url}
                    alt=""
                    className={cn('h-full w-full object-cover', !isUnlocked && 'grayscale-[60%]')}
                  />
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Lock className="h-3.5 w-3.5 text-white/90" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">
                    {step.stepNumber}. {step.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">
                    {isUnlocked ? step.shortDescription : `Complete Step ${step.stepNumber - 1}`}
                  </p>
                </div>

                {isCurrent ? (
                  <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                    Now
                  </span>
                ) : isDone ? (
                  <span className="shrink-0 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                ) : !isUnlocked ? (
                  <span className="shrink-0 text-slate-400">
                    <Lock className="h-3 w-3" />
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Image Lightbox Dialog on Click */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-0 border-slate-200">
          <div className="relative h-72 w-full overflow-hidden bg-slate-950 sm:h-96">
            <img
              src={activeImage.url}
              alt={currentStep.label}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />
            <div className="absolute right-4 bottom-4 left-4 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-semibold text-white mb-2">
                Step {currentStep.stepNumber} of {totalSteps}
              </span>
              <h2 className="text-xl font-bold">{currentStep.label}</h2>
              <p className="mt-1 text-xs text-slate-300">{currentStep.detail}</p>
            </div>
          </div>
          <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">{subjectName} › {chapterName}</p>
              <p className="text-[11px] text-slate-400">{activeImage.title || currentStep.shortDescription}</p>
            </div>
            <Button size="sm" onClick={() => setImageModalOpen(false)}>
              Close Visual
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
