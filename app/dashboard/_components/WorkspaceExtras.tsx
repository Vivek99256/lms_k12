'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BedDouble, BellRing, Bus, GripVertical, Hourglass, ListChecks, MessageSquareText, Phone, Search, TrendingUp, UserPlus, X, type LucideIcon } from 'lucide-react';
import { fetchFindStudent, getDashboardSession, type FoundStudent, type RoleWorkspaceWidgets } from '@/app/dashboard/_lib/dashboard-api';
import { EmptyNote, Panel, Pill, RateBars, type Tone } from '@/app/dashboard/_components/PremiumKit';

const num = (n: number) => n.toLocaleString('en-IN');

/* ---------- waiting times ---------- */

/** How long things have been waiting, in three age bands. The band colour says how worried to be; the label says it too. */
export function AgingPanel({
  title, description, icon, total, oldestDays, bands, empty,
}: {
  title: string; description: string; icon: LucideIcon; total: number; oldestDays: number | null;
  bands: Array<{ label: string; value: number; tone: Tone }>; empty: string;
}) {
  const fill: Record<Tone, string> = { good: 'bg-emerald-500', watch: 'bg-amber-500', act: 'bg-red-500', brand: 'bg-indigo-500', neutral: 'bg-slate-400' };
  return (
    <Panel title={title} description={description} icon={icon}>
      {total === 0 ? (
        <EmptyNote icon={icon}>{empty}</EmptyNote>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{num(total)}</span>
            <span className="pb-1 text-xs text-slate-500">waiting</span>
            {oldestDays != null && <span className="pb-0.5"><Pill tone={oldestDays > 30 ? 'act' : oldestDays > 7 ? 'watch' : 'neutral'}>Oldest {num(oldestDays)} days</Pill></span>}
          </div>
          <ul className="space-y-3">
            {bands.map((b) => (
              <li key={b.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-slate-600">{b.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${fill[b.tone]}`} style={{ width: `${total > 0 ? (b.value / total) * 100 : 0}%` }} />
                </span>
                <span className="w-10 text-right font-semibold tabular-nums text-slate-900">{num(b.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function ParentWaitPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['parent_msg_age']> }) {
  return (
    <AgingPanel
      title="Parent messages: waiting time" description="How long messages have gone without a reply" icon={MessageSquareText}
      total={data.total} oldestDays={data.oldest_days} empty="Every parent message has a reply."
      bands={[{ label: 'Under 3 days', value: data.lt3, tone: 'good' }, { label: '3 to 7 days', value: data.d3_7, tone: 'watch' }, { label: 'Over a week', value: data.gt7, tone: 'act' }]}
    />
  );
}

export function TaskAgePanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['task_aging']> }) {
  return (
    <AgingPanel
      title="Open tasks: age" description="Since they were raised — tasks carry no due date" icon={ListChecks}
      total={data.total} oldestDays={data.oldest_days} empty="No task is open."
      bands={[{ label: 'This week', value: data.le7, tone: 'good' }, { label: '8 to 30 days', value: data.d8_30, tone: 'watch' }, { label: 'Over 30 days', value: data.gt30, tone: 'act' }]}
    />
  );
}

/* ---------- other panels ---------- */

export function HomeworkPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['homework_rate']> }) {
  return (
    <Panel title="Homework completion" description={`Marked completed, last ${data.days} days · lowest class first`} icon={ListChecks}>
      {data.rows.length === 0 || data.overall == null ? (
        <EmptyNote icon={ListChecks}>No homework was given in the last {data.days} days.</EmptyNote>
      ) : (
        <>
          <div className="mb-4 flex items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{Math.round(data.overall)}%</span>
            <span className="pb-1 text-xs text-slate-500">of {num(data.total)} assignments completed</span>
          </div>
          <RateBars rows={data.rows.map((r) => ({ label: r.standard_name, rate: r.rate ?? 0, detail: `${num(r.done)} of ${num(r.total)}` }))} />
        </>
      )}
    </Panel>
  );
}

export function StrengthPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['strength_changes']> }) {
  const cells = [
    { label: 'Joined this month', value: data.joined_month, icon: UserPlus },
    { label: 'Joined this year', value: data.joined_year, icon: TrendingUp },
    { label: 'Left this year', value: data.left_year, icon: X },
    { label: 'Transfer certificates', value: data.tc_year, icon: ListChecks },
  ];
  return (
    <Panel title="Student strength changes" description="From enrolment start and end dates" icon={TrendingUp}>
      <dl className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-slate-50 px-3.5 py-3 ring-1 ring-inset ring-slate-100">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500"><c.icon size={12} aria-hidden /> {c.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{num(c.value)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function TransportPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['transport_summary']> }) {
  return (
    <Panel title="Transport" description="Students on a bus and how full each bus is" icon={Bus}>
      {data.buses === 0 ? (
        <EmptyNote icon={Bus}>No student is mapped to a bus.</EmptyNote>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div><div className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{num(data.students)}</div><div className="text-xs text-slate-500">students on transport</div></div>
            <div><div className="text-xl font-semibold tabular-nums text-slate-900">{num(data.buses)}</div><div className="text-xs text-slate-500">buses in use</div></div>
            {data.over_capacity > 0 && <Pill tone="act">{data.over_capacity} over capacity</Pill>}
          </div>
          <ul className="space-y-3">
            {data.top.map((b) => {
              const over = b.fill != null && b.fill > 100;
              const high = b.fill != null && b.fill > 90;
              return (
                <li key={b.id} className="grid grid-cols-[minmax(4rem,7rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-slate-600" title={b.title}>{b.title}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${over ? 'bg-red-500' : high ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(b.fill ?? 0, 100)}%` }} />
                  </span>
                  <span className="w-24 text-right tabular-nums text-slate-900">{b.students}/{b.capacity || '—'}{b.fill != null && <span className="ml-1.5 text-[11px] text-slate-400">{b.fill}%</span>}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function HostelPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['hostel_summary']> }) {
  const used = data.rooms > 0 ? (data.rooms_in_use / data.rooms) * 100 : 0;
  return (
    <Panel title="Hostel" description="Residents and rooms in use" icon={BedDouble}>
      {data.rooms === 0 ? (
        <EmptyNote icon={BedDouble}>No hostel rooms are set up.</EmptyNote>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div><div className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{num(data.residents)}</div><div className="text-xs text-slate-500">residents</div></div>
            <div><div className="text-xl font-semibold tabular-nums text-slate-900">{num(data.hostels)}</div><div className="text-xs text-slate-500">hostels</div></div>
          </div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="text-slate-600">Rooms in use</span><span className="font-semibold tabular-nums text-slate-900">{data.rooms_in_use} of {data.rooms}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${used}%` }} /></div>
        </>
      )}
    </Panel>
  );
}

/* ---------- student finder ---------- */

const HERO_FIELD = 'h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40';

/** Type three letters of a name or an admission number; get the class and a parent's number to ring. */
export function StudentFinder({ openSearch }: { openSearch?: () => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<FoundStudent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      fetchFindStudent(getDashboardSession(), q.trim(), controller.signal)
        .then((r) => setItems(r.items))
        .catch(() => { if (!controller.signal.aborted) setError("Couldn't search just now."); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setItems(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={box} className="relative">
      <label className="relative block">
        <span className="sr-only">Find a student</span>
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student…" className={`${HERO_FIELD} w-44 pl-8 pr-2.5 lg:w-56`} />
      </label>
      {(busy || error || items) && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-xl bg-white text-left shadow-xl ring-1 ring-slate-900/10">
          {busy && !items && <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>}
          {error && <p className="px-4 py-3 text-sm text-slate-500">{error}</p>}
          {items && items.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No enrolled student matches “{q.trim()}”.</p>}
          {items && items.length > 0 && (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {items.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{[s.class_name, s.enrollment_no].filter(Boolean).join(' · ')}</p>
                  </div>
                  {s.phone && (
                    <a href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"><Phone size={12} aria-hidden /> Call</a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {openSearch && items && (
            <button type="button" onClick={openSearch} className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50">Open full student search</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- alert limit ---------- */

/** The attendance level below which the dashboard raises an alert. Kept in this browser, per person. */
export function AlertLimit({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const save = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 50 && n <= 100) {
      onChange(n);
      setOpen(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { setDraft(String(value)); setOpen((o) => !o); }} aria-expanded={open} title="Alert limits" className={`${HERO_FIELD} inline-flex items-center gap-2 px-3 font-medium hover:bg-slate-50`}>
        <BellRing size={15} aria-hidden /> <span className="hidden md:inline">Alerts</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-white p-4 text-left shadow-xl ring-1 ring-slate-900/10">
          <p className="text-sm font-semibold text-slate-900">Alert limits</p>
          <p className="mt-0.5 text-xs text-slate-500">Raise an alert when today&apos;s attendance falls below this. Saved in this browser for you only.</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            Attendance below
            <input type="number" min={50} max={100} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} className={`${HERO_FIELD} w-20 px-2 text-right tabular-nums`} />
            %
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={save} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- panel order ---------- */

/** The user's own panel order for one dashboard, kept in this browser. Unknown panels fall to the end in their default order. */
export function usePanelOrder(storageKey: string) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((next: string[]) => {
    setOrder(next);
    try {
      if (next.length === 0) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage full or blocked — the order simply is not remembered */
    }
  }, [storageKey]);

  const arrange = useCallback(<T extends { key: string }>(items: T[]): T[] => {
    if (order.length === 0) return items;
    const rank = new Map(order.map((k, i) => [k, i]));
    return items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => (rank.get(a.item.key) ?? 1e6 + a.i) - (rank.get(b.item.key) ?? 1e6 + b.i))
      .map((x) => x.item);
  }, [order]);

  /** Move `key` to sit where `target` is, within the current visible `keys`. */
  const move = useCallback((keys: string[], key: string, target: string) => {
    if (key === target) return;
    const next = keys.filter((k) => k !== key);
    const at = next.indexOf(target);
    next.splice(at < 0 ? next.length : at + (keys.indexOf(key) < keys.indexOf(target) ? 1 : 0), 0, key);
    save(next);
  }, [save]);

  const nudge = useCallback((keys: string[], key: string, by: -1 | 1) => {
    const i = keys.indexOf(key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }, [save]);

  return useMemo(() => ({ arrange, move, nudge, reset: () => save([]), custom: order.length > 0 }), [arrange, move, nudge, order.length, save]);
}

/** Wraps a panel so it can be dragged by its handle, or moved with the arrow keys when the handle has focus. */
export function MovablePanel({
  id, keys, dragging, setDragging, move, nudge, children,
}: {
  id: string; keys: string[]; dragging: string | null; setDragging: (k: string | null) => void;
  move: (keys: string[], key: string, target: string) => void; nudge: (keys: string[], key: string, by: -1 | 1) => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      ref={ref}
      className={`group/panel relative mb-4 break-inside-avoid print:break-inside-avoid ${dragging === id ? 'opacity-40' : ''} ${over && dragging && dragging !== id ? 'rounded-xl ring-2 ring-indigo-400 ring-offset-2' : ''}`}
      onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (dragging) move(keys, dragging, id); setDragging(null); }}
    >
      <button
        type="button"
        draggable
        aria-label="Move this panel. Drag it, or use the up and down arrow keys."
        title="Drag to move"
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); if (ref.current) e.dataTransfer.setDragImage(ref.current, 24, 16); setDragging(id); }}
        onDragEnd={() => setDragging(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(keys, id, -1); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); nudge(keys, id, 1); }
        }}
        className="absolute left-1/2 top-0 z-10 flex h-5 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full bg-white text-slate-400 opacity-0 shadow ring-1 ring-slate-900/10 outline-none transition-opacity hover:text-indigo-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 group-hover/panel:opacity-100 active:cursor-grabbing print:hidden"
      >
        <GripVertical size={14} className="rotate-90" aria-hidden />
      </button>
      {children}
    </div>
  );
}

/** Used by the dashboard for a panel's "waiting" icon in lists elsewhere. */
export const WAIT_ICON = Hourglass;
