'use client';

/**
 * Curriculum Explorer Sidebar.
 *
 * Implements the exact hierarchical curriculum explorer sidebar design from reference:
 * - Purple header with network tree icon and collapse toggle («)
 * - Live filter search input: "Search unit, chapter, topic or concept..."
 * - Units with colored circular layers icon, caret toggle, and chapter count badge
 * - Chapters with blue open-book icon, caret toggle, and topic count badge
 * - Topics with amber folder icon, caret toggle, and concept count badge
 * - Concepts connected with tree guide line and green node connection icon
 * - Selected concept active highlight pill (soft indigo background with emerald left accent)
 * - Full click-to-open and drill-down support:
 *   Unit ➔ Chapter ➔ Topic ➔ Concept
 */

import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  Layers,
  Network,
  Search,
  X,
} from 'lucide-react';

import type { CoherenceMap, CoherenceNode } from '@/app/course-master/data/coherenceMap';
import { buildForest, conceptsUnder, type TreeNode } from './graphLayout';

const ALL_LEVELS = new Set(['unit', 'chapter', 'topic', 'concept'] as const);

const UNIT_COLOR_PALETTE = [
  { bg: 'bg-[#8B5CF6]', text: 'text-[#8B5CF6]', ring: 'ring-[#8B5CF6]/30', tint: 'bg-purple-50/70', badgeBorder: 'border-purple-200' }, // Unit 1 Purple
  { bg: 'bg-[#10B981]', text: 'text-[#10B981]', ring: 'ring-[#10B981]/30', tint: 'bg-emerald-50/70', badgeBorder: 'border-emerald-200' }, // Unit 2 Green
  { bg: 'bg-[#EC4899]', text: 'text-[#EC4899]', ring: 'ring-[#EC4899]/30', tint: 'bg-pink-50/70', badgeBorder: 'border-pink-200' }, // Unit 3 Pink/Magenta
  { bg: 'bg-[#F97316]', text: 'text-[#F97316]', ring: 'ring-[#F97316]/30', tint: 'bg-orange-50/70', badgeBorder: 'border-orange-200' }, // Unit 4 Orange
  { bg: 'bg-[#64748B]', text: 'text-[#64748B]', ring: 'ring-[#64748B]/30', tint: 'bg-slate-50/70', badgeBorder: 'border-slate-200' }, // Slate / Other
  { bg: 'bg-[#0284C7]', text: 'text-[#0284C7]', ring: 'ring-[#0284C7]/30', tint: 'bg-sky-50/70', badgeBorder: 'border-sky-200' },
  { bg: 'bg-[#7C3AED]', text: 'text-[#7C3AED]', ring: 'ring-[#7C3AED]/30', tint: 'bg-violet-50/70', badgeBorder: 'border-violet-200' },
];

/** Concept 3-node graph icon matching user's design reference */
function ConceptNodeIcon({ className = 'text-emerald-600' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="4" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 5.5V8M8 8L4.5 10.5M8 8L11.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type CurriculumExplorerSidebarProps = {
  map: CoherenceMap;
  selectedConceptId?: string | null;
  selectedUnitId?: string | null;
  selectedChapterId?: string | null;
  selectedTopicId?: string | null;
  onSelectConcept: (conceptId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  onSelectChapter?: (chapterId: string) => void;
  onSelectTopic?: (topicId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function CurriculumExplorerSidebar({
  map,
  selectedConceptId,
  selectedUnitId,
  selectedChapterId,
  selectedTopicId,
  onSelectConcept,
  onSelectUnit,
  onSelectChapter,
  onSelectTopic,
  collapsed = false,
  onToggleCollapse,
}: CurriculumExplorerSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Structured forest with unassigned chapters grouped under a synthetic Unit
  const unitList = useMemo(() => {
    const rawRoots = buildForest(map.nodes, new Set(ALL_LEVELS));
    const units: TreeNode[] = [];
    const unassignedChapters: TreeNode[] = [];

    for (const root of rawRoots) {
      if (root.node.type === 'unit') {
        units.push(root);
      } else if (root.node.type === 'chapter') {
        unassignedChapters.push(root);
      }
    }

    // If there are chapters not assigned to any unit, group them as in the reference design
    if (unassignedChapters.length > 0) {
      units.push({
        node: {
          id: 'unit::unassigned',
          type: 'unit',
          entity_id: -999,
          label: 'Not assigned to a unit',
          parent_id: null,
          order: 9999,
          depth: 0,
          on_cycle: false,
          prereq_count: 0,
          dependent_count: 0,
          off_map: false,
          meta: {},
        },
        children: unassignedChapters,
        level: 0,
      });
    }

    return units;
  }, [map.nodes]);

  // Open the first unit, its first chapter, and its first topic by default
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (unitList.length > 0) {
      set.add(unitList[0].node.id);
      if (unitList[0].children.length > 0) {
        set.add(unitList[0].children[0].node.id);
        if (unitList[0].children[0].children.length > 0) {
          set.add(unitList[0].children[0].children[0].node.id);
        }
      }
    }
    return set;
  });

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Search filter
  const query = searchTerm.trim().toLowerCase();
  const isFiltering = query.length > 0;

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center border-r border-slate-200/90 bg-white py-3 px-1.5 w-12 shrink-0 transition-all duration-200 select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 shadow-2xs hover:bg-purple-100 transition-colors"
          title="Expand Curriculum Explorer"
          aria-label="Expand Curriculum Explorer"
        >
          <ChevronsRight size={16} strokeWidth={2.4} />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-2xs">
            <Network size={14} strokeWidth={2.2} />
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 rotate-90 my-10 whitespace-nowrap"
            style={{ writingMode: 'vertical-rl' }}
          >
            Curriculum Explorer
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[310px] shrink-0 flex-col border-r border-slate-200/90 bg-white shadow-sm transition-all duration-200 select-none">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#6366F1] text-white shadow-xs">
            <Network size={16} strokeWidth={2.2} />
          </span>
          <h3 className="text-[14px] font-bold text-slate-900 tracking-tight">
            Curriculum Explorer
          </h3>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-800"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* ── Search Input ───────────────────────────────────────────── */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search unit, chapter, topic or concept..."
            className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 pl-8.5 pr-7 text-[11.5px] font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#6366F1] focus:bg-white focus:ring-2 focus:ring-[#6366F1]/15"
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tree View ──────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {unitList.map((unitTree, unitIndex) => {
          const colorTheme = UNIT_COLOR_PALETTE[unitIndex % UNIT_COLOR_PALETTE.length];
          const isExpanded = isFiltering || expandedNodes.has(unitTree.node.id);
          const chapters = unitTree.children.filter((c) => c.node.type === 'chapter');
          const isSelectedUnit = selectedUnitId === unitTree.node.id;

          // Search match filtering
          if (
            isFiltering &&
            !unitTree.node.label.toLowerCase().includes(query) &&
            !unitTree.children.some(
              (c) =>
                c.node.label.toLowerCase().includes(query) ||
                c.children.some(
                  (t) =>
                    t.node.label.toLowerCase().includes(query) ||
                    t.children.some((con) => con.node.label.toLowerCase().includes(query))
                )
            )
          ) {
            return null;
          }

          return (
            <div key={unitTree.node.id}>
              {/* ── Unit Row (Level 1) ── */}
              <div
                className={[
                  'group flex items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 text-left transition-colors cursor-pointer',
                  isSelectedUnit ? colorTheme.tint : 'hover:bg-slate-50',
                ].join(' ')}
                onClick={() => {
                  toggleExpand(unitTree.node.id);
                  onSelectUnit?.(unitTree.node.id);
                }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {/* Caret Button */}
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 group-hover:text-slate-600 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(unitTree.node.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={13} strokeWidth={2.4} />
                    ) : (
                      <ChevronRight size={13} strokeWidth={2.4} />
                    )}
                  </span>

                  {/* Circular Layers Icon */}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-2xs ${colorTheme.bg}`}
                  >
                    <Layers size={11} strokeWidth={2.4} />
                  </span>

                  {/* Unit Title */}
                  <span className="truncate text-[12px] font-bold text-slate-900 group-hover:text-slate-950">
                    {unitTree.node.label}
                  </span>
                </div>

                {/* Chapter Count Badge */}
                <span
                  className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border bg-white px-1.5 text-[10.5px] font-bold text-slate-700 shadow-2xs ${colorTheme.badgeBorder}`}
                >
                  {chapters.length}
                </span>
              </div>

              {/* ── Chapters under Unit (Level 2) ── */}
              {isExpanded && (
                <div className="ml-5 pl-1.5 space-y-0.5 border-l border-slate-100">
                  {chapters.map((chTree) => {
                    const isChExpanded = isFiltering || expandedNodes.has(chTree.node.id);
                    const isSelectedCh = selectedChapterId === chTree.node.id;
                    const topics = chTree.children.filter((c) => c.node.type === 'topic');
                    const looseConcepts = chTree.children.filter((c) => c.node.type === 'concept');
                    const hasTopics = topics.length > 0;
                    const totalConceptCount = conceptsUnder(chTree).length;

                    if (
                      isFiltering &&
                      !chTree.node.label.toLowerCase().includes(query) &&
                      !chTree.children.some(
                        (t) =>
                          t.node.label.toLowerCase().includes(query) ||
                          t.children.some((con) => con.node.label.toLowerCase().includes(query))
                      )
                    ) {
                      return null;
                    }

                    return (
                      <div key={chTree.node.id}>
                        {/* Chapter Row */}
                        <div
                          className={[
                            'group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer',
                            isSelectedCh ? 'bg-sky-50 font-bold text-sky-900' : 'hover:bg-slate-50',
                          ].join(' ')}
                          onClick={() => {
                            toggleExpand(chTree.node.id);
                            onSelectChapter?.(chTree.node.id);
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 group-hover:text-slate-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(chTree.node.id);
                              }}
                            >
                              {isChExpanded ? (
                                <ChevronDown size={12} strokeWidth={2.4} />
                              ) : (
                                <ChevronRight size={12} strokeWidth={2.4} />
                              )}
                            </span>

                            {/* Blue Book Icon */}
                            <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md bg-[#2563EB] text-white shadow-2xs">
                              <BookOpen size={10} strokeWidth={2.4} />
                            </span>

                            {/* Chapter Title */}
                            <span className="truncate text-[11.5px] font-semibold text-slate-700 group-hover:text-slate-900">
                              {chTree.node.label}
                            </span>
                          </div>

                          {/* Count Badge */}
                          <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                            {hasTopics ? topics.length : totalConceptCount}
                          </span>
                        </div>

                        {/* ── Topics under Chapter (Level 3) ── */}
                        {isChExpanded && (
                          <div className="ml-5 pl-1.5 space-y-0.5 border-l border-slate-100">
                            {hasTopics ? (
                              topics.map((topicTree) => {
                                const isTopicExpanded =
                                  isFiltering || expandedNodes.has(topicTree.node.id);
                                const isSelectedTopic = selectedTopicId === topicTree.node.id;
                                const topicConcepts = conceptsUnder(topicTree);

                                if (
                                  isFiltering &&
                                  !topicTree.node.label.toLowerCase().includes(query) &&
                                  !topicConcepts.some((con) =>
                                    con.label.toLowerCase().includes(query)
                                  )
                                ) {
                                  return null;
                                }

                                return (
                                  <div key={topicTree.node.id}>
                                    {/* Topic Row */}
                                    <div
                                      className={[
                                        'group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1 text-left transition-colors cursor-pointer',
                                        isSelectedTopic
                                          ? 'bg-amber-50 font-bold text-amber-900'
                                          : 'hover:bg-slate-50',
                                      ].join(' ')}
                                      onClick={() => {
                                        toggleExpand(topicTree.node.id);
                                        onSelectTopic?.(topicTree.node.id);
                                      }}
                                    >
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span
                                          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-slate-400 group-hover:text-slate-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpand(topicTree.node.id);
                                          }}
                                        >
                                          {isTopicExpanded ? (
                                            <ChevronDown size={11} strokeWidth={2.4} />
                                          ) : (
                                            <ChevronRight size={11} strokeWidth={2.4} />
                                          )}
                                        </span>

                                        {/* Amber Folder Icon */}
                                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#F59E0B]">
                                          <Folder size={12} strokeWidth={2.2} fill="#FDE68A" />
                                        </span>

                                        <span className="truncate text-[11px] font-medium text-slate-700 group-hover:text-slate-900">
                                          {topicTree.node.label}
                                        </span>
                                      </div>

                                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1 text-[9.5px] font-medium text-slate-500">
                                        {topicConcepts.length}
                                      </span>
                                    </div>

                                    {/* ── Concepts under Topic (Level 4) ── */}
                                    {isTopicExpanded && (
                                      <div className="relative ml-5.5 pl-2 py-1 space-y-0.5 border-l-2 border-emerald-300">
                                        {topicConcepts.map((concept) => {
                                          const isSelectedCon =
                                            selectedConceptId === concept.id;

                                          if (
                                            isFiltering &&
                                            !concept.label.toLowerCase().includes(query)
                                          ) {
                                            return null;
                                          }

                                          return (
                                            <button
                                              key={concept.id}
                                              type="button"
                                              onClick={() => onSelectConcept(concept.id)}
                                              className={[
                                                'group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-all duration-150',
                                                isSelectedCon
                                                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-bold shadow-xs border-l-[3px] border-[#10B981]'
                                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                              ].join(' ')}
                                            >
                                              <ConceptNodeIcon
                                                className={
                                                  isSelectedCon
                                                    ? 'text-[#10B981]'
                                                    : 'text-emerald-600'
                                                }
                                              />
                                              <span className="truncate text-[11px]">
                                                {concept.label}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              /* Chapter has direct concepts (no topics) */
                              <div className="relative ml-5.5 pl-2 py-1 space-y-0.5 border-l-2 border-emerald-300">
                                {looseConcepts.map((concept) => {
                                  const isSelectedCon = selectedConceptId === concept.node.id;

                                  if (
                                    isFiltering &&
                                    !concept.node.label.toLowerCase().includes(query)
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <button
                                      key={concept.node.id}
                                      type="button"
                                      onClick={() => onSelectConcept(concept.node.id)}
                                      className={[
                                        'group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-all duration-150',
                                        isSelectedCon
                                          ? 'bg-[#EEF2FF] text-[#4F46E5] font-bold shadow-xs border-l-[3px] border-[#10B981]'
                                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                      ].join(' ')}
                                    >
                                      <ConceptNodeIcon
                                        className={
                                          isSelectedCon
                                            ? 'text-[#10B981]'
                                            : 'text-emerald-600'
                                        }
                                      />
                                      <span className="truncate text-[11px]">
                                        {concept.node.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
