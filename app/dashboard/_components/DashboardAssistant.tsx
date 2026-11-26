'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Loader2, SendHorizontal, Sparkles, Trash2, Undo2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AreaChart, BarList, Donut, EmptyNote, Legend, Panel } from '@/app/dashboard/_components/PremiumKit';
import {
  askDashboardAssistant, getDashboardSession, removeCustomWidget,
  isLibraryWidget, type AssistantApplied, type CustomWidget, type LibraryView,
} from '@/app/dashboard/_lib/dashboard-api';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { friendlyError } from '@/lib/user-messages';

/*
 * "Tell the dashboard what you want." A chat that shows or hides panels and adds widgets for the signed-in user only.
 * The server decides what is allowed; this file only sends what was typed, applies the panel changes it is told to,
 * and draws the widgets it gets back. Nothing here builds a query.
 */

const SUGGESTIONS = [
  'Show student birthdays today',
  'Add fees collected month by month as a bar chart',
  'Show attendance by class, lowest first',
  'Add library books overdue',
];

const SHADES = ['#4f46e5', '#818cf8', '#a5b4fc', '#94a3b8', '#cbd5e1'];

const fmt = (unit: 'count' | 'rupees' | 'percent', v: number) =>
  unit === 'rupees' ? `₹${Math.round(v).toLocaleString('en-IN')}` : unit === 'percent' ? `${v % 1 ? v.toFixed(1) : v}%` : v.toLocaleString('en-IN');

type Turn = { role: 'user' | 'assistant'; text: string; applied?: AssistantApplied[]; undone?: boolean; error?: boolean };

export function DashboardAssistant({
  panels, hidden, onSetHidden, onWidgets,
}: {
  panels: readonly DashboardWidget[];
  hidden: ReadonlySet<string>;
  onSetHidden: (hiddenIds: string[]) => Promise<boolean>;
  onWidgets: (widgets: CustomWidget[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns, busy]);

  const hiddenNow = useRef(hidden);
  hiddenNow.current = hidden;

  const applyPanels = async (changes: Array<{ type: 'show' | 'hide'; id: string }>) => {
    const next = new Set(hiddenNow.current);
    changes.forEach((c) => (c.type === 'hide' ? next.add(c.id) : next.delete(c.id)));
    return onSetHidden([...next]);
  };

  const send = async (raw?: string) => {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    setText('');
    setBusy(true);
    const history = turns.slice(-6).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: 'user', text: message }]);
    try {
      const r = await askDashboardAssistant(getDashboardSession(), message, panels.map((p) => ({ id: p.id, label: p.label, visible: !hiddenNow.current.has(p.id) })), history);
      let reply = r.reply;
      if (r.ui.length > 0 && !(await applyPanels(r.ui))) reply += ' (I could not save the panel change, so it may not stay.)';
      onWidgets(r.widgets);
      setTurns((t) => [...t, { role: 'assistant', text: reply, applied: r.applied }]);
    } catch (e) {
      setTurns((t) => [...t, { role: 'assistant', text: friendlyError(e, "I couldn't do that just now. Please try again."), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  /** Put back what one turn changed. Removing a widget cannot be undone here: it can simply be asked for again. */
  const undo = async (index: number) => {
    const turn = turns[index];
    if (!turn?.applied || turn.undone) return;
    setBusy(true);
    try {
      const flips = turn.applied.filter((a) => a.type === 'show' || a.type === 'hide').map((a) => ({ type: (a.type === 'show' ? 'hide' : 'show') as 'show' | 'hide', id: a.panel_id as string }));
      if (flips.length > 0) await applyPanels(flips);
      let widgets: CustomWidget[] | null = null;
      for (const a of turn.applied.filter((x) => x.type === 'add_widget' && x.widget_id)) widgets = (await removeCustomWidget(getDashboardSession(), a.widget_id as number)).widgets;
      if (widgets) onWidgets(widgets);
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, undone: true } : x)));
    } catch (e) {
      setTurns((t) => [...t, { role: 'assistant', text: friendlyError(e, "I couldn't undo that. Please try again."), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="!h-9 bg-white shadow-sm" onClick={() => setOpen(true)}>
        <WandSparkles />
        Build own dashboard
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-slate-100 px-5 py-4">
            <SheetTitle className="flex items-center gap-2"><Sparkles size={16} className="text-indigo-600" aria-hidden /> Build your dashboard by chat</SheetTitle>
            <SheetDescription>Say what you want to see. It only changes your own dashboard, and you can undo any change.</SheetDescription>
            {turns.length > 0 && (
              <button
                type="button" onClick={() => { setTurns([]); setText(''); }} disabled={busy}
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <Eraser size={13} aria-hidden /> Clear chat
              </button>
            )}
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Try one of these, or write it in your own words (English, Gujarati or Hindi):</p>
                <div className="flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-white px-3 py-1.5 text-left text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-200">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${t.role === 'user' ? 'bg-indigo-600 text-white' : t.error ? 'bg-red-50 text-red-800 ring-1 ring-red-100' : 'bg-slate-100 text-slate-800'}`}>
                  <p>{t.text}</p>
                  {t.applied && t.applied.length > 0 && (
                    <button type="button" onClick={() => undo(i)} disabled={busy || t.undone} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline">
                      <Undo2 size={12} aria-hidden /> {t.undone ? 'Undone' : 'Undo'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden /> Working on it…</div>}
            <div ref={end} />
          </div>

          <form className="flex items-end gap-2 border-t border-slate-100 px-4 py-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <label htmlFor="dash-assistant-input" className="sr-only">Tell the dashboard what you want</label>
            <textarea
              id="dash-assistant-input" rows={2} value={text} maxLength={500} placeholder="e.g. add a chart of fees by month"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              className="min-h-[2.5rem] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            />
            <Button type="submit" disabled={busy || text.trim() === ''} aria-label="Send"><SendHorizontal /></Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** A ready-made figure from the dashboard's own library. Five plain views cover all of them. */
export function LibraryBody({ view, emptyNote }: { view: LibraryView | null | undefined; emptyNote?: string }) {
  if (!view) return <EmptyNote>There is no data for this yet.</EmptyNote>;
  switch (view.kind) {
    case 'number':
      return view.value == null ? <EmptyNote>There is no data for this yet.</EmptyNote> : (
        <div><p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{fmt(view.unit, view.value)}</p>{view.note && <p className="mt-1 text-xs text-slate-500">{view.note}</p>}</div>
      );
    case 'facts':
      return view.items.length === 0 ? <EmptyNote>There is no data for this yet.</EmptyNote> : (
        <>
          <dl className="grid grid-cols-2 gap-2.5 @md:grid-cols-3">
            {view.items.map((i) => (
              <div key={i.label} className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
                <dt className="text-[11px] text-slate-500">{i.label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{fmt(i.unit, i.value)}</dd>
              </div>
            ))}
          </dl>
          {view.caution && <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">{view.caution}</p>}
        </>
      );
    case 'list':
      return view.items.length === 0 ? <EmptyNote>{view.empty_note ?? emptyNote ?? 'Nothing to show right now.'}</EmptyNote> : (
        <>
          <ul className="divide-y divide-slate-100">
            {view.items.map((i, n) => (
              <li key={`${i.title}-${n}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium text-slate-800" title={i.title}>{i.title}</span>{i.sub && <span className="block truncate text-xs text-slate-500">{i.sub}</span>}</span>
                {i.tag && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{i.tag}</span>}
              </li>
            ))}
          </ul>
          {view.total > view.items.length && <p className="mt-2 text-xs text-slate-400">Showing {view.items.length} of {view.total.toLocaleString('en-IN')}</p>}
        </>
      );
    case 'bars':
      return view.rows.length === 0 ? <EmptyNote>There is no data for this yet.</EmptyNote> : (
        <>
          <BarList rows={view.rows.slice(0, 8)} format={(v) => fmt(view.unit, v)} showShare={view.unit === 'count'} />
          {view.rows.length > 8 && <p className="mt-2 text-xs text-slate-400">Showing the top 8 of {view.rows.length}</p>}
        </>
      );
    case 'series':
      return view.rows.length < 2 ? <EmptyNote>There is not enough data for a trend yet.</EmptyNote> : (
        <AreaChart points={view.rows.map((r) => ({ label: r.label, value: r.value }))} format={(v) => fmt(view.unit, v)} domain={view.unit === 'percent' ? [0, 100] : undefined} unit="Trend" height={200} />
      );
  }
}

/** One widget the user asked for. Draws the figures the server worked out; says so plainly when there are none. */
function CustomWidgetCard({ w, onRemove, busy }: { w: CustomWidget; onRemove: () => void; busy: boolean }) {
  const remove = (
    <button type="button" onClick={onRemove} disabled={busy} aria-label={`Remove ${w.spec.title}`} title="Remove this widget" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50">
      <Trash2 size={14} aria-hidden />
    </button>
  );
  if (isLibraryWidget(w)) {
    return (
      <Panel title={w.spec.title} description="Added by you" icon={WandSparkles} action={remove}>
        <LibraryBody view={w.data?.view} />
      </Panel>
    );
  }
  const d = w.data;
  const spec = w.spec;
  return (
    <Panel title={spec.title} description={d?.as_of ? `As of ${d.as_of}` : 'Added by you'} icon={WandSparkles} action={remove}>
      {!d || d.rows.length === 0 ? (
        <EmptyNote>{d?.note ?? 'There is no data for this yet.'}</EmptyNote>
      ) : spec.chart === 'number' && d.number ? (
        <div><p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{fmt(d.unit, d.number.value)}</p><p className="mt-1 text-xs text-slate-500">{d.number.label}</p></div>
      ) : spec.chart === 'line' ? (
        <AreaChart points={d.rows.map((r) => ({ label: r.label, value: r.value }))} format={(v) => fmt(d.unit, v)} domain={d.unit === 'percent' ? [0, 100] : undefined} unit={spec.title} height={200} />
      ) : spec.chart === 'donut' ? (
        <div className="flex flex-wrap items-center gap-5">
          <Donut segments={d.rows.map((r, i) => ({ label: r.label, value: r.value, color: SHADES[i % SHADES.length] }))} center={fmt(d.unit, d.rows.reduce((s, r) => s + r.value, 0))} centerLabel="Total" />
          <Legend items={d.rows.map((r, i) => ({ label: r.label, value: fmt(d.unit, r.value), color: SHADES[i % SHADES.length] }))} />
        </div>
      ) : (
        <BarList rows={d.rows} format={(v) => fmt(d.unit, v)} showShare={d.unit === 'count'} />
      )}
      {spec.how && (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">How is this worked out? (built by the assistant from your school data)</summary>
          <p className="mt-1.5 leading-relaxed">{spec.how}</p>
        </details>
      )}
    </Panel>
  );
}

/** "My widgets": what this user asked for, in a grid that follows the width of the screen. Renders nothing when there are none. */
export function CustomWidgetsSection({ widgets, onChange }: { widgets: CustomWidget[]; onChange: (widgets: CustomWidget[]) => void }) {
  const [busy, setBusy] = useState(false);
  if (widgets.length === 0) return null;
  const remove = async (id: number) => {
    setBusy(true);
    try {
      onChange((await removeCustomWidget(getDashboardSession(), id)).widgets);
    } catch {
      /* the widget stays; the user can try again */
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="My widgets" className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">My widgets</h2>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        {widgets.map((w) => <CustomWidgetCard key={w.id} w={w} busy={busy} onRemove={() => remove(w.id)} />)}
      </div>
    </section>
  );
}
