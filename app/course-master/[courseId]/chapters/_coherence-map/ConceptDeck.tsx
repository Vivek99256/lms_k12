'use client';

/**
 * How a concept gets chosen, before the map has a centre.
 *
 * WHY THERE IS A DECK AT ALL
 * The focus map needs a root, and there is no safe way to pick one automatically. A
 * good fraction of concepts have no prerequisite links whatsoever (`stats.isolated` is
 * 91 of 633 on Science Grade 9), so auto-centring risks opening on a single card in an
 * empty field, which reads as a broken screen rather than as a true fact about the
 * curriculum. Making the choice explicit also means the teacher arrives at the map
 * already knowing what they came to look at.
 *
 * Unit > Chapter > Concept, as stacked cards. The stack depth is not decoration: it
 * shows how much is inside before you open it, which is the same thing the reference's
 * variable-height card stacks communicate.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Layers, Search } from 'lucide-react';

import type { CoherenceMap, CoherenceNode } from '@/app/course-master/data/coherenceMap';

import { buildForest, conceptsUnder, type TreeNode } from './graphLayout';

const ALL_LEVELS = new Set(['unit', 'chapter', 'topic', 'concept'] as const);

/** Three depths of shadow, scaled by how much the card contains. */
function stackShadow(count: number): string {
  if (count >= 12) {
    return 'shadow-[3px_3px_0_0_#c7d2fe,6px_6px_0_0_#ddd6fe,9px_9px_0_0_#eef2ff,12px_12px_0_0_#f5f3ff]';
  }
  if (count >= 5) return 'shadow-[3px_3px_0_0_#c7d2fe,6px_6px_0_0_#ddd6fe,9px_9px_0_0_#eef2ff]';
  if (count >= 2) return 'shadow-[3px_3px_0_0_#c7d2fe,6px_6px_0_0_#ddd6fe]';

  return 'shadow-[3px_3px_0_0_#c7d2fe]';
}

export function ConceptDeck({
  map,
  onPick,
}: {
  map: CoherenceMap;
  onPick: (conceptId: string) => void;
}) {
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  // Search short-circuits the whole drill-down. With 233 concepts, someone who knows
  // what they want should not have to remember which chapter it lives in.
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return null;

    return map.nodes
      .filter((n) => n.type === 'concept' && n.label.toLowerCase().includes(term))
      .sort(connectedFirst)
      .slice(0, 60);
  }, [query, map.nodes]);

  const unitTrees = forest.filter((t) => t.node.type === 'unit' || t.node.type === 'chapter');
  const openUnitTree = openUnit ? byId.get(openUnit) ?? null : null;
  const openChapterTree = openChapter ? byId.get(openChapter) ?? null : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search concepts"
            aria-label="Search concepts"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus-visible:border-[#4f46e5] focus-visible:ring-2 focus-visible:ring-[#4f46e5]/30"
          />
        </div>

        {(openUnitTree || openChapterTree) && !matches && (
          <button
            type="button"
            onClick={() => (openChapterTree ? setOpenChapter(null) : setOpenUnit(null))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            Back
          </button>
        )}

        <p className="text-[12px] text-slate-500">
          Pick a concept to map its prerequisites.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {matches ? (
          <ConceptList
            heading={`${matches.length} matching concept${matches.length === 1 ? '' : 's'}`}
            concepts={matches}
            onPick={onPick}
          />
        ) : openChapterTree ? (
          <ConceptList
            heading={openChapterTree.node.label}
            concepts={conceptsUnder(openChapterTree).sort(connectedFirst)}
            onPick={onPick}
          />
        ) : openUnitTree ? (
          <CardGrid
            heading={openUnitTree.node.label}
            trees={openUnitTree.children.length > 0 ? openUnitTree.children : [openUnitTree]}
            onOpen={(tree) => setOpenChapter(tree.node.id)}
          />
        ) : (
          <CardGrid
            heading="Choose a unit"
            trees={unitTrees}
            onOpen={(tree) =>
              tree.node.type === 'unit' ? setOpenUnit(tree.node.id) : setOpenChapter(tree.node.id)
            }
          />
        )}
      </div>
    </div>
  );
}

/** Well-connected concepts first: those are the ones with a map worth looking at. */
function connectedFirst(a: CoherenceNode, b: CoherenceNode): number {
  const linksA = a.prereq_count + a.dependent_count;
  const linksB = b.prereq_count + b.dependent_count;

  return linksB - linksA || a.order - b.order || a.label.localeCompare(b.label);
}

function CardGrid({
  heading,
  trees,
  onOpen,
}: {
  heading: string;
  trees: TreeNode[];
  onOpen: (tree: TreeNode) => void;
}) {
  return (
    <>
      <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{heading}</h3>

      <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trees.map((tree) => {
          const concepts = conceptsUnder(tree).length;

          return (
            <button
              key={tree.node.id}
              type="button"
              onClick={() => onOpen(tree)}
              className={[
                'flex h-36 flex-col items-center justify-center gap-1.5 rounded-sm bg-indigo-700 px-4 text-center transition-transform',
                'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2',
                'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                stackShadow(concepts),
              ].join(' ')}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-200">
                {tree.node.type === 'unit' ? 'Unit' : 'Chapter'}
              </span>
              <span className="line-clamp-3 text-[15px] font-semibold leading-snug text-white">
                {tree.node.label}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-indigo-200">
                <Layers size={10} strokeWidth={2} aria-hidden />
                {concepts} concept{concepts === 1 ? '' : 's'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ConceptList({
  heading,
  concepts,
  onPick,
}: {
  heading: string;
  concepts: CoherenceNode[];
  onPick: (conceptId: string) => void;
}) {
  return (
    <>
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{heading}</h3>

      {concepts.length === 0 ? (
        <p className="text-[13px] text-slate-500">No concepts here yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {concepts.map((concept) => {
            const links = concept.prereq_count + concept.dependent_count;

            return (
              <li key={concept.id}>
                <button
                  type="button"
                  onClick={() => onPick(concept.id)}
                  className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
                >
                  <span className="text-[13px] font-semibold leading-snug text-slate-900">
                    {concept.label}
                  </span>

                  <span className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    {concept.prereq_count > 0 && (
                      <span className="rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">
                        {concept.prereq_count} before
                      </span>
                    )}
                    {concept.dependent_count > 0 && (
                      <span className="rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">
                        {concept.dependent_count} after
                      </span>
                    )}
                    {/* Said plainly rather than hidden: a concept nobody has linked is
                        a gap in the curriculum map, which is worth seeing. */}
                    {links === 0 && (
                      <span className="rounded bg-amber-50 px-1.5 py-px font-medium text-amber-800">
                        Not linked yet
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
