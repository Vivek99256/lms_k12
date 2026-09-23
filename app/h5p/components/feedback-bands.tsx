'use client';

import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FeedbackBand } from '../data/h5p-content-types';
import { Input } from '@/components/ui/input';

/**
 * H5P `overallFeedback` — the score bands shown at the end of an attempt.
 *
 * One editor, used by all four 2026-09-21 types, because the shape is the
 * library's and is identical across them: a list of `{from, to, feedback}`
 * over 0–100.
 *
 * BANDS MAY OVERLAP, AND THE LAST MATCH WINS. That is deliberate and matches
 * every scorer in `lib/h5p`. It lets an author write a catch-all first and
 * then narrow it — "Have another go" for 0–100, then "Fluent" for 90–100 —
 * which is how people actually write these. So this editor does not sort the
 * list, does not merge overlaps, and does not warn about them: order is
 * meaning here.
 *
 * What it does warn about is a GAP, because a score that matches no band shows
 * the learner nothing at the end of an attempt, and that reads as the activity
 * having failed to finish.
 *
 * ADDING A BAND MOVES THE CURSOR TO IT. The list is appended to, so on a long
 * ladder the new row arrives below the fold and the button looks like it did
 * nothing. The new row's From field takes focus and is scrolled into view —
 * `block: 'nearest'`, so an already-visible row does not jump. That relies on
 * the page root being height-auto: the nearest scrollable ancestor has to be
 * the shell's `<main>`, not a nested container around the editor. See the note
 * in `content-type-form.tsx`.
 */
export function FeedbackBandEditor({
  bands,
  onChange,
  disabled,
}: {
  bands: FeedbackBand[];
  onChange: (bands: FeedbackBand[]) => void;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // The index the author just added, consumed by the effect below on the
  // render that first contains that row. A ref, not state: this is a one-shot
  // instruction to the DOM, and putting it in state would mean a second render
  // whose only job is to clear it.
  const addedIndex = useRef<number | null>(null);

  const update = (index: number, patch: Partial<FeedbackBand>) =>
    onChange(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)));

  const add = () => {
    onChange([
      ...bands,
      // A new band starts where the last one ended, which is what an author
      // building a ladder wants and costs them one edit when it is not.
      { from: bands.length > 0 ? Math.min(100, bands[bands.length - 1].to + 1) : 0, to: 100, feedback: '' },
    ]);
    addedIndex.current = bands.length;
  };

  useEffect(() => {
    const index = addedIndex.current;
    if (index === null) return;
    addedIndex.current = null;

    const row = listRef.current?.querySelector<HTMLElement>(`[data-band-index="${index}"]`);
    if (!row) return;

    row.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    // Focusing the From field puts the cursor where the author types next. It
    // also makes the addition audible to a screen reader without a live region
    // announcing a row the user has not been moved to.
    row.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [bands.length]);

  const covered = new Set<number>();
  for (const band of bands) {
    for (let n = Math.max(0, band.from); n <= Math.min(100, band.to); n++) covered.add(n);
  }
  const hasGap = bands.length > 0 && covered.size < 101;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">End-of-attempt feedback</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            A message per score range. Ranges may overlap — the last one that matches is shown.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add band
        </button>
      </div>

      {bands.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
          No bands yet. Without one, learners see their score and no message.
        </p>
      ) : (
        <div className="mt-4 space-y-2" ref={listRef}>
          {bands.map((band, index) => (
            <div
              key={index}
              data-band-index={index}
              className="flex scroll-mt-4 flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"
            >
              <div className="flex items-end gap-1.5">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    From
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(band.from)}
                    disabled={disabled}
                    onChange={(e) => update(index, { from: Number(e.target.value) })}
                    className="w-20 tabular-nums"
                  />
                </label>
                <span className="pb-2 text-xs text-slate-400">–</span>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">To</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(band.to)}
                    disabled={disabled}
                    onChange={(e) => update(index, { to: Number(e.target.value) })}
                    className="w-20 tabular-nums"
                  />
                </label>
                <span className="pb-2 text-xs text-slate-400">%</span>
              </div>

              <label className="min-w-[12rem] flex-1 block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Message
                </span>
                <Input
                  value={band.feedback}
                  disabled={disabled}
                  maxLength={500}
                  placeholder="Well done — you have this."
                  onChange={(e) => update(index, { feedback: e.target.value })}
                />
              </label>

              <button
                type="button"
                onClick={() => onChange(bands.filter((_, i) => i !== index))}
                disabled={disabled}
                className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove the ${band.from} to ${band.to} percent band`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasGap ? (
        <p className="mt-3 text-[11px] text-amber-700">
          Some scores fall outside every band. A learner scoring one of those sees no message at the end.
        </p>
      ) : null}
    </section>
  );
}
