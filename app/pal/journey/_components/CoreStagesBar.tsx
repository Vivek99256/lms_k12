'use client';

import React from 'react';
import {
  ClipboardCheck,
  ListChecks,
  Compass,
  BookOpen,
  NotebookPen,
  Timer,
  Star,
  Clock,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoreStageSummary, CoreStageKey } from '@/app/pal/journey/data/pal-journey';

const CORE_ICONS: Record<CoreStageKey, React.ComponentType<{ className?: string }>> = {
  diagnostic: ClipboardCheck,
  adaptive: ListChecks,
  plan: Compass,
  learn: BookOpen,
  practice: NotebookPen,
  check: Timer,
  mastery: Star,
};

interface CoreStagesBarProps {
  summaries: CoreStageSummary[];
  activeCoreStage: CoreStageKey | null;
  onSelectCoreStage: (stage: CoreStageKey | null) => void;
}

export function CoreStagesBar({
  summaries,
  activeCoreStage,
  onSelectCoreStage,
}: CoreStagesBarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Core Learning Sequence
          </span>
          <h2 className="text-sm font-semibold text-slate-800">
            7 Canonical Stages of the Student Journey
          </h2>
        </div>
        {activeCoreStage && (
          <button
            type="button"
            onClick={() => onSelectCoreStage(null)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Show All Steps
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {summaries.map((stage) => {
          const Icon = CORE_ICONS[stage.coreStage] || BookOpen;
          const isSelected = activeCoreStage === stage.coreStage;
          const isMastered = stage.status === 'mastered';
          const isCompleted = stage.status === 'completed';
          const isAttention = stage.status === 'attention' || stage.hasStuckPoint;
          const hasMultipleAttempts = stage.stepCount > 1;

          return (
            <button
              key={stage.coreStage}
              type="button"
              onClick={() =>
                onSelectCoreStage(isSelected ? null : stage.coreStage)
              }
              className={cn(
                'group relative flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition-all hover:shadow-md',
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30'
                  : isAttention
                  ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                  : isMastered
                  ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                  : isCompleted
                  ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-900/5">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      isMastered
                        ? 'text-emerald-600'
                        : isAttention
                        ? 'text-rose-600'
                        : isCompleted
                        ? 'text-blue-600'
                        : 'text-slate-500'
                    )}
                  />
                </span>

                {isMastered ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isAttention ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Stuck
                  </span>
                ) : hasMultipleAttempts ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                    <RotateCcw className="h-2.5 w-2.5" />
                    {stage.stepCount}x
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">
                    #{stage.order}
                  </span>
                )}
              </div>

              <div className="mt-2 w-full">
                <p className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                  {stage.label}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5 text-slate-400" />
                    {stage.totalTimeSpentMinutes}m
                  </span>
                  {stage.latestScore != null && (
                    <span className="font-semibold text-slate-700">
                      {stage.latestScore}%
                    </span>
                  )}
                </div>
              </div>

              {stage.revisitsCount > 0 && (
                <div className="mt-1 w-full rounded bg-amber-200/50 px-1 py-0.5 text-[9px] font-semibold text-amber-900">
                  {stage.revisitsCount} {stage.revisitsCount === 1 ? 'revisit' : 'revisits'}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

