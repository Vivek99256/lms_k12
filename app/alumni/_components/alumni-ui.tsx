'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlumniStatus } from '../_lib/alumni-api';

export const STATUS_LABEL: Record<AlumniStatus, string> = {
  registered: 'Registered',
  pending_verification: 'Pending verification',
  verified: 'Verified',
  active: 'Active',
  inactive: 'Inactive',
  blocked: 'Blocked',
  deceased: 'Deceased',
  opted_out: 'Opted out',
};

// Meaning is carried by the label text; colour only reinforces it.
const STATUS_TONE: Record<AlumniStatus, string> = {
  registered: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending_verification: 'bg-amber-50 text-amber-800 ring-amber-200',
  verified: 'bg-blue-50 text-blue-800 ring-blue-200',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  blocked: 'bg-red-50 text-red-800 ring-red-200',
  deceased: 'bg-slate-100 text-slate-600 ring-slate-200',
  opted_out: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function AlumniStatusBadge({ status }: { status: string }) {
  const key = status as AlumniStatus;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE[key] ?? STATUS_TONE.registered)}>
      {STATUS_LABEL[key] ?? status}
    </span>
  );
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PageFrame({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      {title ? (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Banner({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', tones[tone])}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-500" role="status">
      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {hint ? <p className="max-w-md text-sm text-slate-500">{hint}</p> : null}
      {action}
    </div>
  );
}

export function MetricTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2" aria-label={`Profile ${value}% complete`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{value}%</span>
    </div>
  );
}

export const inputClass =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:bg-slate-50';

export function FormField({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="block text-xs text-red-700" role="alert">{error}</span> : null}
    </label>
  );
}
