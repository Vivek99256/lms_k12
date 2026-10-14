'use client';

import { RotateCcw } from 'lucide-react';

import type { ChecklistGroup } from '@/lib/study-document/online';

export interface ChecklistPanelProps {
  groups: ChecklistGroup[];
  /** Keys of the points already ticked. */
  ticked: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** Untick every point shown. */
  onClear: (keys: string[]) => void;
  /** Open the note a point comes from. */
  onOpenPart?: (part: number) => void;
}

/**
 * "I can ..." points to tick off, grouped by topic. The tick is the learner's own place-keeping, kept in this browser only.
 * A native checkbox per point, so a keyboard and a screen reader work without anything extra.
 */
export function ChecklistPanel({ groups, ticked, onToggle, onClear, onOpenPart }: ChecklistPanelProps) {
  const all = groups.flatMap((g) => g.items);
  const done = all.filter((i) => ticked.has(i.id)).length;

  if (all.length === 0) {
    return <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">This document has no checklist.</p>;
  }

  return (
    <section aria-label="Revision checklist" className="space-y-5" data-testid="checklist">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm font-medium text-slate-800">
          {done} of {all.length} ticked
        </p>
        <button
          type="button"
          disabled={done === 0}
          onClick={() => onClear(all.map((i) => i.id))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Start again
        </button>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Checklist progress"
        aria-valuemin={0}
        aria-valuemax={all.length}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${(done / all.length) * 100}%` }} />
      </div>

      {groups.map((group) => (
        <fieldset key={`${group.topicId ?? 'other'}`} className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-indigo-900">{group.topic}</legend>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {group.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                <input
                  id={item.id}
                  type="checkbox"
                  checked={ticked.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-400 accent-indigo-600"
                />
                <label htmlFor={item.id} className="flex-1 text-sm leading-snug text-slate-900">
                  {item.text}
                </label>
                {onOpenPart ? (
                  <button
                    type="button"
                    onClick={() => onOpenPart(item.part)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-600 underline-offset-2 hover:text-indigo-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    {item.partTitle}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-slate-500">{item.partTitle}</span>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </section>
  );
}
