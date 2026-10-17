'use client';

import { useEffect, useRef, useState } from 'react';

import { FlowPanel } from '@/components/ceds/FlowPanel';
import { useFlowPlan } from '@/components/ceds/useFlowPlan';
import { fetchCedsResources, type CedsResources } from '@/lib/ceds/api';
import { fetchLessonFlow, periodFrom, topicLabel, type FlowTopic } from '@/lib/ceds/flow';
import { fitMessage, fitRowFor, formatCodeFor } from '@/lib/ceds/open';
import { cn } from '@/lib/utils';

/**
 * Shown when a teacher presses Open on a Classroom Resource card that is one of the six CEDS formats.
 *
 * It asks for the two things CEDS lets a teacher choose, the resource FORMAT and the teaching METHOD, checks
 * that they suit each other, and explains why when they do not: a weak pairing is never hidden or blocked, the
 * teacher is told the reason and the better options, and can present it anyway. It then asks for the topic and
 * the period and shows the method's lesson flow for that topic, with the stored resources that support each
 * phase. The resource the teacher clicked opens from there, exactly as it did before.
 *
 * READ ONLY: it GETs the existing lms/ceds/resources (fit) and lms/ceds/lesson-flow endpoints and nothing else.
 */
export function OpenWithMethod({
  chapterId,
  itemTitle,
  itemType,
  onOpenResource,
  onClose,
}: {
  chapterId: number;
  itemTitle: string;
  /** The card's type, e.g. "Classroom presentation"; its CEDS format is pre-selected (and can be changed). */
  itemType: string;
  /** Opens the resource itself, the way the Classroom Resource list always has. */
  onOpenResource: () => void;
  onClose: () => void;
}) {
  const ownFormat = formatCodeFor(itemType);
  const [stage, setStage] = useState<'choose' | 'flow'>('choose');
  const [format, setFormat] = useState<string | null>(ownFormat);
  const [method, setMethod] = useState<string | null>(null);
  const [topicId, setTopicId] = useState('');
  const [period, setPeriod] = useState('40');

  const [formats, setFormats] = useState<CedsResources | null>(null);
  const [fit, setFit] = useState<CedsResources | null>(null);
  const [topics, setTopics] = useState<{ topics: FlowTopic[]; pedagogies: Record<string, string>; defaultPeriod: number } | null>(null);
  const [error, setError] = useState('');
  const firstRadio = useRef<HTMLInputElement | null>(null);
  const flowPlan = useFlowPlan(chapterId);

  // The formats and the topics/methods this chapter offers.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [res, flow] = await Promise.all([fetchCedsResources(chapterId, null, controller.signal), fetchLessonFlow({ chapterId }, controller.signal)]);
        if (controller.signal.aborted) return;
        setFormats(res);
        setTopics({ topics: flow.topics, pedagogies: flow.pedagogies, defaultPeriod: flow.default_period_minutes });
        setPeriod(String(flow.default_period_minutes));
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => controller.abort();
  }, [chapterId]);

  // How well the chosen format suits the chosen method (the existing fit matrix, asked of the existing endpoint).
  useEffect(() => {
    if (method === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchCedsResources(chapterId, method, controller.signal);
        if (!controller.signal.aborted) setFit(res);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => controller.abort();
  }, [chapterId, method]);

  useEffect(() => {
    firstRadio.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fitRow = method !== null && format !== null && fit?.pedagogy === method ? fitRowFor(fit, format) : undefined;
  const message = fitMessage(fitRow);
  const periodValue = periodFrom(period);
  const ready = format !== null && method !== null && topicId !== '' && periodValue !== null && fitRow !== undefined;
  const formatRows = formats?.formats.slice().sort((a, b) => a.format.localeCompare(b.format)) ?? [];

  const openAndClose = () => {
    onClose();
    onOpenResource();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="open-method-title" className="my-4 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        {stage === 'choose' ? (
          <>
            <h2 id="open-method-title" className="text-lg font-semibold">Choose the format and the teaching method</h2>
            <p className="mt-1 text-sm text-slate-600">
              Before opening <span className="font-medium">{itemTitle}</span>, choose the resource format and the teaching method you are planning. If they do not suit each
              other you will be told why, and can still go ahead.
            </p>
            {error && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Resource format</legend>
              <div role="radiogroup" aria-label="Resource format" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {formatRows.map((f) => (
                  <label key={f.format} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', format === f.format ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <input type="radio" name="ceds-format" value={f.format} checked={format === f.format} onChange={() => setFormat(f.format)} />
                    <span><span className="font-mono text-xs text-slate-500">{f.format}</span> {f.label}</span>
                  </label>
                ))}
              </div>
              {format !== null && ownFormat !== null && format !== ownFormat && (
                <p className="mt-1 text-xs text-slate-500">You are opening a {formatRows.find((f) => f.format === ownFormat)?.label ?? 'resource'}; the fit below is for the format you chose.</p>
              )}
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Teaching method</legend>
              <div role="radiogroup" aria-label="Teaching method" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {Object.entries(topics?.pedagogies ?? {}).map(([code, label], i) => (
                  <label key={code} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', method === code ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <input ref={i === 0 ? firstRadio : undefined} type="radio" name="ceds-method" value={code} checked={method === code} onChange={() => setMethod(code)} />
                    <span><span className="font-mono text-xs text-slate-500">{code}</span> {label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {format !== null && method !== null && message.tone !== 'unknown' && (
              <p
                role={message.tone === 'weak' ? 'alert' : 'status'}
                data-fit={message.tone}
                className={cn('mt-3 rounded-md px-3 py-2 text-sm', message.tone === 'weak' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}
              >
                {message.tone === 'weak' && <span className="font-semibold">Not a good match. </span>}
                {message.text}
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ceds-topic" className="text-sm font-semibold">Topic</label>
                <select id="ceds-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  <option value="">Choose a topic</option>
                  {(topics?.topics ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{topicLabel(t)}</option>
                  ))}
                </select>
                {topics && topics.topics.length === 0 && <p className="mt-1 text-xs text-amber-800">No topic with a stored resource was found for this chapter, so a lesson flow cannot be built.</p>}
              </div>
              <div>
                <label htmlFor="ceds-period" className="text-sm font-semibold">Period length (minutes)</label>
                <input id="ceds-period" inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} aria-invalid={periodValue === null} className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                {periodValue === null && <p className="mt-1 text-xs text-red-700">Enter a whole number from 10 to 120.</p>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => {
                  if (!ready) return;
                  flowPlan.begin({ pedagogy: method!, topicId: Number(topicId), period: periodValue! });
                  setStage('flow');
                }}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium', ready ? (message.tone === 'weak' ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-indigo-600 text-white hover:bg-indigo-700') : 'cursor-not-allowed bg-slate-200 text-slate-500')}
              >
                {message.confirmLabel}
              </button>
            </div>
          </>
        ) : (
          flowPlan.plan && (
            <>
              <h2 id="open-method-title" className="sr-only">Lesson flow for {itemTitle}</h2>
              <FlowPanel
                plan={flowPlan.plan}
                chapterId={chapterId}
                flowState={flowPlan.flowState}
                draft={flowPlan.draft}
                openAction={
                  <button type="button" onClick={openAndClose} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                    Open {itemTitle}
                  </button>
                }
                onMinutes={flowPlan.changeMinutes}
                onResetTimings={flowPlan.resetTimings}
                onPeriod={flowPlan.setPeriod}
                onChangeMethod={() => {
                  flowPlan.clear();
                  setMethod(null);
                  setFit(null);
                  setTopicId('');
                  setStage('choose');
                }}
                onClose={onClose}
              />
            </>
          )
        )}
      </div>
    </div>
  );
}
