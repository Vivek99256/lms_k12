'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import type { CompareBlock, NotesBlock, ReportBlock, StepUse, TableBlock } from '@/lib/classroom-activity/activity';
import {
  cellKey,
  compareKey,
  derivedValue,
  entityName,
  fillTokens,
  nameKey,
  noteKey,
  numberOf,
  rankChanges,
  reportKey,
  reportSections,
  signed,
  tableCounts,
} from '@/lib/classroom-activity/progress';

type Values = Readonly<Record<string, string>>;
type OnChange = (key: string, value: string) => void;

const FIELD =
  'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 disabled:bg-slate-100 sm:text-sm';

// ---------------------------------------------------------------------------
// Table: a measurement for every row and column
// ---------------------------------------------------------------------------

export function TableBlockView({ block, use, values, onChange, readOnly = false }: { block: TableBlock; use?: StepUse; values: Values; onChange: OnChange; readOnly?: boolean }) {
  const columns = use?.columns ? block.columns.filter((c) => use.columns!.includes(c.id)) : block.columns;
  const shown = new Set(columns.map((c) => c.id));
  // A worked-out column appears once the two columns it needs are both on screen.
  const derived = (block.derived ?? []).filter((d) => shown.has(d.of) && shown.has(d.minus));
  const unit = block.unit ? ` (${block.unit})` : '';
  const counts = tableCounts(block, values);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <caption className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-900">
            {block.title}
            {block.unit ? <span className="font-normal text-slate-700"> — enter numbers in {block.unit}</span> : null}
          </caption>
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 text-slate-900">
              <th scope="col" className="px-3 py-2 font-semibold">
                {block.row_heading ?? 'Item'}
              </th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="px-3 py-2 font-semibold">
                  {c.label}
                  {unit}
                </th>
              ))}
              {derived.map((d) => (
                <th key={d.id} scope="col" className="bg-emerald-50 px-3 py-2 font-semibold text-emerald-950">
                  {d.label}
                  {unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 last:border-0">
                <th scope="row" className="px-3 py-2 font-medium text-slate-900">
                  {row.label}
                </th>
                {columns.map((c) => {
                  const key = cellKey(block.id, row.id, c.id);
                  const value = values[key] ?? '';
                  const invalid = value.trim() !== '' && numberOf(value) === null;
                  // Read-only is plain text: it prints, wraps and is read out as text, which a disabled box does not.
                  if (readOnly) {
                    return (
                      <td key={c.id} className="px-3 py-2 align-top tabular-nums">
                        {value.trim() || <span className="text-slate-600">—</span>}
                      </td>
                    );
                  }
                  return (
                    <td key={c.id} className="px-2 py-1.5 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={value}
                        disabled={readOnly}
                        onChange={(e) => onChange(key, e.target.value)}
                        aria-label={`${row.label}, ${c.label}${block.unit ? `, in ${block.unit}` : ''}`}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? `${key}-hint` : undefined}
                        className={`${FIELD} w-24 tabular-nums ${invalid ? 'border-red-700' : ''}`}
                      />
                      {invalid ? (
                        <span id={`${key}-hint`} className="mt-0.5 block text-xs font-medium text-red-800">
                          Enter a number
                        </span>
                      ) : null}
                    </td>
                  );
                })}
                {derived.map((d) => {
                  const n = derivedValue(block, d.id, row.id, values);
                  return (
                    <td key={d.id} className="bg-emerald-50/60 px-3 py-2 align-top font-semibold tabular-nums text-emerald-950">
                      {n === null ? <span className="font-normal text-slate-600">—</span> : signed(n)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-700" aria-live="polite">
        {counts.filled} of {counts.total} readings entered
        {derived.length > 0 ? '. The shaded columns are worked out from your numbers.' : '.'}
      </p>
    </div>
  );
}

/** The learner's own changes, largest first. States only what they entered; it does not say what the numbers mean. */
export function TableInsight({ block, values }: { block: TableBlock; values: Values }) {
  const lines = (block.derived ?? []).map((d) => ({ d, ranked: rankChanges(block, d.id, values) })).filter((x) => x.ranked.length >= 2);
  if (lines.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900" data-testid="table-insight">
      <p className="font-semibold">From your numbers</p>
      <ul className="mt-1 space-y-1">
        {lines.map(({ d, ranked }) => (
          <li key={d.id}>
            {d.label}, largest first: {ranked.map((r) => `${r.label} ${signed(r.change)}`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare: two things side by side
// ---------------------------------------------------------------------------

export function CompareBlockView({ block, use, values, onChange, readOnly = false }: { block: CompareBlock; use?: StepUse; values: Values; onChange: OnChange; readOnly?: boolean }) {
  if (use?.group === 'names') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {block.entities.map((e) => (
          <div key={e.id} className="space-y-1">
            <label htmlFor={`${block.id}-name-${e.id}`} className="block text-sm font-semibold text-slate-900">
              {e.label}
              {e.role ? <span className="font-normal text-slate-700"> ({e.role})</span> : null}
            </label>
            <input
              id={`${block.id}-name-${e.id}`}
              type="text"
              value={values[nameKey(block.id, e.id)] ?? ''}
              disabled={readOnly}
              placeholder={e.hint ?? `Name of ${e.label}`}
              onChange={(ev) => onChange(nameKey(block.id, e.id), ev.target.value)}
              className={FIELD}
            />
          </div>
        ))}
      </div>
    );
  }

  const rows = block.rows.filter((r) => (use?.group ? r.group === use.group : true) && (use?.rows ? use.rows.includes(r.id) : true));
  const names = block.entities.map((e) => entityName(block, e.id, values));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <caption className="sr-only">{block.title}</caption>
        <thead>
          <tr className="border-b border-slate-300 bg-slate-50 text-slate-900">
            <th scope="col" className="w-1/3 px-3 py-2 font-semibold">
              Feature
            </th>
            {block.entities.map((e, i) => (
              <th key={e.id} scope="col" className="px-3 py-2 font-semibold">
                {names[i]}
                {e.role ? <span className="block text-xs font-normal text-slate-700">{e.role}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <th scope="row" className="px-3 py-2 align-top font-medium text-slate-900">
                {row.label}
              </th>
              {block.entities.map((e, i) => {
                const key = compareKey(block.id, row.id, e.id);
                const label = `${row.label}, ${names[i]}`;
                if (readOnly) {
                  return (
                    <td key={e.id} className="whitespace-pre-wrap px-3 py-2 align-top">
                      {(values[key] ?? '').trim() || <span className="text-slate-600">—</span>}
                    </td>
                  );
                }
                return (
                  <td key={e.id} className="px-2 py-1.5 align-top">
                    {row.options ? (
                      <select value={values[key] ?? ''} disabled={readOnly} onChange={(ev) => onChange(key, ev.target.value)} aria-label={label} className={FIELD}>
                        <option value="">Choose…</option>
                        {row.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <textarea value={values[key] ?? ''} rows={2} disabled={readOnly} onChange={(ev) => onChange(key, ev.target.value)} aria-label={label} className={FIELD} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function NotesBlockView({ block, values, onChange, readOnly = false }: { block: NotesBlock; values: Values; onChange: OnChange; readOnly?: boolean }) {
  const id = `${block.id}-notes`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {block.label}
      </label>
      {block.hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-700">
          {block.hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={4}
        value={values[noteKey(block.id)] ?? ''}
        disabled={readOnly}
        onChange={(e) => onChange(noteKey(block.id), e.target.value)}
        aria-describedby={block.hint ? `${id}-hint` : undefined}
        className={FIELD}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report: a titled write-up with a set number of reasons
// ---------------------------------------------------------------------------

export function ReportBlockView({ block, from, values, onChange }: { block: ReportBlock; from: CompareBlock; values: Values; onChange: OnChange }) {
  const statuses = reportSections(block, values);
  // How many boxes each section shows: at least what the card asks for, never fewer than what is already written.
  const [extra, setExtra] = useState<Record<string, number>>({});
  const fill = (text: string) => fillTokens(text, block, from, values);

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-900" data-testid="report-title">
        {fill(block.title_template)}
      </p>
      {block.sections.map((section, s) => {
        const status = statuses[s];
        const visible = Math.min(section.max, Math.max(section.min, status.count, extra[section.id] ?? 0));
        const range = section.min === section.max ? `${section.min}` : `${section.min}–${section.max}`;
        const noun = section.max === 1 ? 'suggestion' : 'reasons';
        return (
          <fieldset key={section.id} className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">{fill(section.label)}</legend>
            <p className={`text-xs ${status.ok ? 'font-medium text-emerald-900' : 'text-slate-700'}`} aria-live="polite">
              {status.count} of {range} {noun} written{status.ok ? '. That is enough.' : '.'}
            </p>
            {Array.from({ length: visible }, (_, i) => {
              const key = reportKey(block.id, section.id, i);
              return (
                <div key={key} className="flex items-start gap-2">
                  {section.max > 1 ? <span className="mt-2 w-5 text-right text-sm font-semibold tabular-nums text-slate-800">{i + 1}.</span> : null}
                  <textarea value={values[key] ?? ''} rows={2} onChange={(e) => onChange(key, e.target.value)} aria-label={`${fill(section.label)}, number ${i + 1}`} className={FIELD} />
                </div>
              );
            })}
            {visible < section.max ? (
              <button
                type="button"
                onClick={() => setExtra((all) => ({ ...all, [section.id]: visible + 1 }))}
                className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
              >
                Add another reason
              </button>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timer: for the waits a task card names
// ---------------------------------------------------------------------------

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A countdown for a wait the card names ("for 15 minutes"). It only times; the learner still does the step. It counts from
 * the clock, not from ticks, so a slow or hidden tab does not make it run long.
 */
export function StepTimer({ seconds, label }: { seconds: number; label?: string }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endsAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remaining = ((endsAt.current ?? Date.now()) - Date.now()) / 1000;
      if (remaining <= 0) {
        setLeft(0);
        setRunning(false);
      } else {
        setLeft(remaining);
      }
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const start = () => {
    endsAt.current = Date.now() + (left > 0 ? left : seconds) * 1000;
    if (left <= 0) setLeft(seconds);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setLeft(seconds);
  };
  const over = left <= 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3" data-testid="step-timer">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Timer{label ? `: ${label}` : ''}</p>
        <p role="timer" aria-label={`${clock(left)} left`} className="text-3xl font-semibold tabular-nums text-slate-900">
          {clock(left)}
        </p>
      </div>
      <div className="flex gap-2">
        {running ? (
          <button type="button" onClick={pause} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
            <Pause className="h-4 w-4" aria-hidden="true" /> Pause
          </button>
        ) : (
          <button type="button" onClick={start} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
            <Play className="h-4 w-4" aria-hidden="true" /> {left < seconds && !over ? 'Resume' : over ? 'Start again' : 'Start'}
          </button>
        )}
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
        </button>
      </div>
      <p role="status" className="basis-full text-sm font-semibold text-emerald-900">
        {over ? 'Time is up. Go on to the next step.' : ''}
      </p>
    </div>
  );
}
