'use client';

/**
 * Static colour/shape key for the Knowledge Graph canvas. Node colours and
 * edge dash/solid meanings are decided once, in design-system.ts, so the
 * canvas, the legend and the inspector drawer can never show three
 * different keys for the same thing.
 */

import { ListTree } from 'lucide-react';
import SectionCard from './SectionCard';
import { EDGE_COLOR, KIND_CIRCLE } from './design-system';
import { NODE_KIND_LABEL, type GraphNodeKind } from './graph-model';

const NODE_KINDS: GraphNodeKind[] = ['unit', 'chapter', 'topic', 'concept'];

const EDGE_KINDS: { label: string; style: React.CSSProperties }[] = [
  { label: 'Containment (Curriculum → Concept)', style: { backgroundColor: EDGE_COLOR.hierarchy } },
  { label: 'Prerequisite — curator-approved', style: { backgroundColor: EDGE_COLOR.prerequisite } },
  { label: 'Prerequisite — unreviewed AI suggestion', style: { borderTop: `2px dashed ${EDGE_COLOR.aiSuggested}` } },
  { label: 'Cross-curricular', style: { borderTop: `2px dotted ${EDGE_COLOR.crossCurricular}` } },
];

export default function GraphLegend() {
  return (
    <SectionCard title="Legend" icon={ListTree} accent="brand">
      <div className="space-y-2">
        {NODE_KINDS.map((kind) => {
          const circle = KIND_CIRCLE[kind];
          return (
            <div key={kind} className="flex items-center gap-2 text-sm text-slate-700">
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${circle.bg}`} aria-hidden="true" />
              {NODE_KIND_LABEL[kind]}
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
        {EDGE_KINDS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block h-0.5 w-8" style={item.style} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
