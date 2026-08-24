'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] space-y-5 p-3 sm:p-4 lg:p-6">{children}</div>;
}

<<<<<<< HEAD
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm">{title && <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">{title}</h2>}<div className="p-4 sm:p-5">{children}</div></section>;
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold text-slate-700">{label}{required && <span className="text-rose-600"> *</span>}</Label>{children}</div>;
=======
export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  required,
  error,
  helpText,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : (
        helpText && <p className="text-xs text-slate-500">{helpText}</p>
      )}
    </div>
  );
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
<<<<<<< HEAD
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>;
}

export function Loading({ label = 'Loading records' }: { label?: string }) {
  return <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
=======

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Loading({ label = 'Loading records' }: { label?: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/** Native select styled to match the shared Input control. */
export function Select({
  value,
  onChange,
  children,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    >
      {children}
    </select>
  );
}

/**
 * Per-recipient outcome returned by every send endpoint
 * ({ requested, sent, failed[], skipped[] }).
 */
export function SendSummary({
  summary,
}: {
  summary: { sent?: number; requested?: number; failed?: { reason?: string }[]; skipped?: { reason?: string }[] } | null;
}) {
  if (!summary) return null;

  const failed = summary.failed ?? [];
  const skipped = summary.skipped ?? [];
  if (!failed.length && !skipped.length) return null;

  const grouped = new Map<string, number>();
  [...failed, ...skipped].forEach((item) => {
    const reason = item.reason || 'Not sent.';
    grouped.set(reason, (grouped.get(reason) ?? 0) + 1);
  });

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-medium">
        {summary.sent ?? 0} of {summary.requested ?? 0} delivered. Not sent:
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
        {[...grouped.entries()].map(([reason, count]) => (
          <li key={reason}>
            {reason} <span className="text-amber-700">({count})</span>
          </li>
        ))}
      </ul>
    </div>
  );
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}
