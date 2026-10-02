'use client';

import React from 'react';
import { ArrowRight, BarChart2, CheckCircle2, Lock, Play, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConceptImage } from './concept-images';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';
import { cn } from '@/lib/utils';

interface ConceptDetailSidebarProps {
  concept: AdaptiveConcept | null;
  stepNumber: number;
  chapterId: string;
  completed: boolean;
  onClose?: () => void;
}

export function ConceptDetailSidebar({
  concept,
  stepNumber,
  chapterId,
  completed,
  onClose,
}: ConceptDetailSidebarProps) {
  const router = useRouter();

  if (!concept) return null;

  const attempted = concept.practiceAttempts > 0;
  const isAvailable = concept.servable;
  const { imageUrl } = useConceptImage(concept.conceptId, stepNumber);

  const handleStart = () => {
    if (completed) {
      router.push(`/pal/mastery/concept/${concept.conceptId}?chapterId=${chapterId}`);
    } else if (isAvailable) {
      router.push(`/pal/adaptive/concept/${concept.conceptId}`);
    }
  };

  return (
    <div className="sticky top-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
      {/* Top row: Step number circle, status badge, and optional close */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {completed ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">
              {stepNumber}
            </div>
          ) : isAvailable ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold shadow-sm">
              {stepNumber}
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              {stepNumber}
            </div>
          )}

          {completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </span>
          ) : isAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
              <Play className="h-2.5 w-2.5 fill-current" />
              Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-500">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Concept Image */}
      <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
        <img
          src={imageUrl}
          alt={concept.name}
          className={cn(
            'h-full w-full object-cover transition-transform duration-300 hover:scale-105',
            !concept.servable && 'grayscale opacity-60'
          )}
        />
      </div>

      {/* Concept Title */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 leading-snug">
          {concept.name}
        </h3>
      </div>

      {/* Badges: Difficulty & Questions Available */}
      <div className="flex flex-wrap items-center gap-2">
        {concept.nextDifficulty && (
          <span
            className={cn(
              'rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider',
              concept.nextDifficulty === 'hard' && 'bg-rose-50 text-rose-600 border border-rose-200',
              concept.nextDifficulty === 'medium' && 'bg-amber-50 text-amber-700 border border-amber-200',
              concept.nextDifficulty === 'easy' && 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            )}
          >
            {concept.nextDifficulty}
          </span>
        )}

        <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-0.5 text-xs font-medium text-purple-700">
          {concept.availability.total} questions available
        </span>
      </div>

      {/* Performance Metric Box */}
      <div className="rounded-2xl bg-purple-50/40 border border-purple-100/80 p-3.5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
          <BarChart2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-slate-500 block">Your performance</span>
          <span className="text-xs font-bold text-slate-900 block truncate">
            {attempted
              ? `${Math.round(concept.practicePercentage)}% correct · ${concept.practiceAttempts} questions`
              : concept.diagnosticPercentage !== null
              ? `${Math.round(concept.diagnosticPercentage)}% on diagnostic`
              : 'Not attempted yet'}
          </span>
        </div>
      </div>

      {/* Status Box */}
      <div className="rounded-2xl bg-purple-50/40 border border-purple-100/80 p-3.5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
          <Play className="h-4 w-4 fill-current ml-0.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-slate-500 block">Status</span>
          <span className="text-xs font-bold text-slate-900 block">
            {completed
              ? 'Concept Mastered'
              : isAvailable
              ? 'Ready to attempt'
              : 'Questions in preparation'}
          </span>
        </div>
      </div>

      {/* About this concept */}
      <div className="space-y-1 pt-1">
        <h4 className="text-xs font-bold text-slate-900">About this concept</h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {concept.rationale ||
            `Master key principles and diagnostic assessment drills for ${concept.name}.`}
        </p>
      </div>

      {/* Big Action CTA */}
      <div className="pt-2">
        {completed ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition-colors hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>View Concept Mastery</span>
          </button>
        ) : isAvailable ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-purple-200 transition-colors hover:bg-purple-700"
          >
            <span>{attempted ? 'Take Diagnostic Again' : 'Start Concept Diagnostic'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
          >
            <Lock className="h-4 w-4" />
            <span>Questions in Preparation</span>
          </button>
        )}
      </div>
    </div>
  );
}
