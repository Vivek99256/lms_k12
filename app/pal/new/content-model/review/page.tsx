'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import {
  bulkTransition,
  fetchReviewQueue,
  fetchVocabulary,
  humanise,
  statusTone,
  type ContentModelVocabulary,
  type ReviewQueue,
} from '@/app/pal/new/data/content-model';

/**
 * Content Model — review queue (spec §7.1).
 *
 * The authoring console's work list: everything a person has edited or the AI
 * has proposed, least-confident first, because that is where a reviewer's time
 * is worth most. A pure projection is not here — there is nothing to review
 * about a node until somebody acts on it.
 */
export default function ContentModelReviewPage() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [vocabulary, setVocabulary] = useState<ContentModelVocabulary | null>(null);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const [data, vocab] = await Promise.all([
          fetchReviewQueue(status ? { status } : {}, signal),
          fetchVocabulary(signal),
        ]);
        setQueue(data);
        setVocabulary(vocab);
        setSelected(new Set());
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load the review queue.');
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  const toggle = (nodeKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const applyBulk = async (toStatus: string) => {
    if (selected.size === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await bulkTransition(Array.from(selected), toStatus);
      setNotice(
        result.failCount === 0
          ? `Moved ${result.okCount} node(s) to ${humanise(toStatus)}.`
          : `Moved ${result.okCount}, refused ${result.failCount}. First refusal: ${result.failed[0]?.error}`
      );
      await load();
    } catch (err) {
      setError((err as Error).message || 'The bulk update failed.');
    } finally {
      setBusy(false);
    }
  };

  // A single move must be legal from every selected row's current status, so
  // the offered targets are the intersection, not the union.
  const targets = (() => {
    if (!queue || selected.size === 0) return [];
    const statuses = queue.items
      .filter((item) => selected.has(item.nodeKey))
      .map((item) => item.qualityStatus);
    const sets = statuses.map((s) => new Set(queue.qualityTransitions[s] ?? []));
    if (sets.length === 0) return [];
    return Array.from(sets[0]).filter((candidate) => sets.every((set) => set.has(candidate)));
  })();

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/pal/new/content-model">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Content model
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Review queue</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Nothing here reaches a learner until a person approves it.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {queue && vocabulary ? (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DFE6F2] bg-white p-4">
              <button
                type="button"
                onClick={() => setStatus('')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  status === ''
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                All
              </button>
              {vocabulary.qualityStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(status === s ? '' : s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    status === s ? 'border-indigo-600 bg-indigo-600 text-white' : statusTone(s)
                  }`}
                >
                  {humanise(s)} ({queue.pipeline[s] ?? 0})
                </button>
              ))}

              {selected.size > 0 ? (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">{selected.size} selected →</span>
                  {targets.length === 0 ? (
                    <span className="text-xs text-amber-700">
                      No transition is legal for every selected row
                    </span>
                  ) : (
                    targets.map((target) => (
                      <Button
                        key={target}
                        size="sm"
                        variant={target === 'approved' ? 'default' : 'outline'}
                        disabled={busy}
                        onClick={() => void applyBulk(target)}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        {humanise(target)}
                      </Button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              {queue.items.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    Nothing is waiting for review. Edit a node or run AI enrichment and it will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="w-10 px-4 py-2.5" />
                        <th className="px-4 py-2.5 font-semibold">Node</th>
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Tagged by</th>
                        <th className="px-4 py-2.5 font-semibold">Confidence</th>
                        <th className="px-4 py-2.5 font-semibold">Updated</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {queue.items.map((item) => (
                        <tr key={item.nodeKey} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={selected.has(item.nodeKey)}
                              onChange={() => toggle(item.nodeKey)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-slate-800">{item.title || '(projected content)'}</p>
                            <p className="font-mono text-[11px] text-slate-400">{item.nodeKey}</p>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {vocabulary.contentTypes[item.contentType]?.label ?? item.contentType}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(item.qualityStatus)}`}
                            >
                              {humanise(item.qualityStatus)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                            {item.taggedBy}
                          </td>
                          <td className="px-4 py-2.5">
                            {item.confidence === null ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  item.confidence < 0.6
                                    ? 'bg-rose-50 text-rose-700'
                                    : item.confidence < 0.75
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {Math.round(item.confidence * 100)}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{item.updatedAt}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/pal/new/content-model/authoring?node=${item.nodeKey}`}>
                              <Button variant="outline" size="sm">
                                Open
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        {loading && !queue ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading queue…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
