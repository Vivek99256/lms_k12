'use client';

import { useMemo } from 'react';
import { storyMapLayout, type BranchingScenarioSavePayload } from '@/lib/h5p/branching-editor';
import { nodeLabel, plainText } from '@/lib/h5p/branching-scenario';

/**
 * The scenario drawn as a map: steps in columns by how far they are from the
 * start, links as curves, a choice's link labelled with its letter.
 *
 * It exists because a branching scenario is a graph and an outline is a list:
 * the one thing an author cannot see from a list is where two branches rejoin,
 * or that one of them leads nowhere. Every box is a button that selects its step
 * in the editor, so the map is navigation as well as a picture.
 *
 * Shape and the step's word are always shown together -- a screen is a plain
 * box, a decision a diamond-cornered one, an ending a pill -- so the map does not
 * lean on colour alone.
 */

const BOX_W = 150;
const BOX_H = 46;
const GAP_X = 54;
const GAP_Y = 16;

export function StoryMap({
  scenario,
  selected,
  problems,
  onSelect,
}: {
  scenario: BranchingScenarioSavePayload;
  selected: string | null;
  /** Steps with something wrong, for a marker. */
  problems: Set<string>;
  onSelect: (ref: string) => void;
}) {
  const layout = useMemo(() => storyMapLayout(scenario), [scenario]);
  const byRef = useMemo(() => new Map(scenario.nodes.map((n, i) => [n.ref, { node: n, index: i }])), [scenario.nodes]);
  const at = useMemo(() => new Map(layout.positions.map((p) => [p.ref, p])), [layout.positions]);

  const width = Math.max(1, layout.columns) * (BOX_W + GAP_X) - GAP_X + 16;
  const height = Math.max(1, layout.rows) * (BOX_H + GAP_Y) - GAP_Y + 16;
  const x = (column: number) => 8 + column * (BOX_W + GAP_X);
  const y = (row: number) => 8 + row * (BOX_H + GAP_Y);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2" role="group" aria-label="Story map">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          {layout.edges.map((edge, i) => {
            const a = at.get(edge.from);
            const b = at.get(edge.to);
            if (!a || !b) return null;
            const x1 = x(a.column) + BOX_W;
            const y1 = y(a.row) + BOX_H / 2;
            const x2 = x(b.column);
            const y2 = y(b.row) + BOX_H / 2;
            const backwards = b.column <= a.column;
            const mid = (x1 + x2) / 2;
            const d = backwards
              ? `M ${x1} ${y1} C ${x1 + 30} ${y1 - 36}, ${x2 - 30} ${y2 - 36}, ${x2} ${y2}`
              : `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
            return (
              <g key={`${edge.from}-${edge.to}-${i}`}>
                <path d={d} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray={backwards ? '4 3' : undefined} />
                <circle cx={x2} cy={y2} r={2.5} fill="#94a3b8" />
                {edge.choice !== null ? (
                  <text x={x1 + 8} y={y1 + (y2 >= y1 ? 12 : -5)} fontSize={10} fill="#475569" fontWeight={600}>
                    {String.fromCharCode(65 + edge.choice)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {layout.positions.map((p) => {
          const entry = byRef.get(p.ref);
          if (!entry) return null;
          const { node, index } = entry;
          const isSelected = selected === p.ref;
          const wrong = problems.has(p.ref);
          const shape = node.node_type === 'ending' ? 'rounded-full' : node.node_type === 'branching_question' ? 'rounded-md border-l-4' : 'rounded-lg';
          const tone =
            node.node_type === 'ending'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : node.node_type === 'branching_question'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                : 'border-slate-300 bg-white text-slate-800';

          return (
            <button
              key={p.ref}
              type="button"
              onClick={() => onSelect(p.ref)}
              aria-pressed={isSelected}
              title={`${nodeLabel({ title: node.title }, index)}${wrong ? ' — has something to fix' : ''}`}
              className={`absolute flex flex-col justify-center border px-3 text-left text-[11px] leading-tight shadow-sm transition ${shape} ${tone} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : 'hover:shadow'}`}
              style={{ left: x(p.column), top: y(p.row), width: BOX_W, height: BOX_H }}
            >
              <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider opacity-70">
                {index === 0 ? 'Start' : node.node_type === 'ending' ? 'Ending' : node.node_type === 'branching_question' ? 'Decision' : `Step ${index + 1}`}
                {wrong ? <span className="rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">fix</span> : null}
              </span>
              <span className="truncate font-medium">{node.title.trim() || plainText(node.body).slice(0, 28) || 'Untitled'}</span>
            </button>
          );
        })}
      </div>
      {layout.unreachable.length > 0 ? (
        <p className="mt-2 px-1 text-[11px] text-amber-700">
          The boxes in the last column cannot be reached from the start. Link a step or a choice to them, or delete them.
        </p>
      ) : null}
    </div>
  );
}
