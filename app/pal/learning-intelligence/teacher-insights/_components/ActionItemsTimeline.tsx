'use client';

/**
 * Two real, verified lists, not an invented chronology — this scope has no
 * per-event timestamp log, so "timeline" here means "ordered by urgency",
 * never a fabricated date axis.
 *
 *   - Class-level action items (StudentActivityReportService::
 *     classActionItems()) — plain-language flags, shown as-is.
 *   - The per-student roster (buildCohortRoster()), bucketed
 *     stuck/declining first — the real "who needs intervention" list.
 */

import { AlertOctagon, CheckCircle2, Circle, ListTodo, TrendingDown, Users2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SectionCard from '../../_components/SectionCard';
import type { RosterBucket, RosterRow } from '../../data/teacher-insights';

const BUCKET_META: Record<RosterBucket, { label: string; icon: React.ReactNode; className: string; priority: number }> = {
  stuck: { label: 'Stuck', icon: <AlertOctagon className="h-4 w-4" />, className: 'border-amber-300 bg-amber-50 text-amber-700', priority: 0 },
  declining: { label: 'Declining', icon: <TrendingDown className="h-4 w-4" />, className: 'border-rose-300 bg-rose-50 text-rose-700', priority: 1 },
  learning: { label: 'Learning', icon: <Circle className="h-4 w-4" />, className: 'border-indigo-300 bg-indigo-50 text-indigo-700', priority: 2 },
  not_started: { label: 'Not started', icon: <Circle className="h-4 w-4" />, className: 'border-slate-300 bg-slate-100 text-slate-500', priority: 3 },
  mastered: { label: 'Mastered', icon: <CheckCircle2 className="h-4 w-4" />, className: 'border-emerald-300 bg-emerald-50 text-emerald-700', priority: 4 },
};

export default function ActionItemsTimeline({
  actionItems,
  roster,
  onSelectStudent,
}: {
  actionItems: string[];
  roster: RosterRow[];
  onSelectStudent: (studentId: number) => void;
}) {
  const sorted = [...roster].sort((a, b) => BUCKET_META[a.bucket].priority - BUCKET_META[b.bucket].priority);
  const needingAttention = sorted.filter((r) => r.bucket === 'stuck' || r.bucket === 'declining');

  return (
    <div className="space-y-4">
      {actionItems.length > 0 ? (
        <SectionCard title="Class-wide flags" icon={ListTodo} accent="warning">
          <ul className="space-y-1.5 text-sm text-slate-700">
            {actionItems.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Students, by status"
        icon={Users2}
        accent="brand"
        action={needingAttention.length > 0 ? <Badge className="bg-amber-100 text-amber-800">{needingAttention.length} need attention</Badge> : undefined}
      >
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No students enrolled in this scope.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((row) => {
              const meta = BUCKET_META[row.bucket];
              return (
                <li key={row.studentId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 text-sm text-slate-700">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${meta.className}`}>{meta.icon}</span>
                    <span>{row.name ?? `Student #${row.studentId}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                      {row.masteredPct != null ? ` · ${Math.round(row.masteredPct)}%` : ''}
                    </Badge>
                    <Button size="sm" variant="ghost" className="text-slate-500 hover:text-slate-900" onClick={() => onSelectStudent(row.studentId)}>
                      View
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
