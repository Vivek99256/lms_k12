'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  GitBranch,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Lock,
  MapPin,
  NotebookPen,
  PartyPopper,
  Play,
  Repeat,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  milestoneStatusStyle,
  type JourneyData,
  type MilestoneKey,
  type StudentJourneyStep,
} from '@/app/pal/journey/data/pal-journey';
import { JOURNEY_STAGE_BY_KEY, JOURNEY_STAGES } from '@/app/pal/_components/journey-stages';
import {
  calculateAdventureLayout,
  calculateDynamicPathLayout,
  MILESTONE_2D_POSITIONS,
  NODE_RADIUS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  smoothPathD,
  type Point,
} from './path-layout';

const FULLY_MASTERED_HEX = '#10b981';
const REWORK_HEX = '#e11d48';

export interface UnifiedJourneyNode {
  id: string;
  source: 'main' | 'attempt1' | 'attempt2' | 'final';
  stageKey: string;
  label: string;
  subLabel: string;
  timeSpentMinutes: number;
  score?: number | null;
  status: 'completed' | 'attention' | 'mastered' | 'locked' | 'in_progress' | 'available';
  isStuck?: boolean;
  stuckReason?: string | null;
  repeatReason?: string | null;
  facts: string[];
  note?: string;
  x: number;
  y: number;
}

interface PathJourneyViewProps {
  data: JourneyData;
  currentIndex?: number;
  selectedStepNumber?: number | null;
  onSelectStep?: (stepNumber: number) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (node: UnifiedJourneyNode) => void;
  selected?: MilestoneKey | null;
  onSelect?: (key: MilestoneKey) => void;
}

const ADVENTURE_HEIGHT = 480;

function leftPct(point: Point) {
  return (point.x / VIEW_WIDTH) * 100;
}

function topPct(point: Point, height: number) {
  return (point.y / height) * 100;
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass} ring-1 ring-black/10`} />
      {label}
    </span>
  );
}

function PathSpark({ d, hex, dur }: { d: string; hex: string; dur: number }) {
  if (!d) return null;
  return (
    <>
      {[0, dur / 2].map((begin) => (
        <g key={begin}>
          <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} rotate="auto" />
          <circle r={7} fill={hex} opacity={0.35}>
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.3s" repeatCount="indefinite" />
          </circle>
          <circle r={3} fill="#ffffff" />
        </g>
      ))}
    </>
  );
}

function CurrentPositionMarker() {
  return (
    <div role="img" aria-label="You are here — current active step" className="flex flex-col items-center">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_14px_rgba(14,165,233,0.8)] ring-2 ring-white">
          <Play className="h-3.5 w-3.5 text-white fill-white translate-x-0.5 drop-shadow" />
        </span>
      </div>
      <span className="-mt-0.5 h-1.5 w-1.5 rotate-45 rounded-sm bg-blue-500 shadow" />
    </div>
  );
}

export function PathJourneyView({
  data,
  currentIndex,
  selectedStepNumber,
  onSelectStep,
  selectedNodeId,
  onSelectNode,
  selected,
  onSelect,
}: PathJourneyViewProps) {
  const steps = data.actualSteps && data.actualSteps.length > 0 ? data.actualSteps : [];
  const isMastered = data.chapterFullyMastered;

  // Active step index
  const activeIndex =
    typeof currentIndex === 'number'
      ? Math.min(currentIndex, Math.max(0, steps.length - 1))
      : typeof data.currentStepIndex === 'number'
      ? Math.min(data.currentStepIndex, Math.max(0, steps.length - 1))
      : 0;

  const activeStep = steps[activeIndex] ?? steps[0];

  // ── Split into Route 1 (Main journey up to Support) and Route 2 (Attempt 2 from Learn #2) ──
  const learn2Index = steps.findIndex((s, i) => i > 0 && s.coreStage === 'learn' && s.isRevisit);
  const planIndex = steps.findIndex((s) => s.coreStage === 'plan');
  const hasSplit = learn2Index !== -1 && learn2Index > 0;

  // Adventure map multi-track layout
  const points = calculateAdventureLayout(
    steps.length,
    hasSplit,
    learn2Index,
    planIndex,
    VIEW_WIDTH,
    ADVENTURE_HEIGHT
  );

  // Route 1 ends at Support #1 (step right before Learn #2). Absolutely NO line to Learn #2.
  const route1End = hasSplit ? learn2Index : steps.length;
  const route1Points = points.slice(0, route1End);
  const route2Points = hasSplit ? points.slice(learn2Index) : [];

  // Route 1 traveled vs upcoming
  const isPastRoute1 = activeIndex >= route1End;
  const route1ActiveIndex = hasSplit ? Math.min(activeIndex, route1End - 1) : activeIndex;
  const route1TraveledD = smoothPathD(route1Points.slice(0, route1ActiveIndex + 1));
  const route1RemainingD = isPastRoute1 ? '' : smoothPathD(route1Points.slice(route1ActiveIndex));
  const route1FullD = smoothPathD(route1Points);

  // Route 2 traveled vs upcoming
  const isAtRoute2 = activeIndex >= learn2Index;
  const route2ActiveLocalIndex = isAtRoute2 ? activeIndex - learn2Index : 0;
  const route2TraveledD = isAtRoute2 ? smoothPathD(route2Points.slice(0, route2ActiveLocalIndex + 1)) : '';
  const route2RemainingD = route2Points.length > 0 ? smoothPathD(route2Points.slice(isAtRoute2 ? route2ActiveLocalIndex : 0)) : '';
  const route2FullD = smoothPathD(route2Points);

  // Fallback single-path strings if no split
  const traveledPathD = smoothPathD(points.slice(0, activeIndex + 1));
  const remainingPathD = smoothPathD(points.slice(activeIndex));
  const fullPathD = isMastered ? smoothPathD(points) : '';

  // Calculate smooth flowing branch path from Plan on top ridge to Learn #2 in lower valley
  let branchPathD = '';
  let branchMid = { x: 0, y: 0 };

  if (hasSplit && planIndex !== -1 && points[planIndex] && points[learn2Index]) {
    const from = points[planIndex];
    const to = points[learn2Index];

    const cp1x = Math.round(from.x + (to.x - from.x) * 0.25);
    const cp1y = Math.round(from.y + (to.y - from.y) * 0.65);
    const cp2x = Math.round(from.x + (to.x - from.x) * 0.75);
    const cp2y = Math.round(from.y + (to.y - from.y) * 0.35);

    branchPathD = `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    branchMid = {
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
    };
  }

  // HUD stats
  const learnSteps = steps.filter((s) => s.coreStage === 'learn' && s.status !== 'locked');
  const learnAttemptsCount = learnSteps.length;
  const checkRetriesCount = data.teacherInsights?.revisits?.checkCount ?? 0;
  const totalDurationMinutes = data.teacherInsights?.totalDurationMinutes ?? 0;
  const timeOnLearnMinutes = learnSteps.reduce((acc, s) => acc + s.timeSpentMinutes, 0);
  const completedStepsCount = steps.filter((s) => s.status === 'completed' || s.status === 'mastered').length;

  const handleStepClick = (step: StudentJourneyStep, point: Point) => {
    if (onSelectStep) onSelectStep(step.stepNumber);
    if (onSelect) onSelect(step.stageKey);
    if (onSelectNode) {
      onSelectNode({
        id: step.id,
        source: step.attemptNumber > 1 ? 'attempt2' : 'main',
        stageKey: step.stageKey,
        label: step.label,
        subLabel: step.shortLabel,
        timeSpentMinutes: step.timeSpentMinutes,
        score: step.score,
        status: step.status as any,
        isStuck: step.isStuck,
        stuckReason: step.stuckReason,
        repeatReason: step.repeatReason,
        facts: step.facts,
        note: step.progressionNote ?? undefined,
        x: point.x,
        y: point.y,
      });
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-sky-50/95 via-indigo-50/80 to-amber-50/90 p-4 text-slate-800 shadow-xl ring-1 ring-slate-200/80 sm:p-6 backdrop-blur-xl">
      {/* Dreamy Pastel Atmospheric Orbs (Matching Reference) */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-violet-200/35 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />

      {/* ── Visual HUD Header Strip ── */}
      <div className="relative z-10 mb-5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-xs font-black text-slate-900 shadow-sm">
                PAL
              </span>
              <h2 className="text-lg font-bold tracking-tight text-slate-850 sm:text-xl">
                Your Learning Journey
              </h2>
              {isMastered ? (
                <Badge className="bg-emerald-100 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-400/50">
                  Concept Mastered
                </Badge>
              ) : (
                <Badge className="bg-sky-100 text-[11px] font-bold text-sky-800 ring-1 ring-sky-400/50">
                  Currently: {activeStep?.shortLabel ?? 'In Progress'} (
                  {activeStep?.status === 'completed'
                    ? 'Completed'
                    : activeStep?.status === 'available'
                    ? 'Next Up'
                    : 'In Progress'}
                  )
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Personalized concept progression & dynamic reinforcement path
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200/80">
              <Compass className="h-3.5 w-3.5 text-sky-600" />
              Focus: <span className="font-bold text-slate-900">{activeStep?.conceptName || (data as any).conceptName || 'Chapter Mastery'}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200/80">
              <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
              Attempts: <span className="font-bold text-slate-900">{learnAttemptsCount}</span>
            </span>
            {checkRetriesCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-rose-700 shadow-xs ring-1 ring-rose-200">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                Retries: <span className="font-bold text-rose-700">{checkRetriesCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* HUD Quick Stats Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/85 p-3 shadow-xs ring-1 ring-slate-200/80 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Learning Time
            </p>
            <p className="mt-1 flex items-baseline gap-1 text-xl font-black text-slate-850">
              # {totalDurationMinutes}{' '}
              <span className="text-xs font-normal text-slate-500">min</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-3 shadow-xs ring-1 ring-slate-200/80 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Time on Learn
            </p>
            <p className="mt-1 flex items-baseline gap-1 text-xl font-black text-slate-850">
              # {timeOnLearnMinutes}{' '}
              <span className="text-xs font-normal text-slate-500">min</span>
            </p>
          </div>
          <div className="col-span-2 rounded-2xl bg-white/85 p-3 shadow-xs ring-1 ring-slate-200/80 sm:col-span-4 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Total Steps Taken
            </p>
            <p className="mt-1 flex items-baseline gap-1 text-xl font-black text-emerald-600">
              # {completedStepsCount}{' '}
              <span className="text-xs font-normal text-emerald-700/70">vs 7 core</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Panoramic Adventure-Map Visualization ── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-white/60 p-2 shadow-inner ring-1 ring-slate-200/80 backdrop-blur-sm"
        style={{ aspectRatio: `${VIEW_WIDTH} / ${ADVENTURE_HEIGHT}` }}
      >
        {/* Reference-style Floating Realm Callout Badges */}
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-800 shadow-xs border border-emerald-300/60 backdrop-blur-md">
          <span className="text-xs">🔬</span>
          <span>Science Lab • Core Journey</span>
        </div>

        {hasSplit && (
          <div
            className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-800 shadow-xs border border-purple-300/60 backdrop-blur-md"
            style={{
              left: `${((points[planIndex]?.x ?? 300) / VIEW_WIDTH) * 100}%`,
              top: '52%',
            }}
          >
            <span className="text-xs">🔮</span>
            <span>Reinforcement Loop • Attempt 2</span>
          </div>
        )}

        {/* Legend */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-wrap gap-2.5 rounded-full bg-white/90 px-3.5 py-1.5 text-[10px] font-semibold text-slate-700 shadow-xs backdrop-blur-md ring-1 ring-slate-200/80">
          {isMastered ? (
            <LegendDot colorClass="bg-emerald-500" label="Concept Mastered" />
          ) : (
            <>
              <LegendDot colorClass="bg-emerald-500" label="Completed" />
              <LegendDot colorClass="bg-sky-500" label="Current" />
              <LegendDot colorClass="bg-rose-500" label="Stuck / Retry" />
              <LegendDot colorClass="bg-slate-300" label="Upcoming" />
            </>
          )}
        </div>

        {/* SVG Ribbon Paths Layer */}
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${ADVENTURE_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            {/* Route 1 Ribbon Gradient (Cyan to Emerald) */}
            <linearGradient id="route1Gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Branch Ribbon Gradient (Cyan to Purple) */}
            <linearGradient id="branchRibbonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0891b2" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>

            {/* Route 2 Ribbon Gradient (Purple to Amber) */}
            <linearGradient id="route2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            {/* Soft Ambient Glow Filter */}
            <filter id="ribbonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {isMastered ? (
            hasSplit ? (
              <>
                {/* Route 1: Completed Emerald Ribbon */}
                <path d={route1FullD} stroke="#10b981" strokeWidth={10} strokeOpacity={0.25} fill="none" strokeLinecap="round" filter="url(#ribbonGlow)" />
                <path d={route1FullD} stroke="url(#route1Gradient)" strokeWidth={4.5} fill="none" strokeLinecap="round" />
                <PathSpark d={route1FullD} hex="#10b981" dur={5.5} />

                {/* Branch from Plan to Learn #2 */}
                {branchPathD && (
                  <>
                    <path d={branchPathD} stroke="#10b981" strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" fill="none" filter="url(#ribbonGlow)" />
                    <path d={branchPathD} stroke="url(#branchRibbonGradient)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
                    <PathSpark d={branchPathD} hex="#10b981" dur={3.6} />
                  </>
                )}

                {/* Route 2: Completed Emerald Ribbon */}
                <path d={route2FullD} stroke="#10b981" strokeWidth={10} strokeOpacity={0.25} fill="none" strokeLinecap="round" filter="url(#ribbonGlow)" />
                <path d={route2FullD} stroke="url(#route2Gradient)" strokeWidth={4.5} fill="none" strokeLinecap="round" />
                <PathSpark d={route2FullD} hex="#10b981" dur={4.5} />
              </>
            ) : (
              <>
                <path d={fullPathD} stroke="#10b981" strokeWidth={10} strokeOpacity={0.25} fill="none" strokeLinecap="round" filter="url(#ribbonGlow)" />
                <path d={fullPathD} stroke="url(#route1Gradient)" strokeWidth={4.5} fill="none" strokeLinecap="round" />
                <PathSpark d={fullPathD} hex="#10b981" dur={5.5} />
              </>
            )
          ) : hasSplit ? (
            <>
              {/* ── ROUTE 1: Main route up to Support #1 (NO connection to Learn #2) ── */}
              {route1RemainingD && (
                <>
                  <path d={route1RemainingD} stroke="#cbd5e1" strokeWidth={4} strokeDasharray="3 8" strokeLinecap="round" fill="none" />
                  <PathSpark d={route1RemainingD} hex="#94a3b8" dur={4.5} />
                </>
              )}
              {route1TraveledD && (
                <>
                  <path d={route1TraveledD} stroke="url(#route1Gradient)" strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" fill="none" filter="url(#ribbonGlow)" />
                  <path d={route1TraveledD} stroke="url(#route1Gradient)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
                  <path d={route1TraveledD} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="2 10" strokeLinecap="round" fill="none" />
                  <PathSpark d={route1TraveledD} hex="#06b6d4" dur={4.5} />
                </>
              )}

              {/* ── BRANCH: Direct route from Plan to Learn #2 ── */}
              {branchPathD && (
                <g>
                  <path d={branchPathD} stroke="url(#branchRibbonGradient)" strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" fill="none" filter="url(#ribbonGlow)" />
                  <path d={branchPathD} stroke="url(#branchRibbonGradient)" strokeWidth={4} strokeLinecap="round" fill="none" />
                  <path d={branchPathD} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" fill="none" />
                  <PathSpark d={branchPathD} hex="#8b5cf6" dur={3.2} />
                </g>
              )}

              {/* ── ROUTE 2: Repeated learning journey (Learn #2 -> Practice #2 -> Check #2 -> Mastery) ── */}
              {route2RemainingD && (
                <>
                  <path d={route2RemainingD} stroke="#cbd5e1" strokeWidth={4} strokeDasharray="3 8" strokeLinecap="round" fill="none" />
                  <PathSpark d={route2RemainingD} hex="#94a3b8" dur={4.5} />
                </>
              )}
              {route2TraveledD && (
                <>
                  <path d={route2TraveledD} stroke="url(#route2Gradient)" strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" fill="none" filter="url(#ribbonGlow)" />
                  <path d={route2TraveledD} stroke="url(#route2Gradient)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
                  <path d={route2TraveledD} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="2 10" strokeLinecap="round" fill="none" />
                  <PathSpark d={route2TraveledD} hex="#f59e0b" dur={4.5} />
                </>
              )}
            </>
          ) : (
            <>
              {/* Single continuous undulating path when no retry split exists */}
              <path d={remainingPathD} stroke="#cbd5e1" strokeWidth={4} strokeDasharray="3 8" strokeLinecap="round" fill="none" />
              <PathSpark d={remainingPathD} hex="#94a3b8" dur={4.5} />

              <path d={traveledPathD} stroke="url(#route1Gradient)" strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" fill="none" filter="url(#ribbonGlow)" />
              <path d={traveledPathD} stroke="url(#route1Gradient)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
              <PathSpark d={traveledPathD} hex="#06b6d4" dur={4.5} />
            </>
          )}

          {/* Node SVG circles background with 3D soft bevel rings */}
          {steps.map((step, index) => {
            const point = points[index];
            if (!point) return null;

            const isCurrent = index === activeIndex;
            const status = step.status;
            const isDone = status === 'completed' || status === 'mastered';
            const isStuck = Boolean(step.isStuck);
            const isMastery = step.coreStage === 'mastery' && status === 'mastered';
            const isLocked = status === 'locked';

            const nodeFill = isMastery
              ? '#f59e0b'
              : isDone
              ? '#10b981'
              : isCurrent
              ? '#0284c7'
              : isStuck
              ? '#e11d48'
              : isLocked
              ? '#f1f5f9'
              : '#0ea5e9';

            return (
              <g
                key={step.id || index}
                className="node-pop-in"
                style={{ animationDelay: `${index * 35}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                {/* Outer pulsing ring for active playable node */}
                {isCurrent && (
                  <circle cx={point.x} cy={point.y} r={NODE_RADIUS + 6} fill="none" stroke="#0284c7" strokeWidth={3} opacity={0.6}>
                    <animate
                      attributeName="r"
                      values={`${NODE_RADIUS + 6};${NODE_RADIUS + 16};${NODE_RADIUS + 6}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Soft drop shadow behind circle */}
                <circle
                  cx={point.x}
                  cy={point.y + 2}
                  r={NODE_RADIUS + 1}
                  fill="#000000"
                  opacity={0.08}
                />

                {/* Main colorful node circle */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isCurrent ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={nodeFill}
                  stroke="#ffffff"
                  strokeWidth={isCurrent ? 4 : 3.5}
                  style={{ transition: 'r 0.3s ease, stroke-width 0.3s ease' }}
                />
              </g>
            );
          })}
        </svg>

        {/* Interactive DOM Layer: Clickable Buttons, Badges, Labels */}
        <div className="pointer-events-none absolute inset-0">
          {/* Floating Branch Callout Badge */}
          {hasSplit && branchMid.x > 0 && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[9px] font-bold text-purple-800 shadow-md ring-1 ring-purple-300 backdrop-blur-md"
              style={{
                left: `${(branchMid.x / VIEW_WIDTH) * 100}%`,
                top: `${(branchMid.y / ADVENTURE_HEIGHT) * 100}%`,
              }}
            >
              <GitBranch className="h-3 w-3 text-purple-600" />
              <span>Branch: Learn Attempt 2</span>
            </div>
          )}

          {steps.map((step, index) => {
            const point = points[index];
            if (!point) return null;

            const isCurrent = index === activeIndex;
            const status = step.status;
            const isDone = status === 'completed' || status === 'mastered';
            const isLocked = status === 'locked';
            const isMastery = step.coreStage === 'mastery' && status === 'mastered';

            const stepNumber = step.stepNumber;
            const stageKey = step.stageKey;

            const isSelected =
              selectedStepNumber != null
                ? selectedStepNumber === stepNumber
                : selectedNodeId === step.id || selected === stageKey;

            const isStuck = Boolean(step.isStuck);
            const isRevisit = Boolean(step.isRevisit);
            const timeSpent = step.timeSpentMinutes;
            const shortLabel = step.shortLabel;

            const left = leftPct(point);
            const top = topPct(point, ADVENTURE_HEIGHT);

            return (
              <div key={step.id || index} className="node-fade-in" style={{ animationDelay: `${index * 35}ms` }}>
                {/* Clickable node button with Reference-style Play / Check / Lock Icon */}
                <button
                  type="button"
                  onClick={() => handleStepClick(step, point)}
                  aria-label={step.label}
                  className={cn(
                    'pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white transition-all hover:scale-115 focus:outline-none',
                    isSelected ? 'scale-115 ring-3 ring-amber-400 shadow-xl' : ''
                  )}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${NODE_RADIUS * 2}px`,
                    height: `${NODE_RADIUS * 2}px`,
                  }}
                >
                  {isDone ? (
                    <Check className="h-4.5 w-4.5 stroke-[3.5] text-white drop-shadow-sm" />
                  ) : isCurrent ? (
                    <Play className="h-4.5 w-4.5 fill-white text-white translate-x-0.5 drop-shadow-sm" />
                  ) : isStuck ? (
                    <AlertTriangle className="h-4 w-4 text-white drop-shadow-sm" />
                  ) : isLocked ? (
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  ) : isMastery ? (
                    <Trophy className="h-4.5 w-4.5 fill-white text-white drop-shadow-sm" />
                  ) : (
                    <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                  )}
                </button>

                {/* Top-left Step Number Badge */}
                <div
                  className="pointer-events-none absolute flex h-4.5 w-4.5 -translate-x-full -translate-y-full items-center justify-center rounded-full bg-white text-[8.5px] font-black text-slate-800 shadow ring-1 ring-slate-200"
                  style={{ left: `calc(${left}% - 12px)`, top: `calc(${top}% - 10px)` }}
                >
                  {stepNumber}
                </div>

                {/* Status indicator badge (Revisit / Stuck) */}
                {isStuck ? (
                  <div
                    className="pointer-events-none absolute flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white bg-rose-600 shadow"
                    style={{ left: `calc(${left}% + 13px)`, top: `calc(${top}% - 10px)` }}
                    title="Stuck Point"
                  >
                    <AlertTriangle className="h-2.5 w-2.5 text-white" />
                  </div>
                ) : isRevisit ? (
                  <div
                    className="pointer-events-none absolute flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white bg-purple-600 shadow"
                    style={{ left: `calc(${left}% + 13px)`, top: `calc(${top}% - 10px)` }}
                    title="Revisit Attempt"
                  >
                    <RotateCcw className="h-2 w-2 text-white" />
                  </div>
                ) : null}

                {/* Current Active Step Position Marker ("You are here") */}
                {isCurrent && (
                  <div
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                    style={{ left: `${left}%`, top: `calc(${top}% - 22px)` }}
                  >
                    <div className="animate-bounce">
                      <CurrentPositionMarker />
                    </div>
                  </div>
                )}

                {/* Step Short Label & Time Pill Underneath (Matching Reference White Pill Badges) */}
                <div
                  className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
                  style={{ left: `${left}%`, top: `calc(${top}% + 20px)` }}
                >
                  <span
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-0.5 text-[8.5px] font-extrabold shadow-sm border',
                      isMastery
                        ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200'
                        : isDone
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-100'
                        : isCurrent
                        ? 'bg-sky-600 text-white border-sky-700 shadow-sky-100 ring-2 ring-sky-300'
                        : isStuck
                        ? 'bg-rose-600 text-white border-rose-700 shadow-rose-100'
                        : 'bg-white text-slate-700 border-slate-200/90 shadow-slate-100'
                    )}
                  >
                    {shortLabel}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-0.2 text-[7.5px] font-semibold text-slate-500 shadow-xs border border-slate-200/60">
                    {timeSpent}m{step.score != null ? ` • ${step.score}%` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .node-pop-in {
          animation: nodePopIn 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .node-fade-in {
          animation: nodeFadeIn 420ms ease both;
        }
        @keyframes nodePopIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes nodeFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .node-pop-in,
          .node-fade-in {
            animation: none;
          }
        }
      ` }} />
    </div>
  );
}
