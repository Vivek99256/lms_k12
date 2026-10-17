'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { FlowPanel } from '@/components/ceds/FlowPanel';
import { useFlowPlan } from '@/components/ceds/useFlowPlan';
import { fetchLessonFlow, periodFrom, topicLabel, type FlowTopic } from '@/lib/ceds/flow';
import { cedsEnabledFor, cedsNotAvailableMessage } from '@/lib/ceds/scope';
import { cn } from '@/lib/utils';

/**
 * Teaching method -> resource formats, with a lesson flow. View and reuse only.
 *
 * A separate copy of the resource picker (/course-master/ceds-resources, which is unchanged). It shows the
 * same fit badges, warnings and stored resources. The difference: Open does NOT open the resource straight
 * away. It first asks which teaching method, topic and period the teacher is planning, shows that method's
 * lesson flow for the topic (phases, suggested timings the teacher can change, and the stored slides,
 * activities, notes and labs that verifiably support each phase), and offers the Open link inside it.
 *
 * Nothing is generated, adapted, stored, shortened or reordered from this page.
 *
 *   /course-master/ceds-lesson-planner?chapter=<chapter_master.id>
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

/** What the teacher was opening when the method dialog appeared. */
interface Opening {
  title: string;
  href: string;
}

function LessonPlannerView() {
  const search = useSearchParams();
  const chapterParam = Number(search?.get('chapter') ?? NaN);
  const requestedChapter = Number.isFinite(chapterParam) && chapterParam > 0 ? chapterParam : null;
  // Available for Std 9 Science, Chapter 1 only (lib/ceds/scope.ts); no request is made for any other chapter.
  const chapterId = requestedChapter !== null && cedsEnabledFor(requestedChapter) ? requestedChapter : null;
  const outOfScope = requestedChapter !== null && chapterId === null;

  const [pedagogy, setPedagogy] = useState<string | null>(null);
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [selected, setSelected] = useState<string[]>([]);

  const [topics, setTopics] = useState<{ topics: FlowTopic[]; pedagogies: Record<string, string>; defaultPeriod: number } | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  // What the confirmed plan is for (the resource the teacher pressed Open on), and its lesson flow.
  const [planOpening, setPlanOpening] = useState<Opening | null>(null);
  const flowPlan = useFlowPlan(chapterId);
  const { plan } = flowPlan;
  const panelRef = useRef<HTMLElement | null>(null);

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

  // The topics (and the methods) the dialog offers: what has something stored for this chapter.
  useEffect(() => {
    if (chapterId === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const data = await fetchLessonFlow({ chapterId }, controller.signal);
        if (!controller.signal.aborted) setTopics({ topics: data.topics, pedagogies: data.pedagogies, defaultPeriod: data.default_period_minutes });
      } catch {
        if (!controller.signal.aborted) setTopics({ topics: [], pedagogies: {}, defaultPeriod: 40 });
      }
    })();
    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => {
    if (plan !== null) panelRef.current?.scrollIntoView?.({ block: 'start' });
  }, [plan?.pedagogy, plan?.topicId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const confirm = (choice: { pedagogy: string; topicId: number; period: number }) => {
    if (!opening) return;
    flowPlan.begin(choice);
    setPlanOpening(opening);
    setOpening(null);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Teaching method, resources and lesson flow</p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.chapter.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose a teaching method to see which resource formats suit it, and what is already available for this chapter.
          Press Open on a resource to plan the lesson: you will be asked which teaching method and topic you are planning.
          Existing resources are shown as they are stored; nothing here creates or changes them.
        </p>
      </header>

      {plan && planOpening && (
        <div className="mb-8">
          <FlowPanel
            panelRef={panelRef}
            plan={plan}
            chapterId={chapterId}
            flowState={flowPlan.flowState}
            draft={flowPlan.draft}
            openAction={
              <Link href={planOpening.href} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Open {planOpening.title}
              </Link>
            }
            onMinutes={flowPlan.changeMinutes}
            onResetTimings={flowPlan.resetTimings}
            onPeriod={flowPlan.setPeriod}
            onChangeMethod={() => setOpening(planOpening)}
            onClose={flowPlan.clear}
          />
        </div>
      )}

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
              onOpen={(item, href) => setOpening({ title: item.title, href })}
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

      {opening && (
        <MethodDialog
          opening={opening}
          topics={topics}
          fallbackMethods={data.pedagogies}
          onCancel={() => setOpening(null)}
          onConfirm={confirm}
        />
      )}
    </main>
  );
}

// ------------------------------------------------------------------------- method dialog

function MethodDialog({
  opening,
  topics,
  fallbackMethods,
  onCancel,
  onConfirm,
}: {
  opening: Opening;
  topics: { topics: FlowTopic[]; pedagogies: Record<string, string>; defaultPeriod: number } | null;
  fallbackMethods: Record<string, string>;
  onCancel: () => void;
  onConfirm: (choice: { pedagogy: string; topicId: number; period: number }) => void;
}) {
  // Nothing is chosen for the teacher: no method, no topic. Only the period starts at its 40-minute default.
  const [method, setMethod] = useState<string | null>(null);
  const [topicId, setTopicId] = useState('');
  const [period, setPeriod] = useState(String(topics?.defaultPeriod ?? 40));
  const firstRadio = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstRadio.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const methods = topics && Object.keys(topics.pedagogies).length > 0 ? topics.pedagogies : fallbackMethods;
  const periodValue = periodFrom(period);
  const ready = method !== null && topicId !== '' && periodValue !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="method-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 id="method-dialog-title" className="text-lg font-semibold">Which teaching method are you planning?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Before opening <span className="font-medium">{opening.title}</span>, choose the teaching method, the topic and the length of the period.
          You will see the lesson flow, and can open the resource from there.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Teaching method</legend>
          <div role="radiogroup" aria-label="Teaching method" className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {Object.entries(methods).map(([code, label], i) => (
              <label key={code} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', method === code ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                <input
                  ref={i === 0 ? firstRadio : undefined}
                  type="radio"
                  name="ceds-method"
                  value={code}
                  checked={method === code}
                  onChange={() => setMethod(code)}
                />
                <span><span className="font-mono text-xs text-slate-500">{code}</span> {label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="ceds-topic" className="text-sm font-semibold">Topic</label>
          <select
            id="ceds-topic"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Choose a topic</option>
            {(topics?.topics ?? []).map((t) => (
              <option key={t.id} value={t.id}>{topicLabel(t)}</option>
            ))}
          </select>
          {topics && topics.topics.length === 0 && (
            <p className="mt-1 text-xs text-amber-800">No topic with a stored resource was found for this chapter, so a lesson flow cannot be built.</p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="ceds-period" className="text-sm font-semibold">Period length (minutes)</label>
          <input
            id="ceds-period"
            inputMode="numeric"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-invalid={periodValue === null}
            className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          {periodValue === null && <p className="mt-1 text-xs text-red-700">Enter a whole number from 10 to 120.</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => ready && onConfirm({ pedagogy: method!, topicId: Number(topicId), period: periodValue! })}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium', ready ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-200 text-slate-500')}
          >
            Show lesson flow
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------- the picker, as in /course-master/ceds-resources

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

function FormatCard({
  row,
  chapterId,
  checked,
  onToggle,
  onOpen,
}: {
  row: FormatRow;
  chapterId: number;
  checked: boolean;
  onToggle: () => void;
  onOpen: (item: ResourceItem, href: string) => void;
}) {
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
              <ItemRow key={`${item.source}-${item.id}`} item={item} chapterId={chapterId} onOpen={onOpen} />
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

function ItemRow({ item, chapterId, onOpen }: { item: ResourceItem; chapterId: number; onOpen: (item: ResourceItem, href: string) => void }) {
  const href = openHref(item, chapterId);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <span className="text-xs text-slate-500">{item.scope === 'concepts' ? 'Some concepts' : item.scope === 'chapter' ? 'Whole chapter' : item.scope === 'concept' ? 'One concept' : 'One topic'}</span>
      {componentLabel(item.component) && <span className="text-xs font-medium text-slate-600">{componentLabel(item.component)}</span>}
      {item.review_label && <Badge variant="warning">{item.review_label}</Badge>}
      {href ? (
        // Opening asks for a teaching method first (see MethodDialog); the link itself is offered in the lesson flow.
        <button type="button" onClick={() => onOpen(item, href)} className="font-medium text-indigo-700 underline-offset-2 hover:underline">
          Open
        </button>
      ) : (
        <span className="text-xs text-slate-500">
          {item.kind === 'prayogshala_lab' ? 'Open from the chapter’s Prayogshala tab' : 'Open from the Classroom Resource list'}
        </span>
      )}
    </li>
  );
}

export default function CedsLessonPlannerPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-16 text-slate-600">Loading…</div>}>
      <LessonPlannerView />
    </Suspense>
  );
}
