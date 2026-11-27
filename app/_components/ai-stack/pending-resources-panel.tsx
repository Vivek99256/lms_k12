'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';

import type { IntelligenceContext } from '@/lib/intelligence/client';
import { pendingSummary, type PendingProgress } from '@/lib/teach-learn/pending-summary';
import { resourceKey } from '@/lib/teach-learn/pending-store';
import { getResourceStatus, type PendingResource, type ResourceStatusItem } from '@/lib/teach-learn/catalogue-agent-client';

const POLL_MS = 8000;
// A deck or document takes minutes; stop asking after this long and say so rather than spin for ever.
const GIVE_UP_MS = 45 * 60 * 1000;

const keyOf = resourceKey;

/** Where the finished resource is read: the chapter's Classroom Resource list. */
function classroomResourceHref(r: PendingResource): string | null {
  if (!r.subject_id || !r.standard_id) return null;
  return `/course-master/${r.subject_id}-${r.standard_id}/chapters?view=content&resourceType=classroom&chapterId=${r.chapter_id}&expandedChapterId=${r.chapter_id}`;
}

interface Props {
  resources: PendingResource[];
  readContext: () => IntelligenceContext;
  /** Called whenever the counts change, so the execution summary can say what is really stored. */
  onSummary?: (text: string, progress: PendingProgress) => void;
  /** The heading above the cards. */
  title?: string;
}

/**
 * Presentations and study documents AI Stack started in the background. Nothing here asks a teacher to approve anything: each
 * resource is stored by the server once it passes generation and validation, and this panel only reports the truth, asking the
 * server every few seconds until each one is stored (with a link) or failed (with the reason).
 */
export function PendingResourcesPanel({ resources, readContext, onSummary, title = 'Generating and storing automatically' }: Props) {
  const [states, setStates] = useState<Record<string, ResourceStatusItem>>({});
  const [gaveUp, setGaveUp] = useState(false);
  const startedAt = useRef(0);
  // Read inside the poll loop and the summary effect, which outlive the render that started them (refs are written in effects).
  const statesRef = useRef(states);
  const summaryRef = useRef(onSummary);
  useEffect(() => {
    statesRef.current = states;
    summaryRef.current = onSummary;
  });

  const watched = useMemo(() => resources.map((r) => ({ r, key: keyOf(r) })), [resources]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    startedAt.current = Date.now();

    const tick = async () => {
      const open = watched.filter(({ key }) => (statesRef.current[key]?.state ?? 'running') === 'running');
      if (stopped || open.length === 0) return;
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setGaveUp(true);
        return;
      }
      try {
        const items = await getResourceStatus(
          readContext(),
          open.map(({ r }) => ({ kind: r.kind, chapter_id: r.chapter_id, run: r.run, document_kind: r.document_kind }))
        );
        if (stopped) return;
        setStates((prev) => {
          const next = { ...prev };
          for (const item of items) {
            next[keyOf({ kind: item.kind as PendingResource['kind'], chapter_id: item.chapter_id, run: item.run, document_kind: item.document_kind })] = item;
          }
          return next;
        });
      } catch {
        // A failed read is not a failed resource: ask again on the next tick.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    // Restart only when the set of watched resources changes; `readContext` is read fresh at each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched]);

  const counts = useMemo(() => {
    let stored = 0;
    let failed = 0;
    const failures: { label: string; reason: string }[] = [];
    const finishedKeys: string[] = [];
    for (const { r, key } of watched) {
      const s = states[key]?.state;
      if (s === 'stored') {
        stored += 1;
        finishedKeys.push(key);
      } else if (s === 'failed') {
        finishedKeys.push(key);
        failed += 1;
        failures.push({ label: r.resource_type, reason: states[key]?.error || 'It could not be generated.' });
      }
    }
    return { stored, failed, failures, finishedKeys };
  }, [watched, states]);

  // Reported to the page (badge, Agent 3 box, counters, summary) whenever the numbers, a failure reason or the give-up changes.
  const failuresKey = counts.failures.map((f) => `${f.label}:${f.reason}`).join('|');
  const finishedKey = counts.finishedKeys.join('|');
  useEffect(() => {
    summaryRef.current?.(pendingSummary(watched.length, counts.stored, counts.failed, counts.failures), {
      total: watched.length,
      stored: counts.stored,
      failed: counts.failed,
      gaveUp,
      failures: counts.failures,
      finishedKeys: counts.finishedKeys,
    });
    // `failuresKey` stands for the contents of `counts.failures`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.length, counts.stored, counts.failed, gaveUp, failuresKey, finishedKey]);

  if (watched.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="pending-resources">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {watched.map(({ r, key }) => {
          const state = states[key]?.state ?? 'running';
          const status = states[key];
          const href = status?.url || classroomResourceHref(r);
          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {r.resource_type}
                    {r.format_label ? ` · ${r.format_label}` : ''}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{r.chapter_name || `Chapter ${r.chapter_id}`}</p>
                </div>
                {state === 'stored' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 className="size-3" aria-hidden="true" /> Stored
                  </span>
                ) : state === 'failed' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                    <TriangleAlert className="size-3" aria-hidden="true" /> Not stored
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Generating
                  </span>
                )}
              </div>
              {state === 'failed' ? (
                <p className="text-[11px] leading-4 text-rose-700">{status?.error || 'It could not be generated.'}</p>
              ) : state === 'stored' ? (
                <p className="text-[11px] leading-4 text-slate-600">Available in Classroom Resource.</p>
              ) : (
                <p className="text-[11px] leading-4 text-slate-600">
                  {gaveUp ? 'Still not finished after a long wait. It may still appear in Classroom Resource; check there.' : 'It is stored automatically once it passes validation.'}
                </p>
              )}
              {state === 'stored' && href ? (
                <a
                  href={href}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
                >
                  Open in Classroom Resource
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
