'use client';

import { ArrowRight, FlaskConical } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { ApplicationLabPanel } from './ApplicationLabPanel';
import type { JourneyStepId } from './H5PJourneyCollage';

/**
 * Step 10 of the journey: the Application Lab.
 *
 * The student gets ONE personalised practical activity built from their own
 * learning journey (see ApplicationLabPanel). The chapter's Prayogshala
 * experiments are no longer listed here.
 */
export interface ExperimentStepViewProps {
  chapterId: string;
  chapterName: string;
  onStepComplete?: (stepId: JourneyStepId) => void;
  onNextStep?: (nextStepId: JourneyStepId) => void;
}

export function ExperimentStepView({
  chapterId,
  chapterName,
  onStepComplete,
  onNextStep,
}: ExperimentStepViewProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Application Lab</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {chapterName} — use what you have learned in a real activity.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm">
            <FlaskConical className="h-3.5 w-3.5 text-sky-600" />
            Practical
          </span>
        </div>
      </div>

      <ApplicationLabPanel chapterId={chapterId} chapterName={chapterName} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
        <div>
          <p className="text-xs font-bold text-sky-950">Finished your activity?</p>
          <p className="mt-0.5 text-xs text-sky-900">
            Move on to Step 12 to lock it in with Spaced Recall.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
          onClick={() => {
            onStepComplete?.('experiment');
            onNextStep?.('recall');
          }}
        >
          <span>Continue to Step 12: Spaced Recall</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
