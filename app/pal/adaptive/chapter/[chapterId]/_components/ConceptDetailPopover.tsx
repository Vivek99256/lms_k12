'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Lock, Sparkles, BookOpen, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { BandChip, bandLabel } from '@/app/pal/_components/BandMeter';
import { useConceptImage } from './concept-images';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';
import { cn } from '@/lib/utils';

interface ConceptDetailPopoverProps {
  concept: AdaptiveConcept | null;
  chapterId: string;
  stepNumber: number;
  completed: boolean;
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function ConceptDetailPopover({
  concept,
  chapterId,
  stepNumber,
  completed,
  isOpen,
  onClose,
  onStart,
}: ConceptDetailPopoverProps) {
  if (!concept) return null;

  const attempted = concept.practiceAttempts > 0;
  const { imageUrl } = useConceptImage(concept.conceptId, stepNumber);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white shadow-2xl border-slate-200">
        {/* Header Image with Overlays */}
        <div className="relative h-44 w-full overflow-hidden bg-slate-900">
          <img
            src={imageUrl}
            alt={concept.name}
            className={cn(
              'h-full w-full object-cover transition-transform duration-500 hover:scale-105',
              !concept.servable && 'grayscale opacity-60'
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="rounded-md bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm">
              Step {String(stepNumber).padStart(2, '0')}
            </span>

            {completed ? (
              <span className="flex items-center gap-1 rounded-md bg-emerald-500 text-white px-2.5 py-1 text-xs font-semibold shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
            ) : !concept.servable ? (
              <span className="flex items-center gap-1 rounded-md bg-slate-700/90 text-white px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            ) : (
              concept.nextDifficulty && (
                <BandChip band={concept.nextDifficulty} className="shadow-sm" />
              )
            )}
          </div>

          {/* Bottom Title on Image */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-lg font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
              {concept.name}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Engine Rationale */}
          {concept.rationale && (
            <div className="rounded-xl bg-purple-50/70 border border-purple-100 p-3 text-xs text-purple-900">
              <div className="flex items-center gap-1 font-semibold text-purple-800 mb-0.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                Adaptive Guidance
              </div>
              <p>{concept.rationale}</p>
            </div>
          )}

          {/* Performance Data Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <span className="text-slate-500 font-medium block mb-0.5">Chapter diagnostic</span>
              {concept.diagnosticPercentage !== null ? (
                <span className="text-base font-bold text-slate-900">
                  {Math.round(concept.diagnosticPercentage)}%
                </span>
              ) : (
                <span className="text-slate-400">Not probed</span>
              )}
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <span className="text-slate-500 font-medium block mb-0.5">Concept diagnostic</span>
              {attempted ? (
                <span className="text-base font-bold text-slate-900">
                  {Math.round(concept.practicePercentage)}%
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    ({concept.practiceAttempts} tries)
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">No attempts yet</span>
              )}
            </div>
          </div>

          {/* Question bank availability info */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              {concept.availability.total} question{concept.availability.total === 1 ? '' : 's'} available
              {!concept.conceptExact && ' (chapter pool)'}
            </span>
            {concept.nextDifficulty && (
              <span className="font-medium text-slate-700">
                Opening at {bandLabel(concept.nextDifficulty).toLowerCase()}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2">
            {completed ? (
              <Link
                href={`/pal/mastery/concept/${concept.conceptId}?chapterId=${chapterId}`}
                className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'w-full bg-emerald-600 hover:bg-emerald-700 text-white')}
                onClick={onClose}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                View Mastery Sign-off
              </Link>
            ) : concept.servable ? (
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                onClick={() => {
                  onClose();
                  onStart();
                }}
              >
                {attempted ? 'Take Diagnostic Again' : 'Start Concept Diagnostic'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled variant="outline" className="w-full cursor-not-allowed text-slate-400 bg-slate-50">
                <Lock className="mr-2 h-4 w-4" />
                Locked · Questions in Preparation
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
