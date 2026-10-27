'use client';

/**
 * Knowledge Graph Explorer.
 *
 * Two focused views rather than one cluttered one (see the brief's own
 * requirement for this split):
 *   - Hierarchy: Curriculum → Unit → Chapter → Topic → Concept, from the
 *     MariaDB Coherence Map, for a chosen Standard + Subject.
 *   - Relationships: one concept's real prerequisite/related neighbourhood,
 *     from the ESO engine, reached by clicking a concept in the hierarchy.
 *     An optional toggle overlays Neo4j's AI-suggested edges on top,
 *     always with the caveat that they are unreviewed drafts.
 *
 * Nothing here invents a relationship, a count or a mastery state — every
 * field rendered came from one of the three existing read APIs in
 * data/knowledge-graph.ts.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { defaultLearnerId } from '@/app/pal/data/pal-eso';
import StudentPicker from '@/app/pal/_components/StudentPicker';
import type { PalStudentSelection } from '@/app/pal/data/pal';
import ConceptRelationshipGraph from '../_components/ConceptRelationshipGraph';
import GraphLegend from '../_components/GraphLegend';
import AiOverlayToggle from '../_components/AiOverlayToggle';
import NodeInspectorDrawer from '../_components/NodeInspectorDrawer';
import CurriculumScopePicker from '../_components/CurriculumScopePicker';
import IconBadge from '../_components/IconBadge';
import { HEADER_WASH } from '../_components/design-system';
import {
  mapHierarchy,
  mapConceptRelationships,
  mapAiOverlay,
  mergeGraphs,
  filterHierarchyForExpansion,
  type MappedGraph,
} from '../_components/graph-mappers';
import {
  getCurriculumSession,
  fetchCurriculumHierarchy,
  fetchConceptRelationships,
  fetchAiSuggestedOverlay,
  fetchAiOverlayHealth,
  type AiOverlayHealth,
} from '../data/knowledge-graph';

type ViewMode = { kind: 'hierarchy' } | { kind: 'relationships'; conceptId: number; conceptLabel: string };

export default function KnowledgeGraphExplorerPage() {
  const [scope, setScope] = useState<{ standardId: string; subjectId: string } | null>(null);
  const [mode, setMode] = useState<ViewMode>({ kind: 'hierarchy' });

  const [hierarchyGraph, setHierarchyGraph] = useState<MappedGraph | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  // Units show first; a node's children only appear once that node itself
  // is expanded — level by level, Unit → Chapter → Topic → Concept — see
  // filterHierarchyForExpansion()'s own docblock for why (a subject's full
  // hierarchy is hundreds of concepts).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [relGraph, setRelGraph] = useState<MappedGraph | null>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [relError, setRelError] = useState<string | null>(null);
  const [needsLearnerPick, setNeedsLearnerPick] = useState(false);
  const [pickedLearnerId, setPickedLearnerId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [aiOverlayEnabled, setAiOverlayEnabled] = useState(false);
  const [aiOverlayGraph, setAiOverlayGraph] = useState<MappedGraph | null>(null);
  const [aiOverlayHealth, setAiOverlayHealth] = useState<AiOverlayHealth | null>(null);
  const [aiOverlayLoading, setAiOverlayLoading] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const loadHierarchy = useCallback(async (s: { standardId: string; subjectId: string }) => {
    setHierarchyLoading(true);
    setHierarchyError(null);
    setExpandedIds(new Set());
    try {
      const session = getCurriculumSession();
      if (!session) {
        setHierarchyError('Your session is missing academic context. Please sign in again.');
        return;
      }
      const raw = await fetchCurriculumHierarchy(session, s.subjectId, s.standardId);
      setHierarchyGraph(mapHierarchy(raw));
    } catch (err) {
      setHierarchyError(err instanceof Error ? err.message : 'Could not load the curriculum graph.');
      setHierarchyGraph(null);
    } finally {
      setHierarchyLoading(false);
    }
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const displayedHierarchyGraph = useMemo(
    () => (hierarchyGraph ? filterHierarchyForExpansion(hierarchyGraph, expandedIds) : null),
    [hierarchyGraph, expandedIds]
  );

  useEffect(() => {
    if (!scope) return;
    void loadHierarchy(scope);
  }, [scope, loadHierarchy]);

  const loadRelationships = useCallback(async (conceptId: number, learnerId: string) => {
    setRelLoading(true);
    setRelError(null);
    setNeedsLearnerPick(false);
    try {
      const map = await fetchConceptRelationships(learnerId, conceptId);
      setRelGraph(mapConceptRelationships(map));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/unknown learner/i.test(message)) {
        setNeedsLearnerPick(true);
        setRelGraph(null);
      } else if (/unknown concept/i.test(message)) {
        // The backend returns this exact message both for a genuinely
        // invalid concept id and for a real concept that simply has no ESO
        // node data yet — the vast majority of concepts platform-wide, since
        // only a small set of pilot chapters are ESO-ready today. The
        // generic backend wording doesn't distinguish the two, so the UI
        // says the honest, more likely reason rather than leaving a bare
        // "Unknown concept." that reads like something is broken.
        setRelError('This concept hasn\'t been prepared for concept-level relationships yet — that data currently exists for only a small set of pilot chapters. Try a concept from one of those, or go back and browse the curriculum hierarchy instead.');
        setRelGraph(null);
      } else {
        setRelError(message || 'Could not load this concept\'s relationships.');
        setRelGraph(null);
      }
    } finally {
      setRelLoading(false);
    }
  }, []);

  const openConcept = useCallback(
    (conceptId: number, label: string) => {
      setMode({ kind: 'relationships', conceptId, conceptLabel: label });
      setAiOverlayEnabled(false);
      setAiOverlayGraph(null);
      const learnerId = pickedLearnerId ?? defaultLearnerId();
      if (!learnerId) {
        setNeedsLearnerPick(true);
        return;
      }
      void loadRelationships(conceptId, learnerId);
    },
    [pickedLearnerId, loadRelationships]
  );

  const handleHierarchyNodeClick = useCallback(
    (nodeId: string) => {
      const node = hierarchyGraph?.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      if (node.kind === 'concept') {
        // Concepts are the leaves of the hierarchy — nothing further to
        // expand, so a click opens the relationship view instead.
        const conceptId = Number(nodeId.split(':')[1]);
        openConcept(conceptId, node.label);
        return;
      }

      // Unit, Chapter or Topic: expand/collapse in place, one level at a
      // time — the node stays visible, its direct children are added (or
      // removed) around it. No inspector popup: the expansion itself is
      // the response to the click.
      toggleNode(nodeId);
    },
    [hierarchyGraph, openConcept, toggleNode]
  );

  const handleRelationshipNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
  }, []);

  const handlePicked = useCallback(
    (student: PalStudentSelection) => {
      setPickedLearnerId(student.studentId);
      setPickerOpen(false);
      if (mode.kind === 'relationships') {
        void loadRelationships(mode.conceptId, student.studentId);
      }
    },
    [mode, loadRelationships]
  );

  const toggleAiOverlay = useCallback(
    async (next: boolean) => {
      setAiOverlayEnabled(next);
      if (!next || !scope) return;
      setAiOverlayLoading(true);
      try {
        const [overlay, health] = await Promise.all([
          fetchAiSuggestedOverlay({ standardId: Number(scope.standardId), subjectId: Number(scope.subjectId) }),
          fetchAiOverlayHealth({ standardId: Number(scope.standardId), subjectId: Number(scope.subjectId) }),
        ]);
        setAiOverlayGraph(mapAiOverlay(overlay));
        setAiOverlayHealth(health);
      } catch {
        setAiOverlayGraph(null);
        setAiOverlayHealth(null);
      } finally {
        setAiOverlayLoading(false);
      }
    },
    [scope]
  );

  // The inspector reads the FULL hierarchy graph (so a collapsed chapter's
  // real topic/concept counts still show), while the canvas draws only
  // displayedHierarchyGraph, the progressive subset — see that distinction
  // play out in the two props passed to HierarchyPanel below.
  const activeGraph = useMemo(() => {
    if (mode.kind === 'hierarchy') return hierarchyGraph;
    if (!relGraph) return null;
    return aiOverlayEnabled && aiOverlayGraph ? mergeGraphs(relGraph, aiOverlayGraph) : relGraph;
  }, [mode, hierarchyGraph, relGraph, aiOverlayEnabled, aiOverlayGraph]);

  const nodesById = useMemo(() => new Map((activeGraph?.nodes ?? []).map((n) => [n.id, n])), [activeGraph]);
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <header className={`mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ${HEADER_WASH}`}>
        <div className="flex items-center gap-3">
          <IconBadge icon={Share2} accent="brand" size="lg" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Knowledge Graph Explorer</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {mode.kind === 'hierarchy'
                ? 'Curriculum → Unit → Chapter → Topic → Concept. Click a unit, chapter or topic to open its next level; click a concept to see its relationships.'
                : `Concept relationships around "${mode.conceptLabel}".`}
            </p>
          </div>
        </div>
        {mode.kind === 'relationships' ? (
          <Button
            variant="outline"
            onClick={() => {
              setMode({ kind: 'hierarchy' });
              setAiOverlayEnabled(false);
              setAiOverlayGraph(null);
              setInspectorOpen(false);
            }}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to curriculum
          </Button>
        ) : null}
      </header>

      <div className="mx-auto max-w-6xl space-y-4">
        {!scope ? (
          <div className="mx-auto max-w-lg">
            <CurriculumScopePicker onSelect={setScope} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <div className="space-y-4">
              <CurriculumScopePicker onSelect={setScope} />
              <GraphLegend />
              {mode.kind === 'relationships' ? (
                <AiOverlayToggle
                  enabled={aiOverlayEnabled}
                  onToggle={(v) => void toggleAiOverlay(v)}
                  loading={aiOverlayLoading}
                  health={aiOverlayHealth}
                />
              ) : null}
            </div>

            <div>
              {mode.kind === 'hierarchy' ? (
                <HierarchyPanel
                  loading={hierarchyLoading}
                  error={hierarchyError}
                  graph={displayedHierarchyGraph}
                  expandedIds={expandedIds}
                  onRetry={() => void loadHierarchy(scope)}
                  onNodeClick={handleHierarchyNodeClick}
                />
              ) : (
                <RelationshipsPanel
                  loading={relLoading}
                  error={relError}
                  needsLearnerPick={needsLearnerPick}
                  graph={activeGraph}
                  onRetry={() => mode.kind === 'relationships' && openConcept(mode.conceptId, mode.conceptLabel)}
                  onPickStudent={() => setPickerOpen(true)}
                  onNodeClick={handleRelationshipNodeClick}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <NodeInspectorDrawer
        node={selectedNode}
        edges={activeGraph?.edges ?? []}
        nodesById={nodesById}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pick a student</DialogTitle>
          </DialogHeader>
          <StudentPicker audience="Teacher" onSelect={handlePicked} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HierarchyPanel({
  loading,
  error,
  graph,
  expandedIds,
  onRetry,
  onNodeClick,
}: {
  loading: boolean;
  error: string | null;
  graph: MappedGraph | null;
  expandedIds: ReadonlySet<string>;
  onRetry: () => void;
  onNodeClick: (id: string) => void;
}) {
  if (loading) return <CenteredState icon={<Loader2 className="h-6 w-6 animate-spin" />} text="Loading the curriculum graph…" />;
  if (error) return <CenteredError text={error} onRetry={onRetry} />;
  if (!graph || graph.nodes.length === 0) {
    return (
      <CenteredState
        icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
        text="No curriculum graph for this standard and subject yet."
        hint="Try a different standard or subject."
      />
    );
  }
  return <ConceptRelationshipGraph nodes={graph.nodes} edges={graph.edges} expandedIds={expandedIds} onNodeClick={onNodeClick} />;
}

function RelationshipsPanel({
  loading,
  error,
  needsLearnerPick,
  graph,
  onRetry,
  onPickStudent,
  onNodeClick,
}: {
  loading: boolean;
  error: string | null;
  needsLearnerPick: boolean;
  graph: MappedGraph | null;
  onRetry: () => void;
  onPickStudent: () => void;
  onNodeClick: (id: string) => void;
}) {
  if (needsLearnerPick) {
    return (
      <CenteredState
        icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
        text="Pick a student to see this concept's relationships."
        hint="Concept relationships carry a student's own progress (locked / mastered), so one needs to be chosen."
        action={
          <Button onClick={onPickStudent} className="mt-3">
            Pick a student
          </Button>
        }
      />
    );
  }
  if (loading) return <CenteredState icon={<Loader2 className="h-6 w-6 animate-spin" />} text="Loading concept relationships…" />;
  if (error) return <CenteredError text={error} onRetry={onRetry} />;
  if (!graph || graph.nodes.length === 0) {
    return <CenteredState icon={<AlertTriangle className="h-6 w-6 text-amber-500" />} text="No relationships recorded for this concept yet." />;
  }
  return <ConceptRelationshipGraph nodes={graph.nodes} edges={graph.edges} onNodeClick={onNodeClick} />;
}

function CenteredState({ icon, text, hint, action }: { icon: React.ReactNode; text: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-[560px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-center">
      {icon}
      <p className="max-w-sm text-sm text-slate-600">{text}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-400">{hint}</p> : null}
      {action}
    </div>
  );
}

function CenteredError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 text-center">
      <AlertTriangle className="h-6 w-6 text-rose-500" />
      <p className="max-w-sm text-sm text-rose-700">{text}</p>
      <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
