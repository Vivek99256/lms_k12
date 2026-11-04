'use client';

import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SectionCard from '../../_components/SectionCard';
import type { TopMisconception } from '../../data/teacher-insights';

/** Recurring misconceptions for the selected class, from pal_misconception_library via misconceptionAnalysis(). */
export default function MisconceptionBoard({ items }: { items: TopMisconception[] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Recurring misconceptions" icon={AlertCircle} accent="danger">
        <p className="text-sm text-slate-500">No active misconceptions flagged for this class right now.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Recurring misconceptions" icon={AlertCircle} accent="danger">
      <ul className="space-y-2.5">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-amber-900">{m.description ?? m.tag}</span>
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                {m.detectionCount} flagged
              </Badge>
            </div>
            {m.correctiveAction ? <p className="mt-1 text-xs text-amber-700/80">{m.correctiveAction}</p> : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
