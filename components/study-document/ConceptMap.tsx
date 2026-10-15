'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Network } from 'lucide-react';

import type { ConceptMap as Graph, MapNode } from '@/lib/study-document/journey';
import { ENTER } from './JourneyFrame';

export interface ConceptMapProps {
  graph: Graph;
  done: boolean;
  /** Called once, when the learner has looked at enough ideas to have seen how they connect. */
  onDone: () => void;
}

const W = 200;
const H = 58;
const GAP_X = 74;
const GAP_Y = 16;

/** A name broken into at most two lines of about 24 characters, so a long concept name still fits its box. */
function lines(name: string): string[] {
  const words = name.split(' ');
  const out: string[] = [''];
  for (const w of words) {
    const last = out.length - 1;
    if ((out[last] + ' ' + w).trim().length <= 24 || out[last] === '') out[last] = (out[last] + ' ' + w).trim();
    else if (out.length < 2) out.push(w);
    else out[1] = (out[1] + ' ' + w).trim();
  }
  if (out[1] && out[1].length > 26) out[1] = `${out[1].slice(0, 25)}…`;

  return out;
}

/** How many ideas a learner looks at before the map counts as explored: three, or all of them in a smaller map. */
export const mapGoal = (graph: Graph): number => Math.min(graph.nodes.length, 3);

/**
 * How the ideas of a topic depend on each other, drawn left to right: an idea sits to the right of the ideas needed to
 * understand it, with an arrow from each. Select an idea (or press Enter on it) to light up what it needs and what needs it,
 * and read it. The ideas and the links are the document's own; nothing here is guessed.
 */
export function ConceptMap({ graph, done, onDone }: ConceptMapProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [visited, setVisited] = useState<number[]>([]);
  const layout = useMemo(() => {
    const columns: MapNode[][] = Array.from({ length: graph.depths }, () => []);
    for (const n of graph.nodes) columns[n.depth].push(n);
    const tallest = Math.max(...columns.map((c) => c.length));
    const height = tallest * (H + GAP_Y) + GAP_Y;
    const pos = new Map<number, { x: number; y: number }>();
    columns.forEach((col, ci) => {
      const offset = (height - col.length * (H + GAP_Y) + GAP_Y) / 2;
      col.forEach((n, ri) => pos.set(n.conceptId, { x: GAP_Y + ci * (W + GAP_X), y: offset + ri * (H + GAP_Y) }));
    });

    return { pos, width: GAP_Y * 2 + graph.depths * W + (graph.depths - 1) * GAP_X, height };
  }, [graph]);

  const picked = graph.nodes.find((n) => n.conceptId === selected) ?? null;
  const needs = new Set(graph.edges.filter((e) => e.to === selected).map((e) => e.from));
  const leadsTo = new Set(graph.edges.filter((e) => e.from === selected).map((e) => e.to));
  const name = (id: number) => graph.nodes.find((n) => n.conceptId === id)?.name ?? '';
  const goal = mapGoal(graph);
  const finished = done || visited.length >= goal;

  const choose = (id: number) => {
    setSelected(id);
    // Reported from the event, not from inside the state update: a parent must not be changed while this component renders.
    const next = visited.includes(id) ? visited : [...visited, id];
    setVisited(next);
    if (next.length >= goal && !done) onDone();
  };

  return (
    <section aria-label="How the ideas connect" className={`space-y-3 rounded-2xl border-2 border-sd-line bg-white p-4 shadow-sm sm:p-5 ${ENTER}`} data-testid="concept-map">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Network className="h-4 w-4 text-sd-accent" aria-hidden="true" />
            How the ideas connect
          </h3>
          <p className="text-sm text-slate-700">An arrow points from an idea to the idea that needs it. Select an idea to see what it needs and what it leads to.</p>
        </div>
        <span role="status" className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${finished ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-sd-line bg-sd-softer text-sd-strong'}`}>
          {finished ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {finished ? 'Explored' : `Looked at ${visited.length} of ${goal}`}
        </span>
      </header>

      <div role="region" aria-label="Concept map" tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} className="block max-w-none" role="group" aria-label="Ideas and what each one needs">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="fill-slate-400" />
            </marker>
            <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="fill-sd-accent" />
            </marker>
          </defs>
          {graph.edges.map((e) => {
            const a = layout.pos.get(e.from);
            const b = layout.pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + W;
            const y1 = a.y + H / 2;
            const x2 = b.x;
            const y2 = b.y + H / 2;
            const mid = (x1 + x2) / 2;
            const on = selected !== null && (e.to === selected || e.from === selected);

            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2 - 2} ${y2}`}
                fill="none"
                strokeWidth={on ? 2.5 : 1.5}
                markerEnd={on ? 'url(#arrow-on)' : 'url(#arrow)'}
                className={`transition-all duration-300 motion-reduce:transition-none ${on ? 'stroke-sd-accent' : selected !== null ? 'stroke-slate-300' : 'stroke-slate-400'}`}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const p = layout.pos.get(n.conceptId);
            if (!p) return null;
            const isSel = selected === n.conceptId;
            const related = needs.has(n.conceptId) || leadsTo.has(n.conceptId);
            const seen = visited.includes(n.conceptId);
            const t = lines(n.name);

            return (
              <g
                key={n.conceptId}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${n.name}.${needs.has(n.conceptId) ? ' Needed for the selected idea.' : ''}${leadsTo.has(n.conceptId) ? ' Needs the selected idea.' : ''}${seen ? ' Looked at.' : ''}`}
                onClick={() => choose(n.conceptId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(n.conceptId);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-sd-accent [&:focus-visible>rect]:stroke-[3]"
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={W}
                  height={H}
                  rx={12}
                  strokeWidth={isSel ? 3 : 1.5}
                  className={`transition-all duration-300 motion-reduce:transition-none ${isSel ? 'fill-sd-accent stroke-sd-strong' : related ? 'fill-sd-soft stroke-sd-accent' : seen ? 'fill-emerald-50 stroke-emerald-400' : 'fill-white stroke-slate-300'}`}
                />
                <text x={p.x + 12} y={p.y + (t.length === 1 ? H / 2 + 5 : H / 2 - 5)} fontSize={13} fontWeight={600} className={isSel ? 'fill-white' : 'fill-slate-900'}>
                  {t.map((l, i) => (
                    <tspan key={i} x={p.x + 12} dy={i === 0 ? 0 : 17}>
                      {l}
                    </tspan>
                  ))}
                </text>
                {seen && !isSel ? <circle cx={p.x + W - 12} cy={p.y + 12} r={5} className="fill-emerald-600" /> : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-slate-600 sm:hidden">Swipe sideways to see the whole map.</p>

      <div role="region" aria-label="About the selected idea" aria-live="polite" className={`rounded-xl border-2 p-3 text-sm ${picked ? 'border-sd-accent bg-sd-softer' : 'border-dashed border-sd-line bg-white'}`}>
        {picked ? (
          <div key={picked.conceptId} className={ENTER}>
            <p className="font-semibold text-slate-900">{picked.name}</p>
            <p className="mt-1 text-slate-800">{picked.essential}</p>
            <p className="mt-2 text-xs text-slate-700">
              <span className="font-semibold">Needs: </span>
              {needs.size > 0 ? Array.from(needs).map(name).join(', ') : 'nothing else in this topic'}
              <span className="mx-2" aria-hidden="true">
                |
              </span>
              <span className="font-semibold">Leads to: </span>
              {leadsTo.size > 0 ? Array.from(leadsTo).map(name).join(', ') : 'nothing further in this topic'}
            </p>
          </div>
        ) : (
          <p className="text-slate-700">Select an idea to read it and see how it connects.</p>
        )}
      </div>
    </section>
  );
}
