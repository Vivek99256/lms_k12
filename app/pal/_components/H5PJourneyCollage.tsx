'use client';

import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Check,
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
  Timer,
  Trophy,
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
    gridClass: 'w-full',
  },
  {
    id: 'adaptive',
    stepNumber: 2,
    label: 'Concept Diagnostic',
    shortDescription: 'Concept-Level Drill',
    detail: 'Targeted drills per concept to identify precise strengths and gaps.',
    icon: Layers,
    gridClass: 'w-full',
  },
  {
    id: 'plan',
    stepNumber: 3,
    label: 'Learning Plan',
    shortDescription: 'Personalized Roadmap',
    detail: 'Curated step-by-step curriculum ordered from weakest to strongest.',
    icon: Compass,
    gridClass: 'w-full',
  },
  {
    id: 'learn',
    stepNumber: 4,
    label: 'Learn Concepts',
    shortDescription: 'Theory & Lessons',
    detail: 'Deep dive lessons, video explainers, and key theory before practicing.',
    icon: BookOpen,
    gridClass: 'w-full',
  },
  {
    id: 'practice',
    stepNumber: 5,
    label: 'Adaptive Practice',
    shortDescription: 'Interactive Drills',
    detail: 'Smart question sets that adapt to your performance with instant review.',
    icon: GraduationCap,
    gridClass: 'w-full',
  },
  {
    id: 'feedback',
    stepNumber: 6,
    label: 'Feedback & Review',
    shortDescription: 'Performance Analysis',
    detail: 'Detailed breakdown of what went well and what concepts to revisit.',
    icon: MessageSquareText,
    gridClass: 'w-full',
  },
  {
    id: 'check',
    stepNumber: 7,
    label: 'Understanding Check',
    shortDescription: 'Timed Assessment',
    detail: 'Understanding assessment determining if you have cleared this concept.',
    icon: Timer,
    gridClass: 'w-full',
  },
  {
    id: 'intervention',
    stepNumber: 8,
    label: 'Extra Support',
    shortDescription: 'Teacher Guidance',
    detail: 'Targeted scaffolding and teacher-assisted support when extra help is needed.',
    icon: Lightbulb,
    gridClass: 'w-full',
  },
  {
    id: 'mastery',
    stepNumber: 9,
    label: 'Concept Mastery',
    shortDescription: 'Milestone Achievement',
    detail: 'Official sign-off and recognition of mastery across the curriculum.',
    icon: Trophy,
    gridClass: 'w-full',
  },
  {
    id: 'recall',
    stepNumber: 10,
    label: 'Spaced Recall',
    shortDescription: 'Memory Retention',
    detail: 'Scheduled refresher practice to ensure lasting retention and retrieval.',
    icon: Repeat,
    gridClass: 'w-full',
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

  // Mastery (Step 9) is unlocked if Check (Step 7) or Extra Support (Step 8) is completed
  if (stepId === 'mastery') {
    return completedSet.has('check') || completedSet.has('intervention');
  }

  // Recall (Step 10) is unlocked if Mastery (Step 9) is completed
  if (stepId === 'recall') {
    return completedSet.has('mastery');
  }

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

/**
 * 4-column interlocking mosaic layout (12 columns x 12 rows).
 * Matches the reference collage diagram:
 *
 * Col 1: Step 1 (height 6), Step 2 (height 6)
 * Col 2: Step 3 (height 8, tall portrait), Step 4 (height 4)
 * Col 3: Step 5 (height 7, tall portrait), Step 6 (height 3), Step 7 (height 2)
 * Col 4: Step 8 (height 4), Step 9 (height 5, mastery hero), Step 10 (height 3)
 */
const DESKTOP_MOSAIC_AREAS: Record<JourneyStepId, { gridColumn: string; gridRow: string }> = {
  diagnostic: { gridColumn: '1 / 4', gridRow: '1 / 7' },
  adaptive: { gridColumn: '1 / 4', gridRow: '7 / 13' },
  plan: { gridColumn: '4 / 7', gridRow: '1 / 9' },
  learn: { gridColumn: '4 / 7', gridRow: '9 / 13' },
  practice: { gridColumn: '7 / 10', gridRow: '1 / 8' },
  feedback: { gridColumn: '7 / 10', gridRow: '8 / 11' },
  check: { gridColumn: '7 / 10', gridRow: '11 / 13' },
  intervention: { gridColumn: '10 / 13', gridRow: '1 / 5' },
  mastery: { gridColumn: '10 / 13', gridRow: '5 / 10' },
  recall: { gridColumn: '10 / 13', gridRow: '10 / 13' },
};

/**
 * 2-column mobile mosaic layout (12 columns x 12 rows).
 * Col 1: Steps 1, 3, 5, 7, 9
 * Col 2: Steps 2, 4, 6, 8, 10
 */
const MOBILE_MOSAIC_AREAS: Record<JourneyStepId, { gridColumn: string; gridRow: string }> = {
  diagnostic: { gridColumn: '1 / 7', gridRow: '1 / 3' },
  adaptive: { gridColumn: '7 / 13', gridRow: '1 / 4' },
  plan: { gridColumn: '1 / 7', gridRow: '3 / 6' },
  learn: { gridColumn: '7 / 13', gridRow: '4 / 6' },
  practice: { gridColumn: '1 / 7', gridRow: '6 / 8' },
  feedback: { gridColumn: '7 / 13', gridRow: '6 / 8' },
  check: { gridColumn: '1 / 7', gridRow: '8 / 10' },
  intervention: { gridColumn: '7 / 13', gridRow: '8 / 10' },
  mastery: { gridColumn: '1 / 7', gridRow: '10 / 13' },
  recall: { gridColumn: '7 / 13', gridRow: '10 / 13' },
};

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
  const [isDesktop, setIsDesktop] = useState(true);

  // Responsive screen-size tracking for mosaic grid
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync prop images if provided
  useEffect(() => {
    if (propImages && Object.keys(propImages).length > 0) {
      setImages(propImages);
      setLoading(false);
    }
  }, [propImages]);

  // Fetch dynamic images from API
  useEffect(() => {
    if (propImages && Object.keys(propImages).length > 0) return;

    let isCancelled = false;
    const cacheKey = `pal_journey_images_${subjectName}_${chapterName}`.toLowerCase().replace(/\s+/g, '_');

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

  const completedCount = completedSteps ? completedSteps.size : 0;
  const progressPercent = Math.round((completedCount / JOURNEY_STEPS.length) * 100);

  return (
    <section
      aria-label="Your Journey - Interactive Image Collage Mosaic"
      className={cn(
        'relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-5 lg:p-6 text-slate-900 shadow-sm transition-all',
        className
      )}
    >
      {/* Light Header Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-purple-800 border border-purple-200/80">
              <Sparkles className="h-3 w-3 text-purple-600" />
              Your Journey
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-700">{subjectName}</span>
            <span className="text-slate-400">›</span>
            <span className="text-xs font-bold text-slate-900">{chapterName}</span>
          </div>
          <p className="text-xs text-slate-500">
            Interactive visual learning journey. Click the <span className="font-semibold text-purple-700">+</span> on any unlocked stage image to begin or advance.
          </p>
        </div>

        {/* Progress summary & Status Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <span className="font-medium text-slate-500">Progress:</span>
            <span className="font-bold text-slate-800">
              {completedCount} / 10 stages ({progressPercent}%)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold">✓</span>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#862577] text-white text-[10px] font-bold">+</span>
              <span className="font-medium text-purple-900">Available</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* ONE LARGE IMAGE COLLAGE / MOSAIC FRAME */}
      <div
        className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-100 p-1 sm:p-1.5 shadow-inner"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(12, minmax(0, 1fr))',
          gap: isDesktop ? '6px' : '4px',
          height: isDesktop ? '640px' : '560px',
        }}
      >
        {JOURNEY_STEPS.map((step) => {
          const imageInfo = getStageImage(images, step.id);
          const hasImage = Boolean(imageInfo?.url);
          const isSelected = activeStep === step.id;
          const isUnlocked = isStepUnlocked(step.id, completedSteps);
          const isCompleted = completedSteps?.has(step.id);
          const gridArea = isDesktop ? DESKTOP_MOSAIC_AREAS[step.id] : MOBILE_MOSAIC_AREAS[step.id];

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
              style={{
                gridColumn: gridArea.gridColumn,
                gridRow: gridArea.gridRow,
              }}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-lg transition-all duration-300 focus-visible:outline-none',
                isUnlocked
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed'
              )}
            >
              {/* Full Tile Dynamic Image (Touches adjacent tiles, NO cards) */}
              {loading && !hasImage ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-200 animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : hasImage ? (
                <img
                  src={imageInfo.url}
                  alt={`${step.label} visual representation`}
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out',
                    isUnlocked && 'group-hover:scale-106 group-hover:brightness-105'
                  )}
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-50 to-slate-100 flex items-center justify-center">
                  <step.icon className="h-10 w-10 text-indigo-300" />
                </div>
              )}

              {/* Top-Right Status Pill (Small, light glass pill on image) */}
              <div className="relative z-10 flex items-center justify-between p-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-xs border border-white/80 backdrop-blur-sm">
                  Step {step.stepNumber}
                </span>

                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-sm">
                    <Check className="h-3 w-3 stroke-[3]" />
                    <span className="hidden sm:inline">Completed</span>
                  </span>
                ) : isSelected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-sm animate-pulse">
                    <Sparkles className="h-3 w-3" />
                    <span className="hidden sm:inline">Active</span>
                  </span>
                ) : !isUnlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/95 border border-slate-200/90 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-xs backdrop-blur-sm">
                    <Lock className="h-3 w-3 text-slate-500" />
                    <span>Locked</span>
                  </span>
                ) : null}
              </div>

              {/* Center: Signature Circular Hotspot Button (+ Button) */}
              <div className="relative z-10 flex flex-1 items-center justify-center pointer-events-none p-2">
                {isUnlocked ? (
                  <div className="relative pointer-events-auto">
                    {/* Outer subtle glow */}
                    <div className="absolute -inset-2 rounded-full bg-purple-500/25 blur-xs transition-all duration-300 group-hover:bg-purple-500/40 group-hover:scale-115" />

                    {/* Circular Hotspot Button with Plus */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                      }}
                      className={cn(
                        'relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full',
                        'border-2 border-white bg-[#862577] text-white shadow-xl shadow-black/40',
                        'transition-transform duration-300 ease-out group-hover:scale-115 group-hover:bg-[#9d2b8c] active:scale-95',
                        isCompleted && 'bg-emerald-600 group-hover:bg-emerald-500',
                        isSelected && 'ring-4 ring-purple-300/60 animate-pulse'
                      )}
                      aria-label={`Open Step ${step.stepNumber}: ${step.label}`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3.2]" />
                      ) : (
                        <Plus className="h-6 w-6 sm:h-7 sm:w-7 stroke-[3.2] transition-transform duration-300 group-hover:rotate-90" />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Bottom: Floating Light Information Capsule (NO black overlay) */}
              <div className="relative z-10 p-2 pt-0 pointer-events-none">
                <div className="rounded-lg bg-white/92 px-2.5 py-1.5 shadow-sm border border-white/80 backdrop-blur-md transition-all duration-300 group-hover:bg-white">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      {step.label}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-500 font-medium hidden sm:inline">
                      {step.shortDescription}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
