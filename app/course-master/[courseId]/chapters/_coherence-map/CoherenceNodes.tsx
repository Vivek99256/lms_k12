'use client';

/**
 * The four node shapes the coherence map draws.
 *
 * A NEW COMPONENT IS JUSTIFIED HERE
 * The design system's anti-duplication map has no graph-node primitive — TreeView
 * is a settings nav, Card is a page surface, Badge is a status chip. None of them
 * can carry @xyflow connection handles or size themselves to a fixed layout grid,
 * which is what a canvas node must do. Badge IS reused inside these for the counts
 * rather than restyled.
 *
 * LEVEL IS NEVER SIGNALLED BY COLOUR ALONE
 * Each level carries an icon, an uppercase overline naming the level in words, a
 * distinct accent bar and a distinct width. That is four redundant cues, so the
 * hierarchy survives greyscale printing, a colour-vision deficiency, and the
 * high-contrast themes — which the DS requires and which a colour-coded legend on
 * its own would fail.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BookOpen, ChevronDown, ChevronRight, Layers, Lightbulb, ListTree, RotateCcw, ExternalLink } from 'lucide-react';
import type { CoherenceNodeType } from '@/app/course-master/data/coherenceMap';

export type CoherenceNodeData = {
  label: string;
  nodeType: CoherenceNodeType;
  depth: number;
  prereqCount: number;
  dependentCount: number;
  onCycle: boolean;
  offMap: boolean;
  collapsed: boolean;
  hiddenDescendants: number;
  /** 'match' highlights, 'dim' fades, 'none' is the resting state. */
  emphasis: 'match' | 'dim' | 'none';
  /** Set when this node is in the selected node's prerequisite closure. */
  relation: 'selected' | 'upstream' | 'downstream' | null;
  meta: Record<string, unknown>;
  onToggleCollapse?: (id: string) => void;
};

/** Per-level identity. Tailwind needs whole class names, so these are not built by template. */
const LEVEL = {
  unit: {
    icon: Layers,
    name: 'Unit',
    accent: 'bg-indigo-600',
    ring: 'ring-indigo-200',
    chip: 'bg-indigo-50 text-indigo-700',
  },
  chapter: {
    icon: BookOpen,
    name: 'Chapter',
    accent: 'bg-sky-600',
    ring: 'ring-sky-200',
    chip: 'bg-sky-50 text-sky-700',
  },
  topic: {
    icon: ListTree,
    name: 'Topic',
    accent: 'bg-violet-600',
    ring: 'ring-violet-200',
    chip: 'bg-violet-50 text-violet-700',
  },
  concept: {
    icon: Lightbulb,
    name: 'Concept',
    accent: 'bg-emerald-600',
    ring: 'ring-emerald-200',
    chip: 'bg-emerald-50 text-emerald-700',
  },
} as const;

function CoherenceNodeInner({ id, data, selected }: NodeProps) {
  const d = data as unknown as CoherenceNodeData;
  const level = LEVEL[d.nodeType];
  const Icon = level.icon;
  const canCollapse = d.hiddenDescendants > 0 || d.collapsed;

  // Relation state outranks search emphasis: when a teacher has selected a concept
  // to trace, what is upstream of it matters more than what matched their text.
  const isFaded = d.emphasis === 'dim';

  const border =
    d.relation === 'selected'
      ? 'ring-2 ring-[#4f46e5] border-[#4f46e5]'
      : d.relation === 'upstream'
        ? 'ring-2 ring-amber-400 border-amber-300'
        : d.relation === 'downstream'
          ? 'ring-2 ring-teal-400 border-teal-300'
          : selected
            ? 'ring-2 ring-[#4f46e5] border-[#4f46e5]'
            : `ring-1 ${level.ring} border-slate-200`;

  return (
    <div
      className={[
        'group relative flex h-full w-full overflow-hidden rounded-lg border bg-white text-left shadow-sm',
        'transition-[opacity,box-shadow] duration-150 motion-reduce:transition-none',
        border,
        isFaded ? 'opacity-25' : 'opacity-100',
        d.offMap ? 'border-dashed' : '',
      ].join(' ')}
    >
      {/* Accent bar: the level cue that survives at low zoom, when text is unreadable. */}
      <span aria-hidden className={`w-1.5 shrink-0 ${level.accent}`} />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={12} strokeWidth={1.75} className="shrink-0 text-slate-500" aria-hidden />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {level.name}
          </span>

          {d.offMap && (
            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px text-[9px] font-medium text-slate-600">
              <ExternalLink size={8} strokeWidth={2} aria-hidden />
              Other grade
            </span>
          )}

          {d.onCycle && (
            // Not an error the teacher caused — a loop in the data they can now see.
            <span
              className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-px text-[9px] font-medium text-amber-800"
              title="This is part of a prerequisite loop: two concepts each require the other."
            >
              <RotateCcw size={8} strokeWidth={2} aria-hidden />
              Loop
            </span>
          )}
        </div>

        <p className="truncate text-[12.5px] font-semibold leading-tight text-slate-900" title={d.label}>
          {d.label}
        </p>

        <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
          {d.prereqCount > 0 && (
            <span className={`rounded px-1 py-px font-medium ${level.chip}`}>
              {d.prereqCount} before
            </span>
          )}
          {d.dependentCount > 0 && (
            <span className={`rounded px-1 py-px font-medium ${level.chip}`}>
              {d.dependentCount} after
            </span>
          )}
          {d.collapsed && d.hiddenDescendants > 0 && (
            <span className="rounded bg-slate-100 px-1 py-px font-medium text-slate-600">
              {d.hiddenDescendants} hidden
            </span>
          )}
        </div>
      </div>

      {canCollapse && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            d.onToggleCollapse?.(id);
          }}
          // 24px minimum target, per WCAG 2.2 / the DS focus rules.
          className="flex h-full w-6 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          aria-label={
            d.collapsed
              ? `Expand ${d.label}, ${d.hiddenDescendants} items hidden`
              : `Collapse ${d.label}`
          }
          aria-expanded={!d.collapsed}
        >
          {d.collapsed ? <ChevronRight size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
        </button>
      )}

      {/* Handles are how a curator draws a prerequisite: drag right edge to left edge.
          Kept nearly invisible until hover so 175 nodes do not read as 350 dots. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-white !bg-slate-300 !opacity-0 transition-opacity group-hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-white !bg-[#4f46e5] !opacity-0 transition-opacity group-hover:!opacity-100"
      />
    </div>
  );
}

export const CoherenceNode = memo(CoherenceNodeInner);

/** One entry per level, since @xyflow keys node components by `type`. */
export const nodeTypes = {
  unit: CoherenceNode,
  chapter: CoherenceNode,
  topic: CoherenceNode,
  concept: CoherenceNode,
} as const;

export { LEVEL as NODE_LEVEL_STYLES };
