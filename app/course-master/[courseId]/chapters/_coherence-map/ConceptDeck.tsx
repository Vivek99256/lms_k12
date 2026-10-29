'use client';

/**
 * Curriculum Explorer & Concept Deck.
 *
 * Strict hierarchical drill-down flow:
 * Unit ➔ Chapter ➔ Topic ➔ Concept ➔ Coherence Knowledge Map
 *
 * Features:
 * - Left side: Curriculum Explorer Sidebar (matching exact reference design)
 * - Right side: Visual Stage (Unit ➔ Chapter ➔ Topic ➔ Concept Grid with Concept Intelligence)
 * - Seamless synchronization: clicking any node in the sidebar tree updates the stage
 * - Real-time search and breadcrumb navigation
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  Layers,
  Lightbulb,
  ListTree,
  Network,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import type { CoherenceMap, CoherenceNode } from '@/app/course-master/data/coherenceMap';

import { colorForId, LEVEL_THEMES } from './colorPalette';
import {
  capitalize,
  conceptGlance,
  difficultyChipClass,
  useConceptIntelligenceEntry,
} from './conceptIntelligence';
import { CurriculumExplorerSidebar } from './CurriculumExplorerSidebar';
import { buildForest, conceptsUnder, type TreeNode } from './graphLayout';

const ALL_LEVELS = new Set(['unit', 'chapter', 'topic', 'concept'] as const);

export function ConceptDeck({
  map,
  onPick,
  initialChapterId = null,
  onClose,
}: {
  map: CoherenceMap;
  onPick: (conceptId: string) => void;
  initialChapterId?: string | null;
  onClose: () => void;
}) {
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(initialChapterId);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [seenChapterId, setSeenChapterId] = useState(initialChapterId);

  if (seenChapterId !== initialChapterId) {
    setSeenChapterId(initialChapterId);
    setOpenUnit(null);
    setOpenChapter(initialChapterId);
    setOpenTopic(null);
  }

  const forest = useMemo(() => buildForest(map.nodes, new Set(ALL_LEVELS)), [map.nodes]);

  const byId = useMemo(() => {
    const index = new Map<string, TreeNode>();

    const walk = (tree: TreeNode) => {
      index.set(tree.node.id, tree);
      for (const child of tree.children) walk(child);
    };

    for (const root of forest) walk(root);

    return index;
  }, [forest]);

  // Global search across all concepts
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return null;

    return map.nodes
      .filter((n) => n.type === 'concept' && n.label.toLowerCase().includes(term))
      .sort(connectedFirst)
      .slice(0, 80);
  }, [query, map.nodes]);

  const unitTrees = forest.filter((t) => t.node.type === 'unit' || t.node.type === 'chapter');
  const openUnitTree = openUnit ? byId.get(openUnit) ?? null : null;
  const openChapterTree = openChapter ? byId.get(openChapter) ?? null : null;

  const topicChildren = openChapterTree
    ? openChapterTree.children.filter((c) => c.node.type === 'topic')
    : [];

  const looseConcepts = openChapterTree
    ? openChapterTree.children.filter((c) => c.node.type === 'concept')
    : [];

  const topicCardsForChapter: TreeNode[] =
    topicChildren.length === 0
      ? []
      : looseConcepts.length === 0
        ? topicChildren
        : [...topicChildren, looseConceptsCard(openChapterTree!, looseConcepts)];

  const hasTopicStep = topicCardsForChapter.length > 0;

  const openTopicTree = openTopic
    ? topicCardsForChapter.find((t) => t.node.id === openTopic) ?? null
    : null;

  // Total statistics for header
  const totalConceptsCount = useMemo(
    () => map.nodes.filter((n) => n.type === 'concept').length,
    [map.nodes]
  );
  const totalChaptersCount = useMemo(
    () => map.nodes.filter((n) => n.type === 'chapter').length,
    [map.nodes]
  );

  // Active step in the Unit -> Chapter -> Topic -> Concept flow
  const currentLevel: 'unit' | 'chapter' | 'topic' | 'concept' = matches
    ? 'concept'
    : openTopicTree
      ? 'concept'
      : openChapterTree
        ? hasTopicStep
          ? 'topic'
          : 'concept'
        : openUnitTree
          ? 'chapter'
          : 'unit';

  const canGoBack = Boolean(openUnitTree || openChapterTree || openTopicTree);

  const handleBack = () => {
    if (openTopicTree) {
      setOpenTopic(null);
    } else if (openChapterTree) {
      setOpenChapter(null);
    } else if (openUnitTree) {
      setOpenUnit(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/70">
      {/* ── Top Header Toolbar ──────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-5 py-3 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-sm">
            <Network size={18} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-slate-900">Curriculum Coherence Map</h2>
              {/* Level indicator badge */}
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${LEVEL_THEMES[currentLevel].badge}`}>
                {currentLevel === 'unit' && '1. Select Unit'}
                {currentLevel === 'chapter' && '2. Select Chapter'}
                {currentLevel === 'topic' && '3. Select Topic'}
                {currentLevel === 'concept' && '4. Select Concept to Map'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Unit ➔ Chapter ➔ Topic ➔ Concept Knowledge Graph ({totalChaptersCount} Chapters · {totalConceptsCount} Concepts)
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative min-w-[16rem] max-w-sm flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any concept in this curriculum..."
            aria-label="Search all concepts"
            className="h-8.5 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-9 pr-9 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-[#059669] focus:bg-white focus:ring-2 focus:ring-[#059669]/20"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
          aria-label="Close coherence map"
          title="Close explorer"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      {/* ── Main Workspace: Sidebar Beside Main Stage ──────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT: Curriculum Explorer Sidebar (Reference Design) */}
        <CurriculumExplorerSidebar
          map={map}
          selectedUnitId={openUnit}
          selectedChapterId={openChapter}
          selectedTopicId={openTopic}
          onSelectConcept={onPick}
          onSelectUnit={(id) => {
            setOpenUnit(id);
            setOpenChapter(null);
            setOpenTopic(null);
          }}
          onSelectChapter={(id) => {
            setOpenChapter(id);
            setOpenTopic(null);
          }}
          onSelectTopic={(id) => {
            setOpenTopic(id);
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        {/* RIGHT: Visual Stage Area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
          {/* Breadcrumb Bar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-2.5 backdrop-blur-xs">
            <div className="flex items-center gap-2 overflow-x-auto text-[12px]">
              {/* Back button */}
              {canGoBack && !matches && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                >
                  <ArrowLeft size={13} strokeWidth={2.4} />
                  <span>Back</span>
                </button>
              )}

              {/* Breadcrumb Steps */}
              <nav className="flex items-center gap-1.5 font-medium" aria-label="Curriculum drill-down">
                {/* Step 1: All Units */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenUnit(null);
                    setOpenChapter(null);
                    setOpenTopic(null);
                  }}
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors text-[11.5px]',
                    !openUnitTree && !openChapterTree
                      ? 'bg-indigo-600 font-bold text-white shadow-xs'
                      : 'bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100',
                  ].join(' ')}
                >
                  <Layers size={11} strokeWidth={2.2} />
                  <span>1. All Units</span>
                </button>

                {/* Step 2: Unit */}
                {openUnitTree && (
                  <>
                    <ChevronRight size={13} className="text-slate-400" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenChapter(null);
                        setOpenTopic(null);
                      }}
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors text-[11.5px]',
                        !openChapterTree
                          ? 'bg-sky-600 font-bold text-white shadow-xs'
                          : 'bg-sky-50 font-semibold text-sky-700 hover:bg-sky-100',
                      ].join(' ')}
                    >
                      <BookOpen size={11} strokeWidth={2.2} />
                      <span>2. {openUnitTree.node.label}</span>
                    </button>
                  </>
                )}

                {/* Step 3: Chapter */}
                {openChapterTree && (
                  <>
                    <ChevronRight size={13} className="text-slate-400" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenTopic(null);
                      }}
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors text-[11.5px]',
                        !openTopicTree
                          ? 'bg-purple-600 font-bold text-white shadow-xs'
                          : 'bg-purple-50 font-semibold text-purple-700 hover:bg-purple-100',
                      ].join(' ')}
                    >
                      <ListTree size={11} strokeWidth={2.2} />
                      <span>3. {openChapterTree.node.label}</span>
                    </button>
                  </>
                )}

                {/* Step 4: Topic */}
                {openTopicTree && (
                  <>
                    <ChevronRight size={13} className="text-slate-400" />
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 font-bold text-white shadow-xs text-[11.5px]">
                      <Lightbulb size={11} strokeWidth={2.2} />
                      <span>4. {openTopicTree.node.label}</span>
                    </span>
                  </>
                )}
              </nav>
            </div>

            {/* Step Guide Tag */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1 text-slate-400">
                <span>Unit</span>
                <ChevronRight size={10} />
                <span>Chapter</span>
                <ChevronRight size={10} />
                <span>Topic</span>
                <ChevronRight size={10} />
                <span className="font-bold text-emerald-700">Concept</span>
              </span>
            </div>
          </div>

          {/* Main Stage Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {matches ? (
              /* ── Search Results ── */
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Search Results for &ldquo;{query}&rdquo;
                    </h3>
                    <p className="text-xs text-slate-500">
                      Found {matches.length} matching concept{matches.length === 1 ? '' : 's'}. Click any concept to map its prerequisites.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50"
                  >
                    Clear Search
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {matches.map((concept) => (
                    <ConceptTile key={concept.id} concept={concept} onPick={onPick} />
                  ))}
                </div>
              </div>
            ) : openTopicTree ? (
              /* ── Level 4: Topic -> Concepts List ── */
              <div>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                      <Lightbulb size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Concepts in &ldquo;{openTopicTree.node.label}&rdquo;
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select a concept below to launch its full Coherence Knowledge Graph
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {conceptsUnder(openTopicTree)
                    .sort(connectedFirst)
                    .map((concept) => (
                      <ConceptTile
                        key={concept.id}
                        concept={concept}
                        onPick={onPick}
                        accent={colorForId(openTopicTree.node.id)}
                      />
                    ))}
                </div>
              </div>
            ) : openChapterTree ? (
              /* ── Level 3: Chapter -> Topics (or direct concepts if no topics) ── */
              hasTopicStep ? (
                <div>
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-xs">
                        <ListTree size={14} strokeWidth={2.2} />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Topics in &ldquo;{openChapterTree.node.label}&rdquo;
                        </h3>
                        <p className="text-xs text-slate-500">
                          Step 3: Click a topic to view its individual concepts
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {topicCardsForChapter.map((tree) => {
                      const conCount = conceptsUnder(tree).length;
                      const hex = colorForId(tree.node.id);

                      return (
                        <button
                          key={tree.node.id}
                          type="button"
                          onClick={() => setOpenTopic(tree.node.id)}
                          className="group relative flex h-36 flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 border border-purple-200/60">
                              <ListTree size={10} strokeWidth={2.2} />
                              <span>Topic</span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                              {conCount} {conCount === 1 ? 'concept' : 'concepts'}
                            </span>
                          </div>

                          <div className="my-auto">
                            <h4 className="line-clamp-2 text-[14px] font-bold text-slate-800 group-hover:text-purple-950 transition-colors">
                              {tree.node.label}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                            <span
                              className="h-1.5 w-6 rounded-full transition-all duration-200 group-hover:w-12"
                              style={{ backgroundColor: hex }}
                            />
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                              <span>View Concepts</span>
                              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Chapter has no topics — shows concepts directly */
                <div>
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                        <Lightbulb size={14} strokeWidth={2.2} />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Concepts in &ldquo;{openChapterTree.node.label}&rdquo;
                        </h3>
                        <p className="text-xs text-slate-500">
                          Select a concept below to launch its Coherence Knowledge Graph
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {conceptsUnder(openChapterTree)
                      .sort(connectedFirst)
                      .map((concept) => (
                        <ConceptTile
                          key={concept.id}
                          concept={concept}
                          onPick={onPick}
                          accent={colorForId(openChapterTree.node.id)}
                        />
                      ))}
                  </div>
                </div>
              )
            ) : openUnitTree ? (
              /* ── Level 2: Unit -> Chapters Grid ── */
              <div>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs">
                      <BookOpen size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Chapters in &ldquo;{openUnitTree.node.label}&rdquo;
                      </h3>
                      <p className="text-xs text-slate-500">
                        Step 2: Click a chapter to explore its topics and concepts
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {openUnitTree.children.map((chTree) => {
                    const topicCount = chTree.children.filter((c) => c.node.type === 'topic').length;
                    const conCount = conceptsUnder(chTree).length;
                    const hex = colorForId(chTree.node.id);

                    return (
                      <button
                        key={chTree.node.id}
                        type="button"
                        onClick={() => setOpenChapter(chTree.node.id)}
                        className="group relative flex h-36 flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 border border-sky-200/60">
                            <BookOpen size={10} strokeWidth={2.2} />
                            <span>Chapter</span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                            {topicCount > 0 ? `${topicCount} topics` : `${conCount} concepts`}
                          </span>
                        </div>

                        <div className="my-auto">
                          <h4 className="line-clamp-2 text-[14px] font-bold text-slate-800 group-hover:text-sky-950 transition-colors">
                            {chTree.node.label}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                          <span
                            className="h-1.5 w-6 rounded-full transition-all duration-200 group-hover:w-12"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                            <span>{topicCount > 0 ? 'View Topics' : 'View Concepts'}</span>
                            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── Level 1: All Units Grid ── */
              <div>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-xs">
                      <Layers size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Curriculum Units
                      </h3>
                      <p className="text-xs text-slate-500">
                        Step 1: Choose a unit to drill down into chapters, topics, and concepts
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {unitTrees.map((tree) => {
                    const isUnit = tree.node.type === 'unit';
                    const chCount = tree.children.filter((c) => c.node.type === 'chapter').length;
                    const conCount = conceptsUnder(tree).length;
                    const hex = colorForId(tree.node.id);

                    return (
                      <button
                        key={tree.node.id}
                        type="button"
                        onClick={() => {
                          if (isUnit) {
                            setOpenUnit(tree.node.id);
                          } else {
                            // Direct chapter at root level
                            setOpenChapter(tree.node.id);
                          }
                        }}
                        className="group relative flex h-38 flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200/60">
                            <Layers size={10} strokeWidth={2.2} />
                            <span>{isUnit ? 'Unit' : 'Chapter'}</span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                            {isUnit ? `${chCount} Chapters` : `${conCount} Concepts`}
                          </span>
                        </div>

                        <div className="my-auto">
                          <h4 className="line-clamp-2 text-[14.5px] font-bold text-slate-800 group-hover:text-indigo-950 transition-colors">
                            {tree.node.label}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{conCount} concepts mapped</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                          <span
                            className="h-1.5 w-6 rounded-full transition-all duration-200 group-hover:w-12"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                            <span>{isUnit ? 'Open Chapters' : 'Explore'}</span>
                            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* ConceptTile Component with AI Concept Intelligence glance               */
/* ──────────────────────────────────────────────────────────────────────── */

function ConceptTile({
  concept,
  onPick,
  accent,
}: {
  concept: CoherenceNode;
  onPick: (id: string) => void;
  accent?: string;
}) {
  const meta = concept.meta as Record<string, unknown>;
  const chapterId = typeof meta.chapter_id === 'number' ? meta.chapter_id : null;
  const { entry } = useConceptIntelligenceEntry(chapterId, concept.label);
  const glance = conceptGlance(entry);

  const links = concept.prereq_count + concept.dependent_count;
  const cardAccent = accent ?? colorForId(concept.id);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md">
      <div>
        {/* Top Header: Concept Badge + AI Concept Intelligence */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/60">
            <Sparkles size={9} className="text-emerald-600" />
            <span>Concept</span>
          </span>

          {/* AI Concept Intelligence Pill: Difficulty */}
          {glance?.difficulty ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${difficultyChipClass(
                glance.difficulty
              )}`}
              title={`Concept Intelligence Difficulty: ${glance.difficulty}`}
            >
              <Brain size={10} strokeWidth={2.2} />
              <span>{capitalize(glance.difficulty)}</span>
            </span>
          ) : (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: cardAccent }}
              title="Chapter color"
            />
          )}
        </div>

        {/* Concept Title */}
        <h4 className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800 group-hover:text-emerald-950 transition-colors">
          {concept.label}
        </h4>
      </div>

      {/* Footer: Connections & Map Launch Button */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1 text-[10.5px] mb-2.5">
          {concept.prereq_count > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 border border-sky-200/60">
              <span>← {concept.prereq_count} before</span>
            </span>
          )}
          {concept.dependent_count > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-700 border border-teal-200/60">
              <span>{concept.dependent_count} after →</span>
            </span>
          )}
          {links === 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 border border-amber-200/60">
              Not linked yet
            </span>
          )}
        </div>

        {/* Launch Knowledge Graph */}
        <button
          type="button"
          onClick={() => onPick(concept.id)}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-1.5 text-[11px] font-bold text-emerald-700 border border-slate-200/80 transition-all duration-150 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:scale-95 shadow-2xs"
        >
          <Network size={12} strokeWidth={2.2} />
          <span>Map Knowledge Graph</span>
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Helper Functions                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

function looseConceptsCard(chapter: TreeNode, loose: TreeNode[]): TreeNode {
  return {
    node: {
      id: `${chapter.node.id}::other`,
      type: 'topic',
      entity_id: -1,
      label: 'Other concepts',
      parent_id: chapter.node.id,
      order: Number.MAX_SAFE_INTEGER,
      depth: 0,
      on_cycle: false,
      prereq_count: 0,
      dependent_count: 0,
      off_map: false,
      meta: {},
    },
    children: loose,
    level: chapter.level + 1,
  };
}

function connectedFirst(a: CoherenceNode, b: CoherenceNode): number {
  const linksA = a.prereq_count + a.dependent_count;
  const linksB = b.prereq_count + b.dependent_count;

  return linksB - linksA || a.order - b.order || a.label.localeCompare(b.label);
}
