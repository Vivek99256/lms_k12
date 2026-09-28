'use client';

/**
 * One concept on the focus map, at either of its two sizes.
 *
 * WHY ONE COMPONENT AND NOT TWO
 * The card on the canvas and the detail panel are the same object at different scales -
 * that is the whole trick the reference tool is built on. Splitting them into a small
 * node plus a separate inspector is what the previous design did, and it meant the
 * thing you clicked and the thing that told you about it were never visibly the same
 * card. Keeping one component also makes it impossible for the two to disagree about
 * what a concept is called or how many prerequisites it has.
 *
 * WHY THE CURATOR BUTTONS LIVE HERE
 * They used to be in the right-hand rail. The rail is gone, so they move in with the
 * content they act on. `isReviewableEdge` guards both the render and the handler, in
 * both places, because this card lists EVERY incident edge - including expert rows
 * that have no review workflow and hierarchy rows that have no database id. Dropping
 * the guard in either place produces a PATCH to /relations/expert/12 and a 404 the
 * teacher cannot act on.
 */

import { memo, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, ExternalLink, Minimize2, Network, Pin, RotateCcw, Trash2, X } from 'lucide-react';

import { isReviewableEdge, type CoherenceEdge } from '@/app/course-master/data/coherenceMap';

import { MapInteractionContext } from './LaneEdge';
import type { FocusNode } from './focusLayout';

export type ConceptCardData = {
  node: FocusNode;
  expanded: boolean;
  /** Edges where this concept is the dependent — what it needs. */
  prerequisites: CoherenceEdge[];
  /** Edges where this concept is the prerequisite — what it unlocks. */
  dependents: CoherenceEdge[];
  labelOf: (id: string) => string;
  busy: boolean;
  onMapConcept: (id: string) => void;
  onCollapse: () => void;
  onApprove: (edge: CoherenceEdge) => void;
  onReject: (edge: CoherenceEdge) => void;
  onDelete: (edge: CoherenceEdge) => void;
  onHover: (id: string | null) => void;
};

/**
 * Where this concept sits in the curriculum, as one line.
 *
 * Containment used to be drawn as its own nodes and edges, which is what made the old
 * canvas unreadable — hierarchy and dependency competing for the same visual channel.
 * It reads better as a caption than as a picture.
 */
function ancestryLine(node: FocusNode): string {
  const named = node.ancestry.filter((a) => a.type !== 'unit').map((a) => a.label);

  if (named.length > 0) return named.join(' · ');

  // Off-map concepts arrive with no parent chain — they are outside the fetched scope —
  // but the server sends their chapter and subject as names for exactly this case.
  const meta = node.meta as Record<string, unknown>;
  const parts = [meta.subject_name, meta.standard_name && `Grade ${meta.standard_name}`, meta.chapter_name]
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '');

  return parts.join(' · ');
}

function ConceptCardInner({ data, selected }: NodeProps) {
  const d = data as unknown as ConceptCardData;
  const { related } = useContext(MapInteractionContext);
  const node = d.node;

  // Fade only what the hovered concept does NOT touch. An expanded card is never
  // faded: it is the thing being read.
  const dimmed = !d.expanded && related !== null && !related.has(node.id);

  const frame = [
    'group relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-left',
    'transition-opacity duration-150 motion-reduce:transition-none',
    // The reference's stacked-paper edge, flattened into rings: no blur, no gradient.
    node.isRoot
      ? 'shadow-[0_0_0_1px_#4f46e5,3px_3px_0_0_#c7d2fe,6px_6px_0_0_#e0e7ff]'
      : 'shadow-[0_0_0_1px_#e2e8f0,3px_3px_0_0_#f1f5f9,6px_6px_0_0_#f8fafc]',
    selected && !node.isRoot ? 'ring-2 ring-[#4f46e5]' : '',
    dimmed ? 'opacity-30' : 'opacity-100',
  ].join(' ');

  return (
    <div
      className={frame}
      onMouseEnter={() => d.onHover(node.id)}
      onMouseLeave={() => d.onHover(null)}
    >
      {/* The level cue that survives when the card is too small to read. */}
      <span aria-hidden className={`h-1 w-full shrink-0 ${node.isRoot ? 'bg-[#4f46e5]' : 'bg-slate-200'}`} />

      {d.expanded ? <ExpandedBody data={d} /> : <RestingBody data={d} />}

      {/* Drag right edge -> left edge to draw a prerequisite. The DIRECTION MATTERS:
          the drag source is the PREREQUISITE, which is what createRelation expects.
          Reverse it and a wrong curriculum rule is written with no error. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-300 !opacity-0 transition-opacity group-hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#4f46e5] !opacity-0 transition-opacity group-hover:!opacity-100"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function RestingBody({ data: d }: { data: ConceptCardData }) {
  const node = d.node;
  const ancestry = ancestryLine(node);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 px-2.5 py-2">
      {ancestry && (
        <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-500" title={ancestry}>
          {ancestry}
        </p>
      )}

      <p className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-slate-900" title={node.label}>
        {node.label}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1 text-[9px]">
        {node.prereq_count > 0 && (
          <span className="rounded bg-slate-100 px-1 py-px font-medium text-slate-600">
            {node.prereq_count} before
          </span>
        )}
        {node.dependent_count > 0 && (
          <span className="rounded bg-slate-100 px-1 py-px font-medium text-slate-600">
            {node.dependent_count} after
          </span>
        )}
        {node.off_map && <OtherGradeChip />}
        {(node.on_cycle || node.onBothSides) && <LoopChip />}
      </div>

      {node.isRoot ? (
        <p className="flex items-center justify-center gap-1 rounded-md bg-indigo-50 py-1 text-[10px] font-semibold text-indigo-700">
          <Pin size={10} strokeWidth={2.2} aria-hidden />
          Centred
        </p>
      ) : (
        <button
          type="button"
          // nodrag/nopan: with nodesDraggable off, the wrapper no longer carries the
          // no-pan class, so a press anywhere on the card would start a canvas pan.
          className="nodrag nopan flex w-full items-center justify-center gap-1 rounded-md bg-[#4f46e5] py-1 text-[10px] font-semibold text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1"
          onClick={(event) => {
            event.stopPropagation();
            d.onMapConcept(node.id);
          }}
        >
          <Network size={10} strokeWidth={2.2} aria-hidden />
          Map this concept
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function ExpandedBody({ data: d }: { data: ConceptCardData }) {
  const node = d.node;
  const ancestry = ancestryLine(node);
  const description = typeof node.meta.description === 'string' ? node.meta.description : null;

  return (
    <div className="flex min-h-0 flex-1">
      <span aria-hidden className="w-1 shrink-0 bg-[#4f46e5]" />

      {/* nowheel, or scrolling this body zooms the canvas underneath it. */}
      <div className="nowheel nodrag min-w-0 flex-1 overflow-y-auto">
        <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
          <div className="min-w-0">
            {ancestry && (
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {ancestry}
              </p>
            )}
            <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
              {node.label}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* An open card that is not the centre still needs the one action that
                matters - make this the concept the map is about. Without it, reading a
                prerequisite and then wanting to follow it means closing the card first. */}
            {!node.isRoot && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  d.onMapConcept(node.id);
                }}
                className="nodrag nopan inline-flex items-center gap-1 rounded-lg bg-[#4f46e5] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
              >
                <Network size={12} strokeWidth={2.2} aria-hidden />
                Map this concept
              </button>
            )}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                d.onCollapse();
              }}
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
              aria-label="Close this concept"
              title="Close"
            >
              <Minimize2 size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 text-[10px]">
          {node.off_map && <OtherGradeChip />}
          {(node.on_cycle || node.onBothSides) && <LoopChip />}
        </div>

        {description && (
          <p className="px-4 pt-2.5 text-[13px] leading-relaxed text-slate-700">{description}</p>
        )}

        <EdgeGroup
          heading="Must be learned first"
          empty="Nothing has been linked as a prerequisite yet."
          edges={d.prerequisites}
          otherEnd={(edge) => edge.source}
          data={d}
        />

        <EdgeGroup
          heading="This unlocks"
          empty="Nothing depends on this yet."
          edges={d.dependents}
          otherEnd={(edge) => edge.target}
          data={d}
        />

        <p className="px-4 pb-4 pt-1 text-[11px] text-slate-400">
          Drag this card&apos;s right edge onto another to add a prerequisite.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function EdgeGroup({
  heading,
  empty,
  edges,
  otherEnd,
  data: d,
}: {
  heading: string;
  empty: string;
  edges: CoherenceEdge[];
  otherEnd: (edge: CoherenceEdge) => string;
  data: ConceptCardData;
}) {
  return (
    <section className="border-t border-slate-100 px-4 py-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {heading} <span className="tabular-nums text-slate-400">({edges.length})</span>
      </h4>

      {edges.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {edges.map((edge) => {
            const other = otherEnd(edge);
            const suggested = edge.status !== 'approved';
            const reviewable = isReviewableEdge(edge);

            return (
              <li key={edge.id} className="rounded-md border border-slate-200 p-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    d.onMapConcept(other);
                  }}
                  className="nodrag nopan block w-full text-left text-[12.5px] font-medium leading-snug text-slate-800 transition-colors hover:text-[#4f46e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1"
                >
                  {d.labelOf(other)}
                </button>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={[
                      'rounded px-1 py-px text-[9.5px] font-medium',
                      suggested
                        ? 'bg-amber-50 text-amber-800'
                        : edge.source_table === 'expert'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-emerald-50 text-emerald-700',
                    ].join(' ')}
                  >
                    {suggested
                      ? `Suggested by ${edge.tagged_by}`
                      : edge.source_table === 'expert'
                        ? 'Expert'
                        : 'Approved'}
                  </span>

                  {edge.kind === 'cross_curricular' && (
                    <span className="rounded bg-teal-50 px-1 py-px text-[9.5px] font-medium text-teal-700">
                      Related
                    </span>
                  )}

                  {edge.link_type === 'gate' && (
                    <span className="rounded bg-slate-100 px-1 py-px text-[9.5px] font-medium text-slate-600">
                      Blocks
                    </span>
                  )}
                </div>

                {/* The author's reason, where there is one. This is the single most
                    useful thing on the card and the old rail never showed it. */}
                {edge.note && (
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{edge.note}</p>
                )}

                {reviewable && (
                  <div className="mt-1.5 flex items-center gap-1">
                    {suggested && (
                      <ActionButton onClick={() => d.onApprove(edge)} disabled={d.busy} tone="approve">
                        <Check size={11} strokeWidth={2.2} aria-hidden />
                        Approve
                      </ActionButton>
                    )}
                    {suggested && (
                      <ActionButton onClick={() => d.onReject(edge)} disabled={d.busy} tone="plain">
                        <X size={11} strokeWidth={2.2} aria-hidden />
                        Dismiss
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => d.onDelete(edge)} disabled={d.busy} tone="danger">
                      <Trash2 size={11} strokeWidth={2} aria-hidden />
                      Remove
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone: 'approve' | 'plain' | 'danger';
}) {
  const styles = {
    approve: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    plain: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
    danger: 'border-red-200 bg-white text-red-600 hover:bg-red-50',
  }[tone];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`nodrag nopan inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10.5px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1 ${styles}`}
    >
      {children}
    </button>
  );
}

function OtherGradeChip() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px text-[9px] font-medium text-slate-600">
      <ExternalLink size={8} strokeWidth={2} aria-hidden />
      Other grade
    </span>
  );
}

function LoopChip() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-px text-[9px] font-medium text-amber-800"
      title="This is part of a prerequisite loop: two concepts each require the other."
    >
      <RotateCcw size={8} strokeWidth={2} aria-hidden />
      Loop
    </span>
  );
}

export const ConceptCard = memo(ConceptCardInner);

export const nodeTypes = { concept: ConceptCard } as const;
