'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

/*
 * Premium dashboard kit.
 *
 * One brand family (indigo → violet) carries all data. Green / amber / red appear only when a
 * figure means good / watch / act, and always with a word or arrow beside them. Surfaces are white
 * with a hairline ring and a layered shadow; the hero is a deep navy band so the headline figures
 * have somewhere to stand.
 */

export type Tone = 'neutral' | 'good' | 'watch' | 'act' | 'brand';

const PILL: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  watch: 'bg-amber-50 text-amber-800 ring-amber-100',
  act: 'bg-red-50 text-red-700 ring-red-100',
};

const DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400', brand: 'bg-indigo-500', good: 'bg-emerald-500', watch: 'bg-amber-500', act: 'bg-red-500',
};

export const SURFACE = 'rounded-xl bg-white ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]';

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PILL[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

/** A change against a baseline, as an arrow plus words. `onDark` is for the navy hero. */
export function Delta({ direction, tone, children, onDark = false }: { direction: 'up' | 'down' | 'flat'; tone: Tone; children: React.ReactNode; onDark?: boolean }) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const light = tone === 'good' ? 'text-emerald-700 bg-emerald-50' : tone === 'act' ? 'text-red-700 bg-red-50' : tone === 'watch' ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-100';
  const dark = tone === 'good' ? 'text-emerald-300 bg-emerald-400/10' : tone === 'act' ? 'text-red-300 bg-red-400/10' : tone === 'watch' ? 'text-amber-300 bg-amber-400/10' : 'text-slate-300 bg-white/10';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${onDark ? dark : light}`}>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

/* ---------- sparkline ---------- */

/** Smooth path through points (monotone cubic), so a line reads as a trend, not a polyline. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = Math.hypot(a, b);
    if (h > 3) { const k = 3 / h; t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    d += ` C${c1x.toFixed(1)},${(pts[i].y + (t[i] * dx[i]) / 3).toFixed(1)} ${c2x.toFixed(1)},${(pts[i + 1].y - (t[i + 1] * dx[i]) / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

export function Sparkline({ values, label, width = 112, height = 36, onDark = false }: { values: Array<number | null>; label: string; width?: number; height?: number; onDark?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const real = values.map((v, i) => (v == null ? null : { v, i })).filter((p): p is { v: number; i: number } => p !== null);
  if (real.length < 3) return null;
  const min = Math.min(...real.map((p) => p.v));
  const max = Math.max(...real.map((p) => p.v));
  const span = max - min || 1;
  const pad = 3;
  const px = (i: number) => pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const py = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2 - 2);
  const pts = real.map((p) => ({ x: px(p.i), y: py(p.v) }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`;
  const stroke = onDark ? '#a5b4fc' : '#6366f1';
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={onDark ? 0.35 : 0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${uid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3} fill={onDark ? '#0b1020' : '#fff'} stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

/* ---------- hero ---------- */

export function Hero({
  eyebrow, title, insight, actions, children,
}: {
  eyebrow: React.ReactNode; title: string; insight?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">{eyebrow}</p>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">{title}</h1>
          {insight && (
            <p className="mt-2 inline-flex max-w-2xl items-start gap-2 rounded-lg bg-indigo-50/80 px-3 py-2 text-sm leading-relaxed text-indigo-950 ring-1 ring-inset ring-indigo-100">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
              <span>{insight}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {children && <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">{children}</div>}
    </header>
  );
}


/**
 * Headline figure. Every tile has the same three rows — label, number (+ trend), context — with the
 * context pinned to the bottom, so tiles with and without a trend line up and never look half empty.
 * With `onClick` the whole tile opens the screen behind the number.
 */
export function HeroStat({
  label, value, icon: Icon, context, delta, spark, sparkLabel, footer, onClick,
}: {
  label: string; value: string | number; icon: LucideIcon; context?: React.ReactNode; delta?: React.ReactNode; spark?: Array<number | null>; sparkLabel?: string; footer?: React.ReactNode; onClick?: () => void;
}) {
  const base = `${SURFACE} group flex min-w-0 flex-col justify-between gap-2.5 p-3.5 text-left transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_32px_-14px_rgba(79,70,229,0.28)]`;
  const body = (
    <>
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[13px] font-medium text-slate-500">{label}</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
            <Icon size={15} strokeWidth={1.75} aria-hidden />
          </span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div className="min-w-0 text-[1.6rem] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{value}</div>
          {spark && <Sparkline values={spark} label={sparkLabel ?? `${label}, recent trend`} width={92} height={32} />}
        </div>
      </div>
      <div>
        {footer && <div className="mb-2">{footer}</div>}
        <div className="flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1">
          {delta}
          {context && <span className="truncate text-xs text-slate-500">{context}</span>}
        </div>
      </div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={`Open ${label}`} className={`${base} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 active:scale-[0.99] motion-reduce:transition-none`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

/* ---------- panels ---------- */

export function Panel({
  title, description, icon: Icon, action, children, flush = false, className = '',
}: {
  title: string; description?: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <section className={`${SURFACE} @container ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon size={16} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
            {description && <p className="truncate text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className={flush ? 'border-t border-slate-100' : 'px-5 pb-5 pt-1'}>{children}</div>
    </section>
  );
}

export function EmptyNote({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-sm text-slate-500">
      {Icon && <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon size={18} strokeWidth={1.5} aria-hidden /></span>}
      {children}
    </div>
  );
}

/** Small segmented control: 7D / 14D / 30D, Attendance / Fees … */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
            value === o.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- area chart ---------- */

export type SeriesPoint = { label: string; value: number | null };

/**
 * Smooth area chart with a crosshair tooltip and an optional dashed line for the previous period.
 * Gaps (null — a day nobody marked) break the line instead of dropping it to zero.
 */
export function AreaChart({
  points, previous, format, height = 240, domain, unit, previousLabel = 'Previous period',
}: {
  points: SeriesPoint[]; previous?: Array<number | null>; format: (v: number) => string; height?: number; domain?: [number, number]; unit: string; previousLabel?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 44, padR = 12, padT = 14, padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { lo, hi } = useMemo(() => {
    const all = [...points.map((p) => p.value), ...(previous ?? [])].filter((v): v is number => v != null);
    if (domain) return { lo: domain[0], hi: domain[1] };
    const top = Math.max(...all, 1);
    return { lo: 0, hi: top * 1.1 };
  }, [points, previous, domain]);

  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  /** Continuous runs of real values. */
  const segments = (vals: Array<number | null>) => {
    const out: Array<Array<{ x: number; y: number; i: number }>> = [];
    let cur: Array<{ x: number; y: number; i: number }> = [];
    vals.forEach((v, i) => {
      if (v == null) { if (cur.length) out.push(cur); cur = []; } else cur.push({ x: x(i), y: y(v), i });
    });
    if (cur.length) out.push(cur);
    return out;
  };

  const main = segments(points.map((p) => p.value));
  const prev = previous ? segments(previous) : [];
  // Tiny ranges (a few rupees) would repeat the same label on several lines; keep one per distinct label.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (hi - lo) * t).filter((t, k, all) => k === 0 || format(t) !== format(all[k - 1]));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(plotW / 64), 2)));

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - padL;
    const i = Math.round((rel / (plotW || 1)) * (n - 1));
    setHover(Math.min(Math.max(i, 0), n - 1));
  };

  const h = hover != null ? points[hover] : null;
  const hv = h?.value ?? null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 90), width - 90) : 0;

  return (
    <div ref={wrap} className="relative select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={unit} className="block overflow-visible">
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={k === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#94a3b8" className="tabular-nums">{format(t)}</text>
          </g>
        ))}
        {prev.map((seg, k) => (
          <path key={`p${k}`} d={smoothPath(seg)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />
        ))}
        {main.map((seg, k) => seg.length > 1 ? (
          <g key={`m${k}`}>
            <path d={`${smoothPath(seg)} L${seg[seg.length - 1].x.toFixed(1)},${y(lo)} L${seg[0].x.toFixed(1)},${y(lo)} Z`} fill={`url(#area-${uid})`} />
            <path d={smoothPath(seg)} fill="none" stroke="#4f46e5" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : (
          <circle key={`m${k}`} cx={seg[0].x} cy={seg[0].y} r={3.5} fill="#4f46e5" />
        ))}
        {/* The last label is always drawn, so a regular label too close to it is skipped instead of printing on top of it. */}
        {points.map((p, i) => ((i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.8) || i === n - 1) && (
          <text key={i} x={x(i)} y={height - 7} textAnchor="middle" fontSize={10.5} fill={i === n - 1 ? '#0f172a' : '#94a3b8'} fontWeight={i === n - 1 ? 600 : 400}>{p.label}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="#c7d2fe" strokeWidth={1} />
            {hv != null && <circle cx={x(hover)} cy={y(hv)} r={4.5} fill="#fff" stroke="#4f46e5" strokeWidth={2.25} />}
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg" style={{ left: tipLeft }}>
          <div className="font-medium text-slate-300">{h.label}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{hv == null ? 'No data' : format(hv)}</div>
          {previous && previous[hover] != null && <div className="mt-0.5 text-[11px] text-slate-400">{previousLabel}: {format(previous[hover] as number)}</div>}
        </div>
      )}
      <table className="sr-only">
        <caption>{unit}</caption>
        <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td>{p.value == null ? 'No data' : format(p.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------- ring ---------- */

export function Donut({
  segments, center, centerLabel, size = 148,
}: {
  segments: Array<{ label: string; value: number; color: string }>; center: string; centerLabel: string; size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={12}
              strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-semibold tabular-nums text-slate-900">{center}</span>
        <span className="text-[11px] text-slate-500">{centerLabel}</span>
      </div>
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; value: string; color: string; sub?: string }> }) {
  return (
    <ul className="min-w-0 flex-1 space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2.5 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-600">{it.label}</span>
          <span className="font-semibold tabular-nums text-slate-900">{it.value}</span>
          {it.sub && <span className="w-10 text-right text-xs tabular-nums text-slate-400">{it.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- lists & bars ---------- */

export type Row = { id: string | number; title: string; detail?: string | null; trailing?: React.ReactNode; badge?: { tone: Tone; text: string } };

export function RowList({ rows, icon: Icon }: { rows: Row[]; icon: LucideIcon }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r, i) => (
        <li key={`${r.id}-${i}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <Icon size={15} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900" title={r.title}>{r.title || 'Untitled'}</p>
            {r.detail && <p className="truncate text-xs text-slate-500">{r.detail}</p>}
          </div>
          {r.badge && <Pill tone={r.badge.tone}>{r.badge.text}</Pill>}
          {r.trailing && <span className="shrink-0 text-xs text-slate-400">{r.trailing}</span>}
        </li>
      ))}
    </ul>
  );
}

export function BarList({ rows, format = (v) => v.toLocaleString('en-IN'), showShare = true }: { rows: Array<{ label: string; value: number }>; format?: (v: number) => string; showShare?: boolean }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(3.5rem,8rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-slate-600" title={r.label}>{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-20 text-right tabular-nums text-slate-900">
            {format(r.value)}
            {showShare && total > 0 && <span className="ml-1.5 text-[11px] text-slate-400">{Math.round((r.value / total) * 100)}%</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Attendance by class: the bar's colour says whether it is fine, to watch, or to act on — and so does the word. */
export function RateBars({ rows }: { rows: Array<{ label: string; rate: number; detail: string }> }) {
  return (
    <ul className="max-h-[320px] space-y-3.5 overflow-y-auto pr-1">
      {rows.map((r) => {
        const tone: Tone = r.rate >= 90 ? 'good' : r.rate >= 75 ? 'watch' : 'act';
        const fill = tone === 'good' ? 'bg-indigo-500' : tone === 'watch' ? 'bg-amber-500' : 'bg-red-500';
        return (
          <li key={r.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-800">Class {r.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{r.detail}</span>
                {tone !== 'good' && <Pill tone={tone}>{tone === 'act' ? 'Low' : 'Watch'}</Pill>}
                <span className="w-12 text-right font-semibold tabular-nums text-slate-900">{r.rate.toFixed(r.rate % 1 ? 1 : 0)}%</span>
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${fill}`} style={{ width: `${Math.min(r.rate, 100)}%` }} />
              <span className="absolute inset-y-[-3px] w-px bg-slate-300" style={{ left: '90%' }} aria-hidden />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-slate-600">{s.label}</span>
              <span className="flex items-baseline gap-2">
                {conv != null && <span className="text-[11px] text-slate-400">{conv}% of previous step</span>}
                <span className="font-semibold tabular-nums text-slate-900">{s.value.toLocaleString('en-IN')}</span>
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-md bg-slate-100">
              <div className="h-full rounded-md bg-gradient-to-r from-indigo-600 to-violet-500 transition-[width] duration-500" style={{ width: `${Math.max((s.value / top) * 100, s.value > 0 ? 3 : 0)}%`, opacity: 1 - i * 0.18 }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- attention & glance ---------- */

export type AttentionItem = { key: string; icon: LucideIcon; count: number; display?: string; text: string; tone: Tone; onClick?: () => void };

export function AttentionBar({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Needs your attention" className="mb-4 flex flex-wrap gap-2">
      <span className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" /></span>
        Needs attention
      </span>
      {items.map((it) => {
        const inner = (
          <>
            <it.icon size={14} strokeWidth={2} className={it.tone === 'act' ? 'text-red-600' : 'text-amber-600'} aria-hidden />
            <span><b className="font-semibold tabular-nums text-slate-900">{it.display ?? it.count.toLocaleString('en-IN')}</b> {it.text}</span>
          </>
        );
        const cls = 'inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-2.5 pr-3.5 text-sm text-slate-600 ring-1 ring-slate-900/[0.07] shadow-sm';
        return it.onClick ? (
          <button key={it.key} type="button" onClick={it.onClick} className={`${cls} outline-none transition-colors hover:bg-slate-50 hover:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/50`}>{inner}</button>
        ) : (
          <span key={it.key} className={cls}>{inner}</span>
        );
      })}
    </section>
  );
}

/** Secondary figures. The cells wrap to however many fit the width; hairlines come from a 1px gap on a tinted base. */
export function StatStrip({ items }: { items: Array<{ key: string; label: string; value: string | number; icon: LucideIcon; onClick?: () => void }> }) {
  return (
    <section aria-label="At a glance" className={`${SURFACE} overflow-hidden`}>
      <div className="grid gap-px bg-slate-100 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        {items.map((it) => {
          const cls = 'flex min-w-0 items-center gap-3 bg-white px-4 py-3.5 text-left';
          const inner = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><it.icon size={15} strokeWidth={1.75} aria-hidden /></span>
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight tabular-nums text-slate-900">{it.value}</div>
                <div className="truncate text-xs text-slate-500" title={it.label}>{it.label}</div>
              </div>
            </>
          );
          return it.onClick ? (
            <button key={it.key} type="button" onClick={it.onClick} title={`Open ${it.label}`} className={`${cls} outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40`}>{inner}</button>
          ) : (
            <div key={it.key} className={cls}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

export function PremiumSkeleton() {
  const block = 'animate-pulse rounded-xl bg-slate-200/60';
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-12 w-2/3 animate-pulse rounded-full bg-slate-200/50" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${block} h-80 lg:col-span-2`} />
        <div className={`${block} h-80`} />
      </div>
    </div>
  );
}
