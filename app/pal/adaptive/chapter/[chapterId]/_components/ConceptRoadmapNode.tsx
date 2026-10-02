'use client';

import React from 'react';
import { Check, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConceptImage } from './concept-images';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

interface ConceptRoadmapNodeProps {
  concept: AdaptiveConcept;
  index: number;
  status: 'completed' | 'available' | 'locked';
  isSelected?: boolean;
  onSelect: () => void;
}

export function ConceptRoadmapNode({
  concept,
  index,
  status,
  isSelected,
  onSelect,
}: ConceptRoadmapNodeProps) {
  const stepNumber = index + 1;
  const attempted = concept.practiceAttempts > 0;
  const isCompleted = status === 'completed';
  const isAvailable = status === 'available';
  const isLocked = status === 'locked';

  const { imageUrl } = useConceptImage(concept.conceptId, index);

  return (
    <button
      type="button"
      onClick={onSelect}
      id={`concept-node-${concept.conceptId}`}
      data-concept-id={concept.conceptId}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-2 text-left transition-all duration-200 select-none',
        'w-[124px] sm:w-[134px] min-h-[142px]',
        // Available / Selected active state
        (isSelected || isAvailable) &&
          'border-2 border-purple-600 ring-4 ring-purple-100 shadow-md shadow-purple-100 z-20 scale-[1.02]',
        // Completed state (not selected)
        !isSelected &&
          isCompleted &&
          'border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5',
        // Locked state
        isLocked &&
          !isSelected &&
          'border border-slate-200/80 bg-white hover:border-slate-300'
      )}
    >
      {/* Top Header Row: Step Number Circle & Status Badge */}
      <div className="flex items-center justify-between gap-1 w-full">
        {/* Step Number Circle */}
        {isCompleted ? (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
            {stepNumber}
          </div>
        ) : isAvailable ? (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold shadow-xs">
            {stepNumber}
          </div>
        ) : (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
            {stepNumber}
          </div>
        )}

        {/* Status Pill */}
        {isCompleted ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
            <Check className="h-2.5 w-2.5 stroke-[2.5]" />
            Completed
          </span>
        ) : isAvailable ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-xs">
            <Play className="h-2 w-2 fill-current" />
            Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
            <Lock className="h-2.5 w-2.5" />
            Locked
          </span>
        )}
      </div>

      {/* Middle: Compact Concept Image */}
      <div className="my-1.5 h-12 w-full overflow-hidden rounded-lg bg-slate-100 shadow-inner">
        <img
          src={imageUrl}
          alt={concept.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Bottom: Concept Name & Performance Subtitle */}
      <div className="w-full text-center">
        <h4
          className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2 min-h-[1.75rem]"
          title={concept.name}
        >
          {concept.name}
        </h4>

        <div className="mt-0.5 text-[10px] leading-none min-h-[0.75rem]">
          {isCompleted ? (
            <span className="font-semibold text-emerald-700">
              {concept.diagnosticPercentage !== null
                ? `${Math.round(concept.diagnosticPercentage)}%`
                : '100%'}
              {' · '}
              {concept.availability.total} questions
            </span>
          ) : isAvailable && attempted ? (
            <span className="font-semibold text-purple-700">
              {Math.round(concept.practicePercentage)}% · {concept.practiceAttempts} questions
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
