'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock, Loader2, Star, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  fetchConceptDiagnosticSummary,
  type ConceptDiagnosticEntry,
  type ConceptDiagnosticStatus,
  type ConceptDiagnosticSummary,
} from '@/app/pal/journey/data/concept-diagnostic-summary';

/**
 * The Concept Diagnostic step's all-concepts summary + drawer — rendered by
 * `MilestoneDetailPanel` only when the selected milestone is 'adaptive'.
 *
 * Fetches independently of `fetchJourneyData` (see
 * `concept-diagnostic-summary.ts`'s header for why), on its own mount/unmount
 * lifecycle, so chapters nobody expands this step for never pay for the two
 * extra calls. Mounting IS the trigger — no separate "active" flag needed,
 * since the parent already only renders this component for the one relevant
 * milestone.
 */
export interface ConceptDiagnosticPanelProps {
  chapterId: string;
}

const STATUS_META: Record<
  ConceptDiagnosticStatus,
  { label: string; dot: string; badgeBg: string; badgeText: string; icon: typeof CheckCircle2 }
> = {
  completed: { label: 'Completed', dot: 'bg-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', icon: CheckCircle2 },
  needs_improvement: { label: 'Needs improvement', dot: 'bg-rose-500', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700', icon: TrendingDown },
  pending: { label: 'Pending', dot: 'bg-slate-400', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600', icon: Clock },
};

type Filter = 'all' | ConceptDiagnosticStatus;

export function ConceptDiagnosticPanel({ chapterId }: ConceptDiagnosticPanelProps) {
  const [summary, setSummary] = useState<ConceptDiagnosticSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const controller = new AbortController();

    // Deferred — the same convention `MountainJourneyView.tsx` uses, and
    // what react-hooks/set-state-in-effect enforces.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      fetchConceptDiagnosticSummary(chapterId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSummary(result);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Couldn’t load concept progress.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        Loading concept progress…
      </div>
    );
  }

  if (error || !summary || summary.total === 0) {
    return null; // Non-blocking: the rest of the detail panel still renders fine without this.
  }

  const filteredConcepts = summary.concepts.filter((entry) => filter === 'all' || entry.status === filter);

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-extrabold leading-none text-indigo-700">
            {summary.completed}
            <span className="text-base font-semibold text-indigo-400">/{summary.total}</span>
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">concepts completed</p>
        </div>

        {summary.currentConceptName && (
          <div className="rounded-lg bg-white/80 px-2.5 py-1.5 text-xs shadow-sm">
            <span className="text-slate-500">Current concept</span>{' '}
            <span className="font-semibold text-slate-800">{summary.currentConceptName}</span>
          </div>
        )}

        <Button size="sm" variant="outline" className="bg-white" onClick={() => setDrawerOpen(true)}>
          View all {summary.total} concepts
          <ChevronRight aria-hidden className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <StatPill colorClass="bg-emerald-500" label="Completed" count={summary.completed} />
        <StatPill colorClass="bg-rose-500" label="Needs improvement" count={summary.needsImprovement} />
        <StatPill colorClass="bg-slate-400" label="Pending" count={summary.pending} />
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>All concepts{summary.chapterName ? ` — ${summary.chapterName}` : ''}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
            <FilterChip label="All" count={summary.total} active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterChip
              label="Completed"
              count={summary.completed}
              active={filter === 'completed'}
              onClick={() => setFilter('completed')}
            />
            <FilterChip
              label="Needs improvement"
              count={summary.needsImprovement}
              active={filter === 'needs_improvement'}
              onClick={() => setFilter('needs_improvement')}
            />
            <FilterChip
              label="Pending"
              count={summary.pending}
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
            />
          </div>

          <ul className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1 py-2">
            {filteredConcepts.map((entry, index) => (
              <ConceptRow key={entry.conceptId} entry={entry} index={index + 1} />
            ))}
            {filteredConcepts.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No concepts in this status.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatPill({ colorClass, label, count }: { colorClass: string; label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-sm">
      <span className={cn('h-2 w-2 rounded-full', colorClass)} />
      <span className="text-slate-700">{label}</span>
      <span className="text-slate-500">{count}</span>
    </span>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        active ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      )}
    >
      {label} ({count})
    </button>
  );
}

function ConceptRow({ entry, index }: { entry: ConceptDiagnosticEntry; index: number }) {
  const meta = STATUS_META[entry.status];
  const Icon = meta.icon;

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-lg border p-2.5',
        entry.isCurrent ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-white'
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
        {index}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-800">{entry.name}</p>
          {entry.isCurrent && (
            <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
              Current
            </span>
          )}
        </div>
        <div className={cn('mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', meta.badgeBg, meta.badgeText)}>
          <Icon aria-hidden className="h-3 w-3" />
          {meta.label}
          {entry.score != null && <span className="opacity-75">· {entry.score}%</span>}
        </div>
      </div>

      {/* Mastery is shown separately from diagnostic status — a concept can be mastered without this status being "Completed", or vice versa. */}
      {entry.mastered && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
          <Star aria-hidden className="h-3 w-3 fill-amber-500 text-amber-500" />
          Mastered
        </span>
      )}
    </li>
  );
}
