'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import {
  CedsApiError,
  fetchCedsResources,
  componentLabel,
  fitLabel,
  missingSelection,
  openHref,
  statusLabel,
  toggleAll,
  type CedsResources,
  type Fit,
  type FormatRow,
  type ResourceItem,
} from '@/lib/ceds/api';
import { cedsEnabledFor, cedsNotAvailableMessage } from '@/lib/ceds/scope';
import { cn } from '@/lib/utils';

/**
 * Teaching method -> resource formats. View and reuse only.
 *
 * Pick a teaching method to see how well each of the six resource formats suits it and what
 * is already stored for the chapter. Nothing is generated, adapted, stored or changed from
 * this page: tick formats to plan, and the generate button stays disabled in this release.
 *
 *   /course-master/ceds-resources?chapter=<chapter_master.id>
 */

const FIT_STYLE: Record<Fit, string> = {
  S: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  P: 'bg-blue-50 text-blue-800 ring-blue-200',
  W: 'bg-amber-50 text-amber-900 ring-amber-300',
};

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: CedsResources };

function CedsResourcesView() {
  const search = useSearchParams();
  const chapterParam = Number(search?.get('chapter') ?? NaN);
  const requestedChapter = Number.isFinite(chapterParam) && chapterParam > 0 ? chapterParam : null;
  // Available for Std 9 Science, Chapter 1 only (lib/ceds/scope.ts); no request is made for any other chapter.
  const chapterId = requestedChapter !== null && cedsEnabledFor(requestedChapter) ? requestedChapter : null;
  const outOfScope = requestedChapter !== null && chapterId === null;

  const [pedagogy, setPedagogy] = useState<string | null>(null);
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (chapterId === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const data = await fetchCedsResources(chapterId, pedagogy, controller.signal);
        if (!controller.signal.aborted) setState({ phase: 'ready', data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ phase: 'error', message: error instanceof CedsApiError || error instanceof Error ? error.message : 'Something went wrong.' });
      }
    })();
    return () => controller.abort();
  }, [chapterId, pedagogy]);

  if (outOfScope) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        {cedsNotAvailableMessage()}
      </div>
    );
  }
  if (chapterId === null) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        Open this page from a chapter: add <span className="font-mono">?chapter=&lt;chapter id&gt;</span> to the address.
      </div>
    );
  }
  if (state.phase === 'loading') {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-600" role="status">Loading resources…</div>;
  }
  if (state.phase === 'error') {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        {state.message}
      </div>
    );
  }

  const { data } = state;
  const missing = missingSelection(data.formats, selected);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Teaching method and resources</p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.chapter.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose a teaching method to see which resource formats suit it, and what is already available for this chapter.
          Existing resources are shown as they are stored; nothing here creates or changes them.
        </p>
      </header>

      <section aria-labelledby="method-heading" className="mb-6">
        <h2 id="method-heading" className="mb-2 text-sm font-semibold">Teaching method</h2>
        <div role="radiogroup" aria-labelledby="method-heading" className="flex flex-wrap gap-2">
          <MethodButton active={pedagogy === null} onClick={() => setPedagogy(null)} label="All formats" />
          {Object.entries(data.pedagogies).map(([code, label]) => (
            <MethodButton key={code} active={pedagogy === code} onClick={() => setPedagogy(code)} label={`${code} ${label}`} />
          ))}
        </div>
        {pedagogy && <p className="mt-2 text-xs text-slate-500">Planned for a {data.period_minutes}-minute period unless you choose otherwise.</p>}
      </section>

      <section aria-labelledby="formats-heading">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="formats-heading" className="text-sm font-semibold">Resource formats</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setSelected(toggleAll(data.formats, selected))}
          >
            {selected.length === data.formats.length ? 'Clear selection' : 'Select all six'}
          </button>
        </div>

        <ul className="space-y-3">
          {data.formats.map((row) => (
            <FormatCard
              key={row.format}
              row={row}
              chapterId={chapterId}
              checked={selected.includes(row.format)}
              onToggle={() => setSelected((cur) => (cur.includes(row.format) ? cur.filter((c) => c !== row.format) : [...cur, row.format]))}
            />
          ))}
        </ul>
      </section>

      <footer className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="cursor-not-allowed rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500"
        >
          {missing.length > 0 ? `Generate ${missing.length} missing format${missing.length === 1 ? '' : 's'}` : 'Generate missing formats'}
        </button>
        <p className="mt-2 text-xs text-slate-600">
          Generating missing formats is not available in this release. Resources that already exist are never replaced.
          {missing.length > 0 && ` Selected formats with nothing stored: ${missing.join(', ')}.`}
        </p>
      </footer>
    </main>
  );
}

function MethodButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function FormatCard({ row, chapterId, checked, onToggle }: { row: FormatRow; chapterId: number; checked: boolean; onToggle: () => void }) {
  const tone = useMemo(
    () => (row.status === 'available' ? 'success' : row.status === 'pending_review' || row.status === 'partial' ? 'warning' : 'outline'),
    [row.status],
  );

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`pick-${row.format}`}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4"
          aria-label={`Select ${row.label}`}
        />
        <label htmlFor={`pick-${row.format}`} className="text-base font-semibold">
          <span className="mr-1.5 font-mono text-xs text-slate-500">{row.format}</span>
          {row.label}
        </label>
        {row.fit && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', FIT_STYLE[row.fit])}>{fitLabel(row.fit)}</span>
        )}
        <Badge variant={tone}>{statusLabel(row.status)}</Badge>
      </div>

      {row.note && <p className="mt-1 text-xs text-slate-500">{row.note}</p>}

      {row.fit === 'W' && row.warning && (
        <p role="note" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {row.warning}
          {(row.alternative_formats?.length ?? 0) > 0 && <> Better suited to this method: {row.alternative_formats!.join(', ')}.</>}
          {(row.alternative_pedagogies?.length ?? 0) > 0 && <> Or choose a different method: {row.alternative_pedagogies!.join(', ')}.</>}
          {' '}You can still use it.
        </p>
      )}

      {row.items.length > 0 ? (
        <>
          {row.format === 'D1' && row.resolver_note && <p className="mt-2 text-sm text-slate-600">{row.resolver_note}</p>}
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {row.items.map((item) => (
              <ItemRow key={`${item.source}-${item.id}`} item={item} chapterId={chapterId} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          {row.resolver_note || 'Nothing is stored for this format yet.'}
        </p>
      )}

      {row.gaps && row.gaps.length > 0 && (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">Known gaps, noted for later ({row.gaps.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {row.gaps.map((gap) => (
              <li key={gap.key}>
                <span className="font-medium">{gap.label}.</span> {gap.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Recorded only. Nothing is generated or changed to fill these.</p>
        </details>
      )}
    </li>
  );
}

function ItemRow({ item, chapterId }: { item: ResourceItem; chapterId: number }) {
  const href = openHref(item, chapterId);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <span className="text-xs text-slate-500">{item.scope === 'concepts' ? 'Some concepts' : item.scope === 'chapter' ? 'Whole chapter' : item.scope === 'concept' ? 'One concept' : 'One topic'}</span>
      {componentLabel(item.component) && <span className="text-xs font-medium text-slate-600">{componentLabel(item.component)}</span>}
      {item.review_label && <Badge variant="warning">{item.review_label}</Badge>}
      {href ? (
        <Link href={href} className="font-medium text-indigo-700 underline-offset-2 hover:underline">
          Open
        </Link>
      ) : (
        <span className="text-xs text-slate-500">
          {item.kind === 'prayogshala_lab' ? 'Open from the chapter’s Prayogshala tab' : 'Open from the Classroom Resource list'}
        </span>
      )}
    </li>
  );
}

export default function CedsResourcesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-16 text-slate-600">Loading…</div>}>
      <CedsResourcesView />
    </Suspense>
  );
}
