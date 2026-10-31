'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, PartyPopper } from 'lucide-react';
import {
  fetchJourneyData,
  currentMilestoneIndex,
  type JourneyData,
  type MilestoneKey,
} from '@/app/pal/journey/data/pal-journey';
import { PathJourneyView } from './path/PathJourneyView';
import { MilestoneDetailPanel } from './MilestoneDetailPanel';
import { EmptyChapterState } from './EmptyChapterState';
import { JourneyErrorState } from './JourneyErrorState';
import { KnowledgeGraphPanel } from './KnowledgeGraphPanel';
import { ChapterCompleteCelebration } from './ChapterCompleteCelebration';

/**
 * Who this render of the journey is for.
 *
 * `mode: 'self'` (the default) is a student looking at their own chapter.
 * `{mode:'monitor', studentId, readOnly:true}` is a teacher watching one
 * student's chapter — `studentId` is forwarded to `fetchJourneyData` as
 * `asStudentId`, which the backend already scopes to "student=self,
 * staff=teacher-of-student" (see `pal-journey.ts`'s file header).
 */
export interface JourneyViewContext {
  mode: 'self' | 'monitor';
  studentId?: string;
  readOnly?: boolean;
}

export interface MountainJourneyViewProps {
  chapterId: string;
  viewContext?: JourneyViewContext;
}

const DEFAULT_VIEW_CONTEXT: JourneyViewContext = { mode: 'self' };

/**
 * The orchestrator: fetches the whole chapter's journey once, computes
 * nothing itself (every verdict already arrived decided from
 * `fetchJourneyData`), and renders the 12-step winding road plus whichever
 * milestone is selected.
 *
 * `only one chapter/concept system-wide has full data today` — Chapter 1014 /
 * Concept 114 — so Step 1 rendering live with most of the rest gray is the
 * expected result for almost every `chapterId` this page is opened with, not
 * a bug to chase.
 */
export function MountainJourneyView({ chapterId, viewContext = DEFAULT_VIEW_CONTEXT }: MountainJourneyViewProps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MilestoneKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [kgMilestone, setKgMilestone] = useState<JourneyData['milestones'][number] | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  // Which concept the map/detail panel are focused on — null keeps the
  // backend's own default (the first ESO-ready concept). Set when a learner
  // picks a different concept out of the Concept Diagnostic drawer
  // (`ConceptDiagnosticPanel`, via `MilestoneDetailPanel`), so the 12-stage
  // map re-renders around THAT concept's own real stages instead of staying
  // stuck on whichever one the backend happened to pick first.
  const [focusConceptOverride, setFocusConceptOverride] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  // Scrolls the map back into view when a concept is picked from the drawer
  // below it — otherwise "the map updates" is invisible if the drawer was
  // opened from partway down the page, which is the normal case since the
  // drawer lives inside the detail panel under the map. Skipped on mount
  // (`mountedRef`): this only reacts to an actual concept switch, not the
  // page's own first load.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusConceptOverride]);

  // Fires the chapter-complete celebration once per chapter, not on every
  // revisit — gated on localStorage rather than a backend flag, since
  // "has this learner already seen the confetti" isn't evidence PAL needs
  // to persist server-side. Lives alongside the other hooks (before the
  // loading/error/empty early returns below) because hooks can't be called
  // conditionally; it reads `data` defensively since this runs before those
  // guards establish it's non-null.
  useEffect(() => {
    if (!data) return;
    const required = data.milestones.filter((entry) => !entry.untracked);
    const allRequiredDone =
      required.length > 0 && required.every((entry) => entry.status === 'completed' || entry.status === 'mastered');
    // Both conditions, not just the first: a learner can finish this one
    // concept's own 12 stages while other concepts in the chapter are still
    // untouched — `allRequiredDone` alone celebrated that too early. Gating
    // on `chapterFullyMastered` too is what makes this "once ALL concepts
    // are mastered", not "once this one concept's journey is done".
    if (!allRequiredDone || !data.chapterFullyMastered) return;

    const storageKey = `pal_journey_celebrated_${data.chapterId}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, '1');
    } catch {
      // Private browsing / storage disabled — worst case the celebration
      // plays again on the next visit instead of staying silent. Not worth
      // blocking the celebration over.
    }
    setShowCelebration(true);
  }, [data]);

  useEffect(() => {
    const controller = new AbortController();

    // Deferred - the convention across app/pal, and what
    // react-hooks/set-state-in-effect enforces.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      fetchJourneyData(chapterId, controller.signal, viewContext.studentId, focusConceptOverride)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);
          setSelected((current) => current ?? result.milestones[0]?.key ?? null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Couldn’t load this journey.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId, attempt, viewContext.studentId, focusConceptOverride]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <Loader2 aria-hidden className="mr-2 h-5 w-5 animate-spin" />
        Loading your journey…
      </div>
    );
  }

  if (error) {
    return <JourneyErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  if (!data || !data.hasAnyActivity) {
    return <EmptyChapterState chapterName={data?.chapterName} />;
  }

  const activeMilestone = data.milestones.find((entry) => entry.key === selected) ?? data.milestones[0];
  const readOnly = viewContext.readOnly ?? viewContext.mode === 'monitor';

  // The learner's actual furthest real progress — not whichever milestone
  // happens to be selected for the detail panel. This is what the "Current"
  // tag marks. See currentMilestoneIndex()'s own docblock for why this is a
  // shared function, not a loop duplicated per view.
  const currentIndex = currentMilestoneIndex(data);

  // Required = every milestone except the two with no per-student tracking
  // at all (explanation_lab/experiment — see pal-journey.ts's file header).
  // "Completed vs required" would be meaningless if it counted steps the
  // backend can never mark done.
  const requiredMilestones = data.milestones.filter((entry) => !entry.untracked);
  const completedCount = requiredMilestones.filter(
    (entry) => entry.status === 'completed' || entry.status === 'mastered'
  ).length;
  const isChapterComplete = requiredMilestones.length > 0 && completedCount === requiredMilestones.length;
  const masteryEntry = data.milestones.find((entry) => entry.key === 'mastery');
  const masteryLabel =
    masteryEntry?.status === 'mastered'
      ? 'Mastered'
      : masteryEntry?.status === 'in_progress'
        ? 'In progress'
        : masteryEntry?.status === 'attention'
          ? 'Needs attention'
          : 'Not yet';
  const nextMilestone = data.milestones.find(
    (entry) => entry.status === 'available' || entry.status === 'in_progress' || entry.status === 'attention'
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Learning Path</p>
              {isChapterComplete && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                  <PartyPopper aria-hidden className="h-3 w-3" />
                  Chapter complete
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {data.chapterName || `Chapter ${data.chapterId}`}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Current stage</p>
            <p className="text-sm font-semibold text-slate-800">{data.milestones[currentIndex].label}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Steps completed</dt>
            <dd className="text-base font-bold text-slate-900">
              {completedCount} / {requiredMilestones.length}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Mastery status</dt>
            <dd className="text-base font-bold text-slate-900">{masteryLabel}</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1">
            <dt className="text-xs text-slate-500">Next recommended action</dt>
            <dd className="text-base font-bold text-slate-900">{nextMilestone ? nextMilestone.label : 'All caught up'}</dd>
          </div>
        </dl>
      </header>

      <div ref={mapRef} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(99,102,241,0.25)]">
        <PathJourneyView
          data={data}
          currentIndex={currentIndex}
          selected={activeMilestone.key}
          onSelect={(key) => setSelected(key)}
        />
      </div>

      <MilestoneDetailPanel
        milestone={activeMilestone}
        chapterId={data.chapterId}
        readOnly={readOnly}
        onOpenKnowledgeGraph={setKgMilestone}
        focusConceptId={data.focusConceptId}
        onSelectConcept={setFocusConceptOverride}
      />

      <KnowledgeGraphPanel milestone={kgMilestone} viewContext={viewContext} onClose={() => setKgMilestone(null)} />

      {showCelebration && (
        <ChapterCompleteCelebration
          chapterName={data.chapterName || `Chapter ${data.chapterId}`}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
