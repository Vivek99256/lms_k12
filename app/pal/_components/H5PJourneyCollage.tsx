'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquareText,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JourneyStageKey } from './journey-stages';

export type JourneyStepId = JourneyStageKey;

export const STEP_SEQUENCE: JourneyStepId[] = [
  'diagnostic',
  'adaptive',
  'plan',
  'learn',
  'practice',
  'feedback',
  'check',
  'intervention',
  'mastery',
  'recall',
];

export interface JourneyImageInfo {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  creator?: string;
  license?: string;
  attribution?: string;
  provider?: string;
}

export interface JourneyStepMeta {
  id: JourneyStepId;
  stepNumber: number;
  label: string;
  shortDescription: string;
  detail: string;
  icon: LucideIcon;
  gridClass: string;
}

export const JOURNEY_STEPS: JourneyStepMeta[] = [
  {
    id: 'diagnostic',
    stepNumber: 1,
    label: 'Chapter Diagnostic',
    shortDescription: '15 Questions Baseline',
    detail: 'Fifteen questions across the chapter to establish your baseline readiness.',
    icon: ClipboardCheck,
    gridClass: 'md:col-start-1 md:row-start-1 h-[190px] md:h-[210px]',
  },
  {
    id: 'adaptive',
    stepNumber: 2,
    label: 'Concept Diagnostic',
    shortDescription: 'Concept-Level Drill',
    detail: 'Targeted drills per concept to identify precise strengths and gaps.',
    icon: Layers,
    gridClass: 'md:col-start-2 md:row-start-1 h-[190px] md:h-[210px]',
  },
  {
    id: 'plan',
    stepNumber: 3,
    label: 'Learning Plan',
    shortDescription: 'Personalized Roadmap',
    detail: 'Curated step-by-step curriculum ordered from weakest to strongest.',
    icon: Compass,
    gridClass: 'md:col-start-1 md:row-start-2 h-[190px] md:h-[210px]',
  },
  {
    id: 'learn',
    stepNumber: 4,
    label: 'Learn Concepts',
    shortDescription: 'Theory & Lessons',
    detail: 'Deep dive lessons, video explainers, and key theory before practicing.',
    icon: BookOpen,
    gridClass: 'md:col-start-2 md:row-start-2 h-[190px] md:h-[210px]',
  },
  {
    id: 'practice',
    stepNumber: 5,
    label: 'Adaptive Practice',
    shortDescription: 'Interactive Drills',
    detail: 'Smart question sets that adapt to your performance with instant review.',
    icon: GraduationCap,
    gridClass: 'md:col-start-3 md:row-start-1 md:row-span-2 h-[220px] md:h-full min-h-[380px]',
  },
  {
    id: 'feedback',
    stepNumber: 6,
    label: 'Feedback & Review',
    shortDescription: 'Performance Analysis',
    detail: 'Detailed breakdown of what went well and what concepts to revisit.',
    icon: MessageSquareText,
    gridClass: 'h-[190px] md:h-[210px]',
  },
  {
    id: 'check',
    stepNumber: 7,
    label: 'Understanding Check',
    shortDescription: 'Timed Assessment',
    detail: 'Understanding assessment determining if you have cleared this concept.',
    icon: Timer,
    gridClass: 'h-[190px] md:h-[210px]',
  },
  {
    id: 'intervention',
    stepNumber: 8,
    label: 'Extra Support',
    shortDescription: 'Teacher Guidance',
    detail: 'Targeted scaffolding and teacher-assisted support when extra help is needed.',
    icon: Lightbulb,
    gridClass: 'h-[190px] md:h-[210px]',
  },
  {
    id: 'mastery',
    stepNumber: 9,
    label: 'Concept Mastery',
    shortDescription: 'Milestone Achievement',
    detail: 'Official sign-off and recognition of mastery across the curriculum.',
    icon: Star,
    gridClass: 'h-[190px] md:h-[210px]',
  },
  {
    id: 'recall',
    stepNumber: 10,
    label: 'Spaced Recall',
    shortDescription: 'Memory Retention',
    detail: 'Scheduled refresher practice to ensure lasting retention and retrieval.',
    icon: Repeat,
    gridClass: 'h-[190px] md:h-[210px]',
  },
];

/**
 * Curated educational imagery for each journey stage, guaranteed to render
 * immediately with high visual polish even before API requests finish.
 */
export const DEFAULT_STAGE_IMAGES: Record<JourneyStepId, JourneyImageInfo> = {
  diagnostic: {
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80',
    title: 'Chapter Diagnostic Assessment',
    provider: 'educational-library',
  },
  adaptive: {
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1000&q=80',
    title: 'Concept Diagnostic Drills',
    provider: 'educational-library',
  },
  plan: {
    url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80',
    title: 'Personalized Learning Plan',
    provider: 'educational-library',
  },
  learn: {
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80',
    title: 'Concept Lessons & Theory',
    provider: 'educational-library',
  },
  practice: {
    url: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=1000&q=80',
    title: 'Adaptive Practice Drills',
    provider: 'educational-library',
  },
  feedback: {
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
    title: 'Feedback and Score Analysis',
    provider: 'educational-library',
  },
  check: {
    url: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=1000&q=80',
    title: 'Understanding Checkpoint Assessment',
    provider: 'educational-library',
  },
  intervention: {
    url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1000&q=80',
    title: 'Teacher Support and Guidance',
    provider: 'educational-library',
  },
  mastery: {
    url: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=1000&q=80',
    title: 'Chapter Mastery & Achievement',
    provider: 'educational-library',
  },
  recall: {
    url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1000&q=80',
    title: 'Spaced Recall and Retention',
    provider: 'educational-library',
  },
};

/**
 * Resolve stage image with guaranteed fallback so an image ALWAYS exists.
 */
export function getStageImage(
  images: Record<string, JourneyImageInfo> | undefined,
  stepId: JourneyStepId
): JourneyImageInfo {
  if (images && images[stepId]?.url) {
    return images[stepId];
  }
  return DEFAULT_STAGE_IMAGES[stepId] || DEFAULT_STAGE_IMAGES.diagnostic;
}

/**
 * Sequential lock check: A step is unlocked only if it's Step 1 (diagnostic)
 * or the immediately preceding step is marked completed.
 */
export function isStepUnlocked(
  stepId: JourneyStepId,
  completedSteps?: Set<JourneyStepId> | readonly JourneyStepId[]
): boolean {
  if (stepId === 'diagnostic') return true;
  if (!completedSteps) return false;
  const completedSet = completedSteps instanceof Set ? completedSteps : new Set(completedSteps);
  if (completedSet.has(stepId)) return true;
  const idx = STEP_SEQUENCE.indexOf(stepId);
  if (idx <= 0) return true;
  const prevStep = STEP_SEQUENCE[idx - 1];
  return completedSet.has(prevStep);
}

export function getNextStep(stepId: JourneyStepId): JourneyStepId | null {
  const idx = STEP_SEQUENCE.indexOf(stepId);
  if (idx < 0 || idx >= STEP_SEQUENCE.length - 1) return null;
  return STEP_SEQUENCE[idx + 1];
}

export interface H5PJourneyCollageProps {
  subjectName: string;
  chapterName: string;
  activeStep?: JourneyStepId | null;
  completedSteps?: Set<JourneyStepId>;
  onSelectStep: (stepId: JourneyStepId) => void;
  className?: string;
  images?: Record<string, JourneyImageInfo>;
}

export function H5PJourneyCollage({
  subjectName,
  chapterName,
  activeStep,
  completedSteps,
  onSelectStep,
  className,
  images: propImages,
}: H5PJourneyCollageProps) {
  const [images, setImages] = useState<Record<string, JourneyImageInfo>>(propImages || {});
  const [loading, setLoading] = useState(!propImages || Object.keys(propImages).length === 0);

  // Sync prop images if provided
  useEffect(() => {
    if (propImages && Object.keys(propImages).length > 0) {
      setImages(propImages);
      setLoading(false);
    }
  }, [propImages]);

  // Fetch dynamic images from web search API (cached per subject & chapter)
  useEffect(() => {
    if (propImages && Object.keys(propImages).length > 0) return;

    let isCancelled = false;
    const cacheKey = `pal_journey_images_${subjectName}_${chapterName}`.toLowerCase().replace(/\s+/g, '_');

    // 1. Check browser session cache
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setImages(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {
      // Ignore sessionStorage errors
    }

    setLoading(true);

    fetch(`/api/pal/journey-images?subject=${encodeURIComponent(subjectName)}&chapter=${encodeURIComponent(chapterName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data?.images) {
          setImages(data.images);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.images));
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic journey images:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [subjectName, chapterName, propImages]);

  return (
    <section
      aria-label="Your Journey - Interactive Branching Path"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-300/80 bg-slate-950 p-2 sm:p-3 text-white shadow-xl shadow-slate-900/15 transition-all',
        className
      )}
    >
      {/* Header bar of the collage */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-300">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="font-semibold tracking-wider uppercase text-purple-300">
            YOUR JOURNEY
          </span>
          <span className="text-slate-400">•</span>
          <span className="font-medium text-slate-300">{subjectName}</span>
          <span className="text-slate-500">›</span>
          <span className="font-medium text-slate-200">{chapterName}</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Sequential path • Complete each stage to unlock the next
        </p>
      </div>

      {/* The H5P Branching Scenario Mosaic Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 md:grid-rows-2">
        {JOURNEY_STEPS.map((step) => {
          const imageInfo = getStageImage(images, step.id);
          const hasImage = Boolean(imageInfo?.url);
          const isSelected = activeStep === step.id;
          const isUnlocked = isStepUnlocked(step.id, completedSteps);
          const isCompleted = completedSteps?.has(step.id);

          const handleClick = () => {
            if (!isUnlocked) return;
            onSelectStep(step.id);
          };

          return (
            <div
              key={step.id}
              role="button"
              tabIndex={isUnlocked ? 0 : -1}
              aria-disabled={!isUnlocked}
              onClick={handleClick}
              onKeyDown={(e) => {
                if (isUnlocked && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleClick();
                }
              }}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-xl border transition-all duration-300 focus-visible:outline-none',
                step.gridClass,
                isUnlocked
                  ? 'cursor-pointer hover:border-purple-400/80 hover:shadow-xl hover:shadow-purple-900/30'
                  : 'cursor-not-allowed opacity-65 border-white/5 bg-slate-900/50',
                isSelected && isUnlocked && 'border-purple-400 shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/50'
              )}
            >
              {/* Background Image / Fallback */}
              {loading && !hasImage ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
              ) : hasImage ? (
                <img
                  src={imageInfo.url}
                  alt={`${step.label} visual for ${chapterName}`}
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out',
                    isUnlocked ? 'group-hover:scale-105' : 'grayscale-[45%]'
                  )}
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
              )}

              {/* Dark subtle vignette overlay */}
              <div
                className={cn(
                  'absolute inset-0 transition-opacity duration-300',
                  isUnlocked
                    ? 'bg-gradient-to-t from-black/85 via-black/35 to-black/25 group-hover:from-black/75'
                    : 'bg-black/75'
                )}
              />

              {/* Top Row: Step Tag Badge & Status */}
              <div className="relative z-10 flex items-center justify-between p-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white',
                      isUnlocked ? 'bg-purple-500' : 'bg-slate-600'
                    )}
                  >
                    {step.stepNumber}
                  </span>
                  <span>Step {step.stepNumber}</span>
                </span>

                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/95 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </span>
                ) : !isUnlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-slate-700/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 shadow-sm backdrop-blur-md">
                    <Lock className="h-3 w-3 text-slate-400" />
                    Locked
                  </span>
                ) : isSelected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-600/95 border border-purple-400/40 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                    <Sparkles className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/80 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-md">
                    Available
                  </span>
                )}
              </div>

              {/* Center: Signature H5P Branching Scenario Hotspot Button */}
              <div className="relative z-10 flex flex-1 items-center justify-center p-2">
                {isUnlocked ? (
                  <div className="relative flex items-center justify-center">
                    {/* Subtle outer glow ring */}
                    <div className="absolute h-13 w-13 rounded-full bg-purple-500/30 blur-sm transition-all duration-300 group-hover:h-15 group-hover:w-15 group-hover:bg-purple-500/50" />

                    {/* Circular H5P Plus Hotspot */}
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#862577] text-white shadow-lg shadow-black/40 transition-transform duration-300 ease-out group-hover:scale-115 group-hover:bg-[#9d2b8c] group-active:scale-95">
                      <Plus className="h-6 w-6 stroke-[3.2] transition-transform duration-300 group-hover:rotate-90" />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/80 bg-slate-900/90 text-slate-400 shadow-inner">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Bottom: Step Title & Caption Banner */}
              <div className="relative z-10 p-3 pt-0">
                <div
                  className={cn(
                    'rounded-lg border p-2 backdrop-blur-md transition-colors',
                    isUnlocked
                      ? 'border-white/10 bg-black/60 group-hover:bg-black/75'
                      : 'border-slate-800 bg-black/70'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-bold tracking-tight text-white drop-shadow-sm sm:text-base">
                      {step.label}
                    </h3>
                    {isUnlocked ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-purple-300 opacity-70 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-300">
                    {isUnlocked
                      ? step.shortDescription
                      : `Complete Step ${step.stepNumber - 1} to unlock`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
