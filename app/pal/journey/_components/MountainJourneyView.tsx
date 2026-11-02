'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  GitBranch,
  Layers,
  ListChecks,
  Loader2,
  PartyPopper,
  RotateCcw,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import {
  fetchJourneyData,
  currentMilestoneIndex,
  type JourneyData,
  type MilestoneKey,
} from '@/app/pal/journey/data/pal-journey';
import { PathJourneyView, type UnifiedJourneyNode } from './path/PathJourneyView';
import { StepDetailPanel } from './StepDetailPanel';
import { TeacherPerspectivePanel } from './TeacherPerspectivePanel';
import { EmptyChapterState } from './EmptyChapterState';
import { JourneyErrorState } from './JourneyErrorState';
import { KnowledgeGraphPanel } from './KnowledgeGraphPanel';
import { ChapterCompleteCelebration } from './ChapterCompleteCelebration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

export function MountainJourneyView({
  chapterId,
  viewContext = DEFAULT_VIEW_CONTEXT,
}: MountainJourneyViewProps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<UnifiedJourneyNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showTeacherDiagnostics, setShowTeacherDiagnostics] = useState(
    viewContext.mode === 'monitor'
  );
  const [attempt, setAttempt] = useState(0);
  const [kgMilestone, setKgMilestone] = useState<JourneyData['milestones'][number] | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [focusConceptOverride, setFocusConceptOverride] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusConceptOverride]);

  useEffect(() => {
    if (!data) return;
    const required = data.milestones.filter((entry) => !entry.untracked);
    const allRequiredDone =
      required.length > 0 &&
      required.every((entry) => entry.status === 'completed' || entry.status === 'mastered');
    if (!allRequiredDone || !data.chapterFullyMastered) return;

    const storageKey = `pal_journey_celebrated_${data.chapterId}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, '1');
    } catch {
      // Ignore storage errors in private mode
    }
    setShowCelebration(true);
  }, [data]);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      fetchJourneyData(chapterId, controller.signal, viewContext.studentId, focusConceptOverride)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);

          // Default selected node: current active or latest reached step
          const activeIndex = result.currentStepIndex ?? 0;
          const activeStep = result.actualSteps[activeIndex] ?? result.actualSteps[0];
          if (activeStep) {
            setSelectedNodeId(activeStep.id);
            setSelectedNode({
              id: activeStep.id,
              source: activeStep.attemptNumber > 1 ? 'attempt2' : 'main',
              stageKey: activeStep.stageKey,
              label: activeStep.label,
              subLabel: activeStep.shortLabel,
              timeSpentMinutes: activeStep.timeSpentMinutes,
              score: activeStep.score,
              status: activeStep.status as any,
              isStuck: activeStep.isStuck,
              stuckReason: activeStep.stuckReason,
              repeatReason: activeStep.repeatReason,
              facts: activeStep.facts,
              note: activeStep.progressionNote ?? undefined,
              x: 0,
              y: 0,
            });
          }
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
        Loading complete learning journey…
      </div>
    );
  }

  if (error) {
    return <JourneyErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  if (!data || !data.hasAnyActivity) {
    return <EmptyChapterState chapterName={data?.chapterName} />;
  }

  const readOnly = viewContext.readOnly ?? viewContext.mode === 'monitor';
  const isTeacherMonitor = viewContext.mode === 'monitor';

  return (
    <div className="space-y-6">
      {/* ── 1. The Single Unified "Your Journey" Visualization ── */}
      <div ref={mapRef} className="w-full">
        <PathJourneyView
          data={data}
          selectedNodeId={selectedNodeId}
          onSelectNode={(node) => {
            setSelectedNode(node);
            setSelectedNodeId(node.id);
          }}
        />
      </div>

      {/* ── 2. Interactive Step Detail Panel ── */}
      {selectedNode && (
        <StepDetailPanel
          selectedNode={selectedNode}
          chapterId={data.chapterId}
          readOnly={readOnly}
          onOpenKnowledgeGraph={() =>
            setKgMilestone(data.milestones.find((m) => m.key === 'mastery') ?? null)
          }
          onSelectConcept={setFocusConceptOverride}
          concepts={data.chapterConcepts}
          selectedConceptId={data.focusConceptId}
        />
      )}

      {/* ── 3. Teacher Perspective & Diagnostics Accordion/Panel ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <UserCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Teacher Perspective &amp; Diagnostic Audit
              </h3>
              <p className="text-xs text-slate-500">
                Answers why student took longer, stuck points, and root misconception causes.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeacherDiagnostics((prev) => !prev)}
            className="gap-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
          >
            {showTeacherDiagnostics ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Teacher Diagnostics
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Teacher Diagnostics (Q1–Q5)
              </>
            )}
          </Button>
        </div>

        {showTeacherDiagnostics && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <TeacherPerspectivePanel
              insights={data.teacherInsights}
              actualSteps={data.actualSteps}
              onSelectStep={(stepNum) => {
                // Find matching node and select it
                const found = data.actualSteps.find((s) => s.stepNumber === stepNum);
                if (found) {
                  setSelectedNodeId(found.id);
                  setSelectedNode({
                    id: found.id,
                    source: found.attemptNumber > 1 ? 'attempt2' : 'main',
                    stageKey: found.stageKey,
                    label: found.label,
                    subLabel: found.shortLabel,
                    timeSpentMinutes: found.timeSpentMinutes,
                    score: found.score,
                    status: found.status as any,
                    isStuck: found.isStuck,
                    stuckReason: found.stuckReason,
                    repeatReason: found.repeatReason,
                    facts: found.facts,
                    note: found.progressionNote ?? undefined,
                    x: 0,
                    y: 0,
                  });
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Knowledge Graph Dialog Panel */}
      <KnowledgeGraphPanel
        milestone={kgMilestone}
        viewContext={viewContext}
        onClose={() => setKgMilestone(null)}
      />

      {/* Chapter Completion Confetti Celebration */}
      {showCelebration && (
        <ChapterCompleteCelebration
          chapterName={data.chapterName || `Chapter ${data.chapterId}`}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
