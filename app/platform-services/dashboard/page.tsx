'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff } from 'lucide-react';

import { fetchDashboard, PlatformApiError, saveDashboardLayout, type DashboardWidget } from '@/lib/platform/client';

import { Card, ErrorState, formatWhen, LoadingState, Note, Pill, PlainShell, RefreshButton } from '../_components/shell';

/**
 * Platform services -> Dashboard.
 *
 * The dashboard engine: modules register widgets on the server, and the platform
 * decides which ones this person may see, in what order, and with fresh data. A
 * widget the person may not see is never sent, and a hidden one has no data read.
 */
export default function PlatformDashboardPage() {
  const [widgets, setWidgets] = useState<DashboardWidget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setWidgets(await fetchDashboard());
    } catch (reason) {
      setError(reason instanceof PlatformApiError ? reason.message : 'The dashboard could not be loaded.');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function persist(next: DashboardWidget[]) {
    setNote(null);
    try {
      await saveDashboardLayout(next.map((widget) => ({ key: widget.key, hidden: widget.hidden })));
      await load();
    } catch (reason) {
      setNote({ tone: 'error', text: reason instanceof PlatformApiError ? reason.message : 'Your layout could not be saved.' });
    }
  }

  function move(index: number, delta: number) {
    if (!widgets) return;
    const next = [...widgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  function toggle(index: number) {
    if (!widgets) return;
    const next = widgets.map((widget, i) => (i === index ? { ...widget, hidden: !widget.hidden } : widget));
    void persist(next);
  }

  return (
    <PlainShell
      title="Dashboard"
      description="Widgets registered by the platform's services. Reorder or hide them; your layout is saved to your account."
      actions={<RefreshButton onClick={() => void load()} busy={widgets === null && !error} />}
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : widgets === null ? (
        <LoadingState label="Loading dashboard" />
      ) : widgets.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600">There are no widgets you have access to.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget, index) => (
            <Card key={widget.key} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{widget.title}</p>
                  <p className="text-xs text-slate-500">{widget.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Move ${widget.title} earlier`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Move ${widget.title} later`} disabled={index === widgets.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label={widget.hidden ? `Show ${widget.title}` : `Hide ${widget.title}`} onClick={() => toggle(index)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                    {widget.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {widget.hidden ? (
                <p className="mt-3 text-sm text-slate-500">
                  <Pill>hidden</Pill>
                </p>
              ) : widget.kind === 'count' ? (
                <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
                  {widget.data?.value ?? 0}
                  {widget.data?.href && (
                    <Link href={widget.data.href} className="ml-3 align-middle text-sm font-medium text-indigo-700 hover:underline">
                      Open
                    </Link>
                  )}
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {(widget.data?.items ?? []).length === 0 && <li className="text-slate-500">Nothing to show.</li>}
                  {(widget.data?.items ?? []).map((item, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <span>{item.label}</span>
                      {item.meta && <Pill>{item.meta}</Pill>}
                      {item.at && <span className="text-xs text-slate-500">{formatWhen(item.at)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </PlainShell>
  );
}
