'use client';

import React from 'react';
import { Check, Lock, Play, Target } from 'lucide-react';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

interface RoadmapProgressProps {
  concepts: AdaptiveConcept[];
  completedConceptIds: Set<string>;
  chapterName?: string;
}

export function RoadmapProgress({
  concepts,
  completedConceptIds,
}: RoadmapProgressProps) {
  const total = concepts.length;
  const completedCount = concepts.filter((c) =>
    completedConceptIds.has(String(c.conceptId))
  ).length;

  // In sequential learning flow: first uncompleted concept is Available (1), remaining upcoming are Locked
  const firstUncompletedIndex = concepts.findIndex(
    (c) => !completedConceptIds.has(String(c.conceptId))
  );

  const availableCount = firstUncompletedIndex >= 0 ? 1 : 0;
  const lockedCount = Math.max(0, total - completedCount - availableCount);

  const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section: Progress Info & Bar */}
        <div className="min-w-0 flex-1 max-w-sm">
          <span className="text-xs font-semibold text-slate-700 block">
            Concept Diagnostic Progress
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
              {completedCount} of {total} concepts completed
            </span>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={total}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${completedPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
              {completedPct}%
            </span>
          </div>
        </div>

        {/* Middle Section: 3 Status Metrics with ample spacing, guaranteed zero overlap */}
        <div className="flex items-center gap-6 sm:gap-8 border-t lg:border-t-0 lg:border-l lg:border-r border-slate-100 pt-3 lg:pt-0 lg:px-6 shrink-0">
          {/* Completed Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
              <Check className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {completedCount}
              </span>
              <span className="text-[11px] font-medium text-slate-500 leading-tight">Completed</span>
            </div>
          </div>

          {/* Available Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-xs">
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {availableCount}
              </span>
              <span className="text-[11px] font-medium text-slate-500 leading-tight">Available</span>
            </div>
          </div>

          {/* Locked Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 shrink-0">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {lockedCount}
              </span>
              <span className="text-[11px] font-medium text-slate-500 leading-tight">Locked</span>
            </div>
          </div>
        </div>

        {/* Right Section: Complete All Concepts Callout Box */}
        <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3 max-w-[260px] shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100/90 text-rose-600">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              Complete all concepts
            </h4>
            <p className="mt-0.5 text-[10px] text-slate-500 leading-tight line-clamp-2">
              Work through each concept diagnostic to identify strengths and areas for improvement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
