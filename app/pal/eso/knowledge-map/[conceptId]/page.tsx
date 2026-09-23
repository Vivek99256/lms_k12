'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Lock, Loader2 } from 'lucide-react';

import { DashboardError } from '@/app/dashboard/_components/DashboardPrimitives';
import {
  defaultLearnerId,
  fetchKnowledgeMap,
  type KnowledgeMap,
  type KnowledgeMapConcept,
  type KnowledgeMapEdge,
  type KnowledgeMapNodeStatus,
} from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';

/**
 * The whole chapter's real concept-relationship graph, with the current
 * concept marked "You are here" — a dedicated ESO-only knowledge map, on the
 * exact same mastery pipeline as the rest of the PAL chapter dashboard
 * (eso_learner_node_state), not the separate BKT/Coherence-Map system
 * elsewhere in the app. Everything here comes from one call to
 * EsoPolicyService::chapterKnowledgeMap() (see app/pal/data/pal-eso.ts,
 * fetchKnowledgeMap) — nothing on this page is static/mock data.
 *
 * Every unlocked card routes straight into the existing adaptive-learning
 * flow (/pal/eso?conceptId=...) — this page never decides what a student
 * should do next, it only shows the map and lets D1-D5 (via nextAction())
 * decide, exactly as it already does for every other entry point.
 */
export default function KnowledgeMapPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." />}>
      <KnowledgeMapPageContent />
    </Suspense>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function KnowledgeMapPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAsStudent = useViewAsStudent();

  const conceptId = Number((params?.conceptId as string) || '0');
  // Same convention as app/pal/eso/page.tsx and app/pal/eso/chapter/[chapterId]/page.tsx:
  // the real entry point never puts learnerId in the URL for a student — it
  // resolves to defaultLearnerId(), the authenticated session's own id.
  // `?learnerId=` only matters for a staff "view as student" session — a
  // student cannot use it to act as anyone else, since the backend
  // (EsoStudentOnlyAuth, same middleware as every other route in this
  // feature) independently derives and enforces the learner from the
  // caller's own JWT regardless of what this resolves to.
  const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();

  const [data, setData] = useState<KnowledgeMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!conceptId || !learnerId) return;
      setLoading(true);
      setError(null);
      fetchKnowledgeMap(learnerId, conceptId, signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (signal?.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Unable to load the knowledge map.');
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [conceptId, learnerId]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so setLoading/setError inside load() don't
    // fire synchronously within the effect body — same convention used
    // throughout app/pal/eso/*.
    queueMicrotask(() => {
      load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  if (!conceptId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert tone="error">A concept must be selected to open the knowledge map (missing conceptId in the URL).</Alert>
      </div>
    );
  }

  // The one and only place a student may start or continue a concept —
  // the existing adaptive-learning entry point, unchanged. This page never
  // implements a second decision path.
  const onOpenConcept = (id: number) => router.push(`/pal/eso?conceptId=${id}${learnerId ? `&learnerId=${learnerId}` : ''}`);

  return (
    <div className="mx-auto px-4 py-6 sm:px-6">
      {loading && <CenteredSpinner label="Loading the knowledge map..." />}
      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}
      {!loading && !error && data && <KnowledgeMapView data={data} onOpenConcept={onOpenConcept} onBack={() => router.back()} />}
    </div>
  );
}

function Alert({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {children}
    </div>
  );
}

const STATUS_LABEL: Record<KnowledgeMapNodeStatus, string> = {
  locked: 'Waiting on earlier work',
  not_started: 'Start now',
  in_progress: 'In progress',
  mastered: 'Got it',
  retained: 'Retained',
  not_ready: 'No content yet',
};

const STATUS_DOT: Record<KnowledgeMapNodeStatus, string> = {
  locked: 'bg-slate-300',
  not_started: 'bg-indigo-300',
  in_progress: 'bg-indigo-600',
  mastered: 'bg-emerald-500',
  retained: 'bg-teal-500',
  not_ready: 'bg-slate-200',
};

/** The CTA every actionable card/header shows — null means "no action here" (locked or not yet content-ready). */
function ctaLabel(status: KnowledgeMapNodeStatus): string | null {
  switch (status) {
    case 'not_started':
      return 'Start now';
    case 'in_progress':
      return 'Continue';
    case 'mastered':
    case 'retained':
      return 'Review';
    default:
      return null;
  }
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function summaryParagraph(data: KnowledgeMap): string {
  if (data.lockedConceptNames.length === 0) {
    return 'Nothing in this chapter is locked right now — every concept either has been mastered or is ready to start.';
  }

  const locked = joinWithAnd(data.lockedConceptNames);
  const blocking = data.blockingPrerequisiteNames.length > 0 ? joinWithAnd(data.blockingPrerequisiteNames) : 'earlier concepts';

  return `Right now ${locked} stay${data.lockedConceptNames.length === 1 ? 's' : ''} closed, because ${
    data.lockedConceptNames.length === 1 ? 'it needs' : 'each needs'
  } concepts you have not mastered yet — ${blocking}. They are not hidden, they are just not useful yet.`;
}

function KnowledgeMapView({
  data,
  onOpenConcept,
  onBack,
}: {
  data: KnowledgeMap;
  onOpenConcept: (conceptId: number) => void;
  onBack: () => void;
}) {
  const current = data.concepts.find((c) => c.isCurrent);
  const statusesPresent = Array.from(new Set(data.concepts.map((c) => c.status)));

  // What the current concept directly rests on, and what directly depends on
  // it — the same edges the diagram draws, just read as plain sentences for
  // the one concept the student is actually looking at (Screenshot 1's
  // "what this rests on" / "what it opens up" framing, built from real data,
  // not a separate per-node annotation system).
  const nameOf = useMemo(() => {
    const map = new Map(data.concepts.map((c) => [c.conceptId, c.name]));
    return (id: number) => map.get(id) ?? `Concept #${id}`;
  }, [data.concepts]);

  const restsOn = current
    ? data.edges.filter((e) => e.type === 'direct_prerequisite' && e.toConceptId === current.conceptId).map((e) => nameOf(e.fromConceptId))
    : [];
  const opensUp = current
    ? data.edges.filter((e) => e.type === 'direct_prerequisite' && e.fromConceptId === current.conceptId).map((e) => nameOf(e.toConceptId))
    : [];

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Knowledge map</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {statusesPresent.map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      <h1 className="mt-2 text-2xl font-bold text-slate-900">{data.chapterName}</h1>
      {data.chapterDescription && <p className="mt-1 max-w-3xl text-sm text-slate-500">{data.chapterDescription}</p>}
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{summaryParagraph(data)}</p>

      {current && (
        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">You are here</span>
              <h2 className="mt-1.5 text-lg font-bold text-slate-900">{current.name}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {STATUS_LABEL[current.status]}
                {current.responses > 0 ? ` · ${current.responses} response${current.responses === 1 ? '' : 's'}` : ' · No responses yet'}
              </p>
            </div>
            {ctaLabel(current.status) && (
              <button
                type="button"
                onClick={() => onOpenConcept(current.conceptId)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {ctaLabel(current.status)}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {(restsOn.length > 0 || opensUp.length > 0) && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-indigo-100 pt-3 text-xs text-slate-600 sm:grid-cols-2">
              {restsOn.length > 0 && (
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">What this rests on</p>
                  <p className="mt-0.5">{joinWithAnd(restsOn)}</p>
                </div>
              )}
              {opensUp.length > 0 && (
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">What it opens up</p>
                  <p className="mt-0.5">{joinWithAnd(opensUp)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-widest text-slate-400">How to read it</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-2 border-indigo-500" />
          Direct prerequisite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-2 border-dashed border-slate-400" />
          Related
        </span>
        <span className="text-slate-400">Reads downwards. Arrows point from the prerequisite to what needs it.</span>
      </div>

      <DepthGraph concepts={data.concepts} edges={data.edges} onOpenConcept={onOpenConcept} />

      <DependencyTable concepts={data.concepts} edges={data.edges} />

      <div className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>
          <strong className="text-slate-900">{data.stats.concepts}</strong> concepts
        </span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span>
          <strong className="text-slate-900">{data.stats.directPrerequisites}</strong> direct prerequisite
          {data.stats.directPrerequisites === 1 ? '' : 's'}
        </span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span>
          <strong className="text-slate-900">{data.stats.related}</strong> related link{data.stats.related === 1 ? '' : 's'}
        </span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span>
          <strong className="text-slate-900">{data.stats.misconceptions}</strong> known misconception{data.stats.misconceptions === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ── Dependency graph — path structure, curve geometry, hover/focus highlighting ──

/** Which nodes are this concept's direct/transitive prerequisites and dependents — computed once per graph, not per hover. */
interface PathIndex {
  directUp: Set<number>;
  directDown: Set<number>;
  /** Full ancestor closure (prerequisites of prerequisites, ...), excludes the concept itself. */
  closureUp: Set<number>;
  /** Full descendant closure (dependents of dependents, ...), excludes the concept itself. */
  closureDown: Set<number>;
}

const EMPTY_PATH_INDEX: PathIndex = { directUp: new Set(), directDown: new Set(), closureUp: new Set(), closureDown: new Set() };

function bfsClosure(start: number, adjacency: Map<number, number[]>): Set<number> {
  const seen = new Set<number>();
  let frontier = adjacency.get(start) ?? [];
  frontier.forEach((id) => seen.add(id));
  let guard = 0; // depth guard, not a pedagogy decision — this chapter's real longest chain is ~2-3
  while (frontier.length > 0 && guard < 12) {
    const next: number[] = [];
    frontier.forEach((id) => {
      (adjacency.get(id) ?? []).forEach((n) => {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      });
    });
    frontier = next;
    guard++;
  }
  return seen;
}

/** Built once per (concepts, edges) via useMemo — hover/focus only does O(1) map lookups against this, never recomputes the graph. */
function buildPathIndex(concepts: KnowledgeMapConcept[], edges: KnowledgeMapEdge[]): Map<number, PathIndex> {
  const prereqOf = new Map<number, number[]>(); // dependent -> [prerequisite ids]
  const dependentsOf = new Map<number, number[]>(); // prerequisite -> [dependent ids]

  edges.forEach((e) => {
    if (e.type !== 'direct_prerequisite') return;
    // fromConceptId = the prerequisite, toConceptId = the dependent (see KnowledgeMapEdge's own doc comment).
    const p = prereqOf.get(e.toConceptId) ?? [];
    p.push(e.fromConceptId);
    prereqOf.set(e.toConceptId, p);

    const d = dependentsOf.get(e.fromConceptId) ?? [];
    d.push(e.toConceptId);
    dependentsOf.set(e.fromConceptId, d);
  });

  const index = new Map<number, PathIndex>();
  concepts.forEach((c) => {
    index.set(c.conceptId, {
      directUp: new Set(prereqOf.get(c.conceptId) ?? []),
      directDown: new Set(dependentsOf.get(c.conceptId) ?? []),
      closureUp: bfsClosure(c.conceptId, prereqOf),
      closureDown: bfsClosure(c.conceptId, dependentsOf),
    });
  });
  return index;
}

type Emphasis = 'active' | 'direct' | 'indirect' | 'muted' | 'normal';

function nodeEmphasis(conceptId: number, activeId: number | null, pathIndex: Map<number, PathIndex>): Emphasis {
  if (activeId === null) return 'normal';
  if (conceptId === activeId) return 'active';
  const info = pathIndex.get(activeId) ?? EMPTY_PATH_INDEX;
  if (info.directUp.has(conceptId) || info.directDown.has(conceptId)) return 'direct';
  if (info.closureUp.has(conceptId) || info.closureDown.has(conceptId)) return 'indirect';
  return 'muted';
}

function edgeEmphasis(edge: KnowledgeMapEdge, activeId: number | null, pathIndex: Map<number, PathIndex>): Emphasis {
  if (activeId === null) return 'normal';
  if (edge.fromConceptId === activeId || edge.toConceptId === activeId) return 'active';
  if (edge.type !== 'direct_prerequisite') return 'muted'; // 'related' has no transitive concept — either it touches the active node, or it's muted
  const info = pathIndex.get(activeId) ?? EMPTY_PATH_INDEX;
  const onUpstreamChain = info.closureUp.has(edge.fromConceptId) && (edge.toConceptId === activeId || info.closureUp.has(edge.toConceptId));
  const onDownstreamChain = info.closureDown.has(edge.toConceptId) && (edge.fromConceptId === activeId || info.closureDown.has(edge.fromConceptId));
  return onUpstreamChain || onDownstreamChain ? 'indirect' : 'muted';
}

/** A smooth vertical S-curve: starts leaving the prerequisite straight down, ends arriving at the dependent straight up — reads cleanly as "flows downward" at any horizontal offset, and naturally separates from a neighboring straight line the way a straight diagonal wouldn't. */
function prerequisiteCurve(x1: number, y1: number, x2: number, y2: number): string {
  const dy = y2 - y1;
  const c1y = y1 + dy * 0.5;
  const c2y = y1 + dy * 0.5;
  return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
}

/** A gentle bow away from the straight line, alternating side by a deterministic seed so two related edges through the same node don't overlap. No direction implied — related is undirected. */
function relatedCurve(x1: number, y1: number, x2: number, y2: number, seed: number): { path: string; midX: number; midY: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = Math.min(36, dist * 0.18) * (seed % 2 === 0 ? 1 : -1);
  const cx = mx + nx * bow;
  const cy = my + ny * bow;
  return { path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, midX: cx, midY: cy };
}

/**
 * Barycenter ordering (one top-down pass, the standard lightweight technique
 * for layered/Sugiyama-style graph drawing): within each row, place a
 * concept near the average horizontal position of its already-placed direct
 * prerequisites, instead of the arbitrary id order the backend returns rows
 * in. Cuts down avoidable edge crossings without a graph-layout dependency.
 */
function orderRowsByBarycenter(
  byDepth: [number, KnowledgeMapConcept[]][],
  edges: KnowledgeMapEdge[]
): [number, KnowledgeMapConcept[]][] {
  const prereqOf = new Map<number, number[]>();
  edges.forEach((e) => {
    if (e.type !== 'direct_prerequisite') return;
    const p = prereqOf.get(e.toConceptId) ?? [];
    p.push(e.fromConceptId);
    prereqOf.set(e.toConceptId, p);
  });

  const positionOf = new Map<number, number>();
  const ordered: [number, KnowledgeMapConcept[]][] = [];

  byDepth.forEach(([depth, row], rowIndex) => {
    let sortedRow = row;
    if (rowIndex > 0) {
      sortedRow = [...row].sort((a, b) => {
        const pa = (prereqOf.get(a.conceptId) ?? []).map((id) => positionOf.get(id)).filter((v): v is number => v !== undefined);
        const pb = (prereqOf.get(b.conceptId) ?? []).map((id) => positionOf.get(id)).filter((v): v is number => v !== undefined);
        const ba = pa.length > 0 ? pa.reduce((sum, v) => sum + v, 0) / pa.length : Number.MAX_SAFE_INTEGER;
        const bb = pb.length > 0 ? pb.reduce((sum, v) => sum + v, 0) / pb.length : Number.MAX_SAFE_INTEGER;
        return ba - bb;
      });
    }
    sortedRow.forEach((c, i) => positionOf.set(c.conceptId, i));
    ordered.push([depth, sortedRow]);
  });

  return ordered;
}

interface EdgeGeometry {
  edgeIndex: number;
  path: string;
  kind: 'direct_prerequisite' | 'related';
  midX: number;
  midY: number;
}

/**
 * The actual node-and-edge diagram: concepts laid out in rows by depth
 * (shallowest — no unmet prerequisite within this chapter — at the top,
 * barycenter-ordered within each row to reduce crossings), connected by
 * curved SVG paths measured from the rendered cards' own positions (correct
 * at any viewport width, not a fixed pixel layout). Hovering or keyboard-
 * focusing a card highlights its direct prerequisites, direct dependents,
 * and the connecting paths — everything else mutes — so the learning path
 * reads clearly even with 15-20 concepts on screen. Wrapped in its own
 * horizontal scroller so a wide chapter never forces the whole page to
 * scroll sideways.
 */
function DepthGraph({
  concepts,
  edges,
  onOpenConcept,
}: {
  concepts: KnowledgeMapConcept[];
  edges: KnowledgeMapEdge[];
  onOpenConcept: (conceptId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [edgeGeometry, setEdgeGeometry] = useState<EdgeGeometry[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeConceptId, setActiveConceptId] = useState<number | null>(null);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const byDepth = useMemo(() => {
    const rows = new Map<number, KnowledgeMapConcept[]>();
    concepts.forEach((c) => {
      const row = rows.get(c.depth) ?? [];
      row.push(c);
      rows.set(c.depth, row);
    });
    const sorted = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
    return orderRowsByBarycenter(sorted, edges);
  }, [concepts, edges]);

  const pathIndex = useMemo(() => buildPathIndex(concepts, edges), [concepts, edges]);
  const nameOf = useMemo(() => {
    const map = new Map(concepts.map((c) => [c.conceptId, c.name]));
    return (id: number) => map.get(id) ?? `Concept #${id}`;
  }, [concepts]);

  const setNodeRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const anchor = (id: number, edge: 'top' | 'bottom' | 'center') => {
      const el = nodeRefs.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = edge === 'top' ? r.top : edge === 'bottom' ? r.bottom : r.top + r.height / 2;
      return { x: x - containerRect.left, y: y - containerRect.top };
    };

    const next: EdgeGeometry[] = [];
    edges.forEach((edge, edgeIndex) => {
      if (edge.type === 'direct_prerequisite') {
        const from = anchor(edge.fromConceptId, 'bottom');
        const to = anchor(edge.toConceptId, 'top');
        if (from && to) {
          next.push({
            edgeIndex,
            path: prerequisiteCurve(from.x, from.y, to.x, to.y),
            kind: 'direct_prerequisite',
            midX: (from.x + to.x) / 2,
            midY: (from.y + to.y) / 2,
          });
        }
      } else {
        const from = anchor(edge.fromConceptId, 'center');
        const to = anchor(edge.toConceptId, 'center');
        if (from && to) {
          const curve = relatedCurve(from.x, from.y, to.x, to.y, edgeIndex);
          next.push({ edgeIndex, path: curve.path, kind: 'related', midX: curve.midX, midY: curve.midY });
        }
      }
    });

    setEdgeGeometry(next);
    setSize({ width: container.scrollWidth, height: container.scrollHeight });
  }, [edges]);

  useLayoutEffect(() => {
    recompute();
    const onResize = () => recompute();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recompute, byDepth]);

  const activate = useCallback((id: number) => setActiveConceptId(id), []);
  const deactivate = useCallback(() => setActiveConceptId(null), []);

  const showEdgeTooltip = useCallback(
    (edge: KnowledgeMapEdge, geometry: EdgeGeometry) => {
      const text =
        edge.type === 'direct_prerequisite'
          ? `Prerequisite for: ${nameOf(edge.toConceptId)}`
          : `Related to: ${nameOf(edge.toConceptId === edge.fromConceptId ? edge.fromConceptId : edge.toConceptId)}`;
      setHoveredEdgeIndex(geometry.edgeIndex);
      setTooltip({ x: geometry.midX, y: geometry.midY, text });
    },
    [nameOf]
  );
  const hideEdgeTooltip = useCallback(() => {
    setHoveredEdgeIndex(null);
    setTooltip(null);
  }, []);

  const active = activeConceptId !== null ? concepts.find((c) => c.conceptId === activeConceptId) : undefined;
  const activeInfo = activeConceptId !== null ? pathIndex.get(activeConceptId) ?? EMPTY_PATH_INDEX : null;

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-6">
      {/* Hover/focus detail readout — "Prerequisites / Leads to" for whichever concept is currently active, reusing the same real edge data the diagram draws. Reserves its height even when empty so the graph below doesn't jump. */}
      <div className="mb-3 min-h-[2.25rem] rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {active && activeInfo ? (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-slate-800">{active.name}</span>
            {activeInfo.directUp.size > 0 && (
              <span>
                <span className="text-slate-400">Prerequisites:</span> {Array.from(activeInfo.directUp).map(nameOf).join(', ')}
              </span>
            )}
            {activeInfo.directDown.size > 0 && (
              <span>
                <span className="text-slate-400">Leads to:</span> {Array.from(activeInfo.directDown).map(nameOf).join(', ')}
              </span>
            )}
            {activeInfo.directUp.size === 0 && activeInfo.directDown.size === 0 && <span className="text-slate-400">No direct connections recorded.</span>}
          </span>
        ) : (
          <span className="text-slate-400">Hover or focus a concept to trace its prerequisite and next-step path.</span>
        )}
      </div>

      <div ref={containerRef} className="relative min-w-fit">
        <svg
          className="absolute left-0 top-0"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <marker id="km-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
            <marker id="km-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4338ca" />
            </marker>
          </defs>

          {edgeGeometry.map((geometry) => {
            const edge = edges[geometry.edgeIndex];
            const emphasis = edgeEmphasis(edge, activeConceptId, pathIndex);
            const isHoveredEdge = hoveredEdgeIndex === geometry.edgeIndex;
            const isRelated = geometry.kind === 'related';

            const strokeColor = isRelated ? '#94a3b8' : emphasis === 'active' ? '#4338ca' : '#6366f1';
            const strokeWidth = emphasis === 'active' || isHoveredEdge ? 3 : emphasis === 'indirect' ? 1.75 : 1.25;
            const opacity =
              emphasis === 'normal' ? (isRelated ? 0.35 : 0.8) : emphasis === 'active' ? 1 : emphasis === 'indirect' ? 0.55 : 0.12;

            return (
              <g key={geometry.edgeIndex}>
                <path
                  d={geometry.path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isRelated ? '5 4' : undefined}
                  markerEnd={!isRelated ? (emphasis === 'active' ? 'url(#km-arrow-active)' : 'url(#km-arrow)') : undefined}
                  className="text-indigo-500 transition-[stroke-width,opacity] duration-150 ease-out"
                  style={{ opacity }}
                />
                {/* Wide, invisible hit area — the visible stroke above is deliberately thin, so this is what actually catches hover for the tooltip. */}
                <path
                  d={geometry.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onMouseEnter={() => showEdgeTooltip(edge, geometry)}
                  onMouseLeave={hideEdgeTooltip}
                />
              </g>
            );
          })}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
          >
            {tooltip.text}
          </div>
        )}

        <div className="relative flex flex-col items-center gap-10">
          {byDepth.map(([depth, row]) => (
            <div key={depth} className="flex flex-wrap justify-center gap-4">
              {row.map((concept) => (
                <div key={concept.conceptId} ref={(el) => setNodeRef(concept.conceptId, el)}>
                  <GraphNode
                    concept={concept}
                    emphasis={nodeEmphasis(concept.conceptId, activeConceptId, pathIndex)}
                    onOpenConcept={onOpenConcept}
                    onActivate={activate}
                    onDeactivate={deactivate}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EMPHASIS_RING: Record<Emphasis, string> = {
  active: 'ring-2 ring-indigo-500 border-indigo-400',
  direct: 'ring-1 ring-indigo-300 border-indigo-300',
  indirect: 'border-slate-200',
  muted: 'border-slate-100',
  normal: 'border-slate-200',
};

const EMPHASIS_OPACITY: Record<Emphasis, string> = {
  active: 'opacity-100',
  direct: 'opacity-100',
  indirect: 'opacity-80',
  muted: 'opacity-40',
  normal: 'opacity-100',
};

function GraphNode({
  concept,
  emphasis,
  onOpenConcept,
  onActivate,
  onDeactivate,
}: {
  concept: KnowledgeMapConcept;
  emphasis: Emphasis;
  onOpenConcept: (conceptId: number) => void;
  onActivate: (conceptId: number) => void;
  onDeactivate: () => void;
}) {
  const clickable = concept.status !== 'locked' && concept.status !== 'not_ready';
  const cta = ctaLabel(concept.status);

  const interactionProps = {
    onMouseEnter: () => onActivate(concept.conceptId),
    onMouseLeave: onDeactivate,
    onFocus: () => onActivate(concept.conceptId),
    onBlur: onDeactivate,
  };

  const body = (
    <>
      {concept.isCurrent && (
        <span className="absolute -top-3 left-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">You are here</span>
      )}
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[concept.status]}`} />
        <span className="truncate text-sm font-semibold text-slate-900">{concept.name}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {STATUS_LABEL[concept.status]}
        {concept.responses > 0 ? ` · ${concept.responses} response${concept.responses === 1 ? '' : 's'}` : ' · No responses'}
      </div>
      {concept.misconceptionCount > 0 && (
        <div className="text-[11px] text-slate-400">
          {concept.misconceptionCount} misconception{concept.misconceptionCount === 1 ? '' : 's'}
        </div>
      )}
      {concept.status === 'locked' && concept.blockingPrerequisiteNames.length > 0 && (
        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
          <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0" />
          <span>Complete: {joinWithAnd(concept.blockingPrerequisiteNames)}</span>
        </div>
      )}
      {cta && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
          {cta}
          <ArrowRight className="h-2.5 w-2.5" />
        </div>
      )}
    </>
  );

  const sharedClasses = `relative w-44 rounded-lg border px-3 py-2.5 text-left transition-[opacity,box-shadow,border-color] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${EMPHASIS_RING[emphasis]} ${EMPHASIS_OPACITY[emphasis]}`;

  if (!clickable) {
    return (
      <div
        className={`${sharedClasses} cursor-not-allowed bg-slate-50`}
        role="button"
        tabIndex={0}
        aria-disabled="true"
        title={concept.status === 'locked' ? 'Locked until its prerequisites are mastered' : 'No adaptive content authored for this concept yet'}
        {...interactionProps}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenConcept(concept.conceptId)}
      className={`${sharedClasses} ${concept.isCurrent ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-white hover:border-indigo-200 hover:bg-indigo-50/50'}`}
      {...interactionProps}
    >
      {body}
    </button>
  );
}

/** "The dependency graph" — the same edges as the diagram above, as a plain text table. */
function DependencyTable({ concepts, edges }: { concepts: KnowledgeMapConcept[]; edges: KnowledgeMapEdge[] }) {
  const nameOf = useMemo(() => {
    const map = new Map(concepts.map((c) => [c.conceptId, c.name]));
    return (id: number) => map.get(id) ?? `Concept #${id}`;
  }, [concepts]);

  const direct = edges.filter((e) => e.type === 'direct_prerequisite');
  const related = edges.filter((e) => e.type === 'related');

  if (direct.length === 0 && related.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">The dependency graph</h2>
      <p className="mt-0.5 text-sm text-slate-500">Every edge in the diagram above, as a plain list.</p>

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {direct.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Direct prerequisite</h3>
            <p className="mb-2 text-xs text-slate-400">Needed before the second concept can be assessed.</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {direct.map((e, i) => (
                <li key={i}>
                  {nameOf(e.fromConceptId)} <span className="text-slate-400">&rarr;</span> {nameOf(e.toConceptId)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {related.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Related concept</h3>
            <p className="mb-2 text-xs text-slate-400">Shares structure, no dependency in either direction.</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {related.map((e, i) => (
                <li key={i}>
                  {nameOf(e.fromConceptId)} <span className="text-slate-400">&harr;</span> {nameOf(e.toConceptId)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
