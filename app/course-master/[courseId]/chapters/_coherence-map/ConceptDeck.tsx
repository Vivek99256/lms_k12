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
 * Unit > Chapter > Topic > Concept, as stacked cards. The stack depth is not
 * decoration: it shows how much is inside before you open it, which is the same thing
 * the reference's variable-height card stacks communicate.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Layers, Search } from 'lucide-react';

import type { CoherenceMap, CoherenceNode } from '@/app/course-master/data/coherenceMap';

import { buildForest, conceptsUnder, type TreeNode } from './graphLayout';

const ALL_LEVELS = new Set(['unit', 'chapter', 'topic', 'concept'] as const);

/**
 * Neutral elevation that deepens with how much the card contains - the same
 * shadow colour the app's own `.card` class uses (app/globals.css), not a
 * brand-tinted glow.
 */
function stackShadow(count: number): string {
  if (count >= 12) return 'shadow-[0_18px_32px_-10px_rgba(0,0,0,0.22)]';
  if (count >= 5) return 'shadow-[0_14px_24px_-10px_rgba(0,0,0,0.18)]';
  if (count >= 2) return 'shadow-[0_10px_18px_-10px_rgba(0,0,0,0.14)]';

  return 'shadow-[0_6px_12px_-8px_rgba(0,0,0,0.12)]';
}

export function ConceptDeck({
  map,
  onPick,
  initialChapterId = null,
}: {
  map: CoherenceMap;
  onPick: (conceptId: string) => void;
  /** Pre-selects a chapter, so the deck opens straight into its topics (or its
   *  concept list, for a chapter with no topic level) instead of the unit grid. */
  initialChapterId?: string | null;
}) {
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(initialChapterId);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
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

  const topicChildren = openChapterTree
    ? openChapterTree.children.filter((c) => c.node.type === 'topic')
    : [];

  // Concepts parented straight to the chapter (no topic_id) alongside real topics -
  // folded into one trailing card below rather than dropped from the deck.
  const looseConcepts = openChapterTree
    ? openChapterTree.children.filter((c) => c.node.type === 'concept')
    : [];

  const topicCardsForChapter: TreeNode[] =
    topicChildren.length === 0
      ? [] // no topic step for this chapter - falls through to the flat list, as before
      : looseConcepts.length === 0
        ? topicChildren
        : [...topicChildren, looseConceptsCard(openChapterTree!, looseConcepts)];

  const hasTopicStep = topicCardsForChapter.length > 0;

  // Looked up within this chapter's own cards, not the global `byId` index - the
  // synthetic "Other concepts" card is never inserted into `byId`.
  const openTopicTree = openTopic
    ? topicCardsForChapter.find((t) => t.node.id === openTopic) ?? null
    : null;

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
            className="h-9 w-full rounded-full border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-800 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus-visible:border-[#4f46e5] focus-visible:ring-2 focus-visible:ring-[#4f46e5]/30"
          />
        </div>

        {(openUnitTree || openChapterTree) && !matches && (
          <button
            type="button"
            onClick={() => {
              if (openTopicTree) setOpenTopic(null);
              else if (openChapterTree) setOpenChapter(null);
              else setOpenUnit(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            Back
          </button>
        )}

        <p className="text-[12px] text-slate-500">
          {openChapterTree && !openTopicTree && hasTopicStep && !matches
            ? 'Pick a topic to see its concepts.'
            : 'Pick a concept to map its prerequisites.'}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {matches ? (
          <ConceptList
            heading={`${matches.length} matching concept${matches.length === 1 ? '' : 's'}`}
            concepts={matches}
            onPick={onPick}
          />
        ) : openTopicTree ? (
          <ConceptList
            heading={openTopicTree.node.label}
            concepts={conceptsUnder(openTopicTree).sort(connectedFirst)}
            onPick={onPick}
          />
        ) : openChapterTree ? (
          hasTopicStep ? (
            <CardGrid
              heading={openChapterTree.node.label}
              trees={topicCardsForChapter}
              onOpen={(tree) => setOpenTopic(tree.node.id)}
            />
          ) : (
            <ConceptList
              heading={openChapterTree.node.label}
              concepts={conceptsUnder(openChapterTree).sort(connectedFirst)}
              onPick={onPick}
            />
          )
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

/**
 * A chapter can have some concepts tagged with a topic and some without. The loose
 * ones are folded into one trailing card rather than dropped from the deck - shaped
 * like a real TreeNode so CardGrid and conceptsUnder need no special case for it.
 */
function looseConceptsCard(chapter: TreeNode, loose: TreeNode[]): TreeNode {
  return {
    node: {
      id: `${chapter.node.id}::other`, // sentinel; real refs never contain "::"
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
                'flex h-36 flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#4F46E5] px-4 text-center transition-[transform,box-shadow] duration-200',
                'hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2',
                'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                stackShadow(concepts),
              ].join(' ')}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                {tree.node.type === 'unit' ? 'Unit' : tree.node.type === 'chapter' ? 'Chapter' : 'Topic'}
              </span>
              <span className="line-clamp-3 text-[15px] font-semibold leading-snug text-white">
                {tree.node.label}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/70">
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
                  className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-[border-color,background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_16px_-8px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="text-[13px] font-semibold leading-snug text-slate-900">
                    {concept.label}
                  </span>

                  <span className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    {concept.prereq_count > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-px font-medium text-slate-600">
                        {concept.prereq_count} before
                      </span>
                    )}
                    {concept.dependent_count > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-px font-medium text-slate-600">
                        {concept.dependent_count} after
                      </span>
                    )}
                    {/* Said plainly rather than hidden: a concept nobody has linked is
                        a gap in the curriculum map, which is worth seeing. */}
                    {links === 0 && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-px font-medium text-amber-800">
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
