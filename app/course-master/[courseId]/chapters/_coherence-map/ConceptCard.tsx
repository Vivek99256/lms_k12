'use client';

/**
 * One concept on the focus map, at either of its two sizes.
 *
 * REDESIGNED v2:
 *   - When expanded === true, the card shows an ELEVATED RING HIGHLIGHT rather
 *     than ExpandedBody inline. The ExpandedBody has moved to DetailsPanel.
 *   - ExpandedBody, EdgeGroup, and ActionButton are exported so DetailsPanel
 *     can import and render them.
 *   - All ConceptCardData fields, MapInteractionContext usage, both Handles,
 *     onHover/onMapConcept/onCollapse callbacks, and badge components are
 *     100% preserved.
 */

import { memo, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Brain,
  Check,
  ExternalLink,
  Minimize2,
  Network,
  Pin,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  ArrowRight,
} from 'lucide-react';

import { isReviewableEdge, type CoherenceEdge } from '@/app/course-master/data/coherenceMap';

import {
  capitalize,
  conceptGlance,
  difficultyChipClass,
  useConceptIntelligenceEntry,
} from './conceptIntelligence';
import { colorForId, glowRgb } from './colorPalette';
import { ConceptIntelligenceSection } from './ConceptIntelligenceSection';
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

const ACCENT = '#059669';

const CARD_SHADOW =
  'shadow-[0_2px_8px_rgba(15,23,42,0.06),0_0_16px_rgba(var(--glow),0.18)]';
const CARD_SHADOW_HOVER =
  'hover:shadow-[0_12px_28px_rgba(15,23,42,0.12),0_0_24px_rgba(var(--glow),0.3)]';
const ROOT_SHADOW =
  'shadow-[0_0_0_2px_#059669,0_8px_24px_rgba(5,150,105,0.22),0_1px_3px_rgba(15,23,42,0.08)]';
const ROOT_SHADOW_HOVER =
  'hover:shadow-[0_0_0_2.5px_#059669,0_14px_32px_rgba(5,150,105,0.32)]';

const CARD_EASE = 'ease-[cubic-bezier(0.59,0.03,0.43,0.99)]';

export function ancestryLine(node: FocusNode): string {
  const named = node.ancestry.filter((a) => a.type !== 'unit').map((a) => a.label);
  if (named.length > 0) return named.join(' · ');

  const meta = node.meta as Record<string, unknown>;
  const parts = [meta.subject_name, meta.standard_name && `Grade ${meta.standard_name}`, meta.chapter_name]
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  return parts.join(' · ');
}

export function chapterColor(node: FocusNode): string {
  const chapter =
    node.ancestry.find((a) => a.type === 'chapter') ??
    node.ancestry.find((a) => a.type === 'topic') ??
    node.ancestry.find((a) => a.type === 'unit');
  return colorForId(chapter?.id ?? node.id);
}

export function Badge({
  children,
  tone,
  dot,
}: {
  children: React.ReactNode;
  tone: 'neutral' | 'amber' | 'emerald' | 'teal' | 'rose' | 'sky' | 'indigo';
  dot?: string;
}) {
  const toneClass = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    teal: 'bg-teal-50 text-teal-800 border-teal-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
  }[tone];

  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold whitespace-nowrap shadow-2xs ${toneClass}`}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </span>
  );
}

export function OtherGradeChip() {
  return (
    <Badge tone="neutral">
      <ExternalLink size={9} strokeWidth={2} aria-hidden />
      Other grade
    </Badge>
  );
}

export function LoopChip() {
  return (
    <span title="This is part of a prerequisite loop: two concepts each require the other.">
      <Badge tone="amber">
        <RotateCcw size={9} strokeWidth={2} aria-hidden />
        Prerequisite Loop
      </Badge>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ConceptCardInner({ data, selected }: NodeProps) {
  const d = data as unknown as ConceptCardData;
  const { related } = useContext(MapInteractionContext);
  const node = d.node;

  const dimmed = !d.expanded && related !== null && !related.has(node.id);
  const cardGlow = node.isRoot ? null : glowRgb(chapterColor(node));

  const frame = [
    'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-left',
    `transition-all duration-300 ${CARD_EASE} motion-reduce:transition-none`,
    node.isRoot
      ? `${ROOT_SHADOW} ${ROOT_SHADOW_HOVER} ring-2 ring-emerald-500`
      : `border border-slate-200/90 ${CARD_SHADOW} ${CARD_SHADOW_HOVER} hover:border-slate-300`,
    // When expanded: show elevated highlight ring instead of ExpandedBody
    d.expanded && !node.isRoot
      ? 'ring-[3px] ring-offset-2 ring-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.3),0_16px_40px_rgba(15,23,42,0.18)]'
      : '',
    !d.expanded ? 'hover:-translate-y-1' : '',
    dimmed ? 'opacity-25' : 'opacity-100',
  ].join(' ');

  return (
    <div
      className={frame}
      style={cardGlow ? ({ '--glow': cardGlow } as unknown as React.CSSProperties) : undefined}
      onMouseEnter={() => d.onHover(node.id)}
      onMouseLeave={() => d.onHover(null)}
    >
      {d.expanded ? <ExpandedBody data={d} /> : <RestingBody data={d} />}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400 !shadow-sm transition-transform duration-150 group-hover:scale-125"
        title="Prerequisite input"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-600 !shadow-sm transition-transform duration-150 group-hover:scale-125"
        title="Unlocks output"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RestingBody({ data: d }: { data: ConceptCardData }) {
  const node = d.node;
  const ancestry = ancestryLine(node);
  const meta = node.meta as Record<string, unknown>;
  const chapterId = typeof meta.chapter_id === 'number' ? meta.chapter_id : null;
  const { entry } = useConceptIntelligenceEntry(chapterId, node.label);
  const glance = conceptGlance(entry);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col justify-between">
      {/* Top Header Badge */}
      <div className="flex min-w-0 items-center justify-between gap-1 px-2.5 pt-2">
        {node.isRoot ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white shadow-2xs">
            <Sparkles size={9} strokeWidth={2.4} aria-hidden />
            <span>Current Focus</span>
          </span>
        ) : ancestry ? (
          <Badge tone="neutral" dot={chapterColor(node)}>
            <span className="max-w-[140px] truncate">{ancestry}</span>
          </Badge>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Concept</span>
        )}

        {/* Distance / Role Indicator */}
        {!node.isRoot && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {node.distance < 0 ? 'Prereq' : node.distance > 0 ? 'Unlocks' : ''}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="px-2.5 py-1">
        <p
          className={`line-clamp-2 text-[12px] font-semibold leading-tight ${
            node.isRoot ? 'text-emerald-950 font-bold' : 'text-slate-800 group-hover:text-slate-950'
          }`}
          title={node.label}
        >
          {node.label}
        </p>
      </div>

      {/* Status Chips */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 pb-1.5">
        {node.prereq_count > 0 && <Badge tone="sky">← {node.prereq_count}</Badge>}
        {node.dependent_count > 0 && <Badge tone="teal">{node.dependent_count} →</Badge>}
        {node.off_map && <OtherGradeChip />}
        {(node.on_cycle || node.onBothSides) && <LoopChip />}
        {glance?.difficulty && (
          <Badge
            tone={
              glance.difficulty.toLowerCase() === 'hard'
                ? 'rose'
                : glance.difficulty.toLowerCase() === 'easy'
                  ? 'emerald'
                  : 'amber'
            }
          >
            <Brain size={8} strokeWidth={2.2} aria-hidden />
            {capitalize(glance.difficulty)}
          </Badge>
        )}
      </div>

      {/* Footer Action Bar */}
      {node.isRoot ? (
        <div className="flex w-full items-center justify-center gap-1.5 border-t border-emerald-100 bg-emerald-50/70 py-1.5 text-[10.5px] font-bold text-emerald-800">
          <Pin size={11} strokeWidth={2.4} aria-hidden />
          <span>Active Concept</span>
        </div>
      ) : (
        <button
          type="button"
          className="nodrag nopan flex w-full items-center justify-center gap-1 border-t border-slate-100 bg-slate-50/80 py-1.5 text-[10.5px] font-semibold text-[#059669] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#059669]"
          onClick={(event) => {
            event.stopPropagation();
            d.onMapConcept(node.id);
          }}
        >
          <Network size={11} strokeWidth={2.2} aria-hidden />
          <span>Map this concept</span>
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* ExpandedBody — exported so DetailsPanel can render it                   */
/* ──────────────────────────────────────────────────────────────────────── */

export function ExpandedBody({ data: d }: { data: ConceptCardData }) {
  const node = d.node;
  const ancestry = ancestryLine(node);
  const description = typeof node.meta.description === 'string' ? node.meta.description : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="nowheel nodrag min-h-0 flex-1 overflow-y-auto">
        {/* Header with Title and Action buttons */}
        <div className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div className="min-w-0">
            {node.isRoot ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-2xs mb-1.5">
                <Sparkles size={10} strokeWidth={2.4} aria-hidden />
                <span>Current Focus</span>
              </span>
            ) : ancestry ? (
              <Badge tone="neutral" dot={chapterColor(node)}>
                <span className="truncate">{ancestry}</span>
              </Badge>
            ) : null}

            <h3 className="mt-1 text-[20px] font-bold leading-snug tracking-tight text-slate-900">
              {node.label}
            </h3>
          </div>

          <div className="col-start-2 flex shrink-0 items-center gap-2 self-start justify-self-end">
            {!node.isRoot && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  d.onMapConcept(node.id);
                }}
                className="nodrag nopan inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: ACCENT }}
              >
                <Network size={13} strokeWidth={2.2} aria-hidden />
                <span>Map this concept</span>
              </button>
            )}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                d.onCollapse();
              }}
              className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="Close this concept"
              title="Close"
            >
              <Minimize2 size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Status flags */}
        {(node.off_map || node.on_cycle || node.onBothSides) && (
          <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
            {node.off_map && <OtherGradeChip />}
            {(node.on_cycle || node.onBothSides) && <LoopChip />}
          </div>
        )}

        {description && (
          <p className="px-5 pt-3 text-[13.5px] leading-relaxed text-slate-600">{description}</p>
        )}

        {/* Concept Intelligence */}
        <ConceptIntelligenceSection node={node} />

        {/* Prerequisites */}
        <EdgeGroup
          heading="Must be learned first (Prerequisites)"
          empty="Nothing has been linked as a prerequisite yet."
          edges={d.prerequisites}
          otherEnd={(edge) => edge.source}
          data={d}
        />

        {/* Dependents / Unlocks */}
        <EdgeGroup
          heading="This unlocks (Dependents)"
          empty="Nothing depends on this yet."
          edges={d.dependents}
          otherEnd={(edge) => edge.target}
          data={d}
        />
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Drag right handle onto another card to link as prerequisite.</span>
        <span className="font-semibold text-emerald-700">Click &apos;Map this concept&apos; to re-center</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* EdgeGroup — exported so DetailsPanel can import it                      */
/* ──────────────────────────────────────────────────────────────────────── */

export function EdgeGroup({
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
    <section className="border-t border-slate-100 px-5 py-3.5">
      <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
        <span>{heading}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {edges.length}
        </span>
      </h4>

      {edges.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-slate-400 italic">{empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {edges.map((edge) => {
            const other = otherEnd(edge);
            const suggested = edge.status !== 'approved';
            const reviewable = isReviewableEdge(edge);

            return (
              <li
                key={edge.id}
                className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 transition-all duration-150 hover:bg-white hover:border-slate-300 hover:shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      d.onMapConcept(other);
                    }}
                    className="nodrag nopan text-left text-[13px] font-bold leading-snug text-slate-800 transition-colors hover:text-[#059669] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    {d.labelOf(other)}
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      d.onMapConcept(other);
                    }}
                    className="nodrag nopan inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-emerald-700"
                  >
                    <span>Jump</span>
                    <ArrowRight size={10} />
                  </button>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={suggested ? 'amber' : edge.source_table === 'expert' ? 'neutral' : 'emerald'}>
                    {suggested
                      ? `Suggested by ${edge.tagged_by}`
                      : edge.source_table === 'expert'
                        ? 'Expert'
                        : 'Approved'}
                  </Badge>

                  {edge.kind === 'cross_curricular' && <Badge tone="teal">Cross-Curricular</Badge>}
                  {edge.link_type === 'gate' && <Badge tone="neutral">Blocks Next</Badge>}
                </div>

                {edge.note && (
                  <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500 bg-white/70 p-1.5 rounded-lg border border-slate-100">
                    {edge.note}
                  </p>
                )}

                {reviewable && (
                  <div className="mt-2 flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60">
                    {suggested && (
                      <ActionButton onClick={() => d.onApprove(edge)} disabled={d.busy} tone="approve">
                        <Check size={12} strokeWidth={2.4} aria-hidden />
                        Approve
                      </ActionButton>
                    )}
                    {suggested && (
                      <ActionButton onClick={() => d.onReject(edge)} disabled={d.busy} tone="plain">
                        <X size={12} strokeWidth={2.4} aria-hidden />
                        Dismiss
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => d.onDelete(edge)} disabled={d.busy} tone="danger">
                      <Trash2 size={12} strokeWidth={2.4} aria-hidden />
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

/* ──────────────────────────────────────────────────────────────────────── */
/* ActionButton — exported so DetailsPanel can import it                   */
/* ──────────────────────────────────────────────────────────────────────── */

export function ActionButton({
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
    approve: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    plain: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[tone];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`nodrag nopan inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold shadow-2xs transition-all duration-150 active:scale-95 disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export const ConceptCard = memo(ConceptCardInner);

export const nodeTypes = { concept: ConceptCard } as const;
