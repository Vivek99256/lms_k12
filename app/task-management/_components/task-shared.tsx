'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { Label } from '@/components/ui/label';

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto space-y-4 p-3 sm:p-4 lg:p-5">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold leading-none text-slate-950">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        </div>
        {action}
      </div>
    </section>
  );
}

export function SectionPanel({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || description) && (
        <div className="border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-sm font-bold text-slate-950">{title}</h2>}
          {description && <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="border-t border-slate-200 px-4 py-3">{footer}</div>}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

export function InlineMessage({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  const classes = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : type === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-800'
      : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function LoadingRows({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-32 px-4 py-10 text-center text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--primary-blue)]" />
          {label}
        </span>
      </td>
    </tr>
  );
}

export function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-32 px-4 py-10 text-center text-sm text-slate-600">
        {label}
      </td>
    </tr>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
    >
      {children}
    </select>
  );
}

export function NativeMultiSelect({
  value,
  onChange,
  children,
  disabled,
  required,
  minHeightClassName = 'min-h-32',
}: {
  value: string[];
  onChange: (value: string[]) => void;
  children: ReactNode;
  disabled?: boolean;
  required?: boolean;
  minHeightClassName?: string;
}) {
  return (
    <select
      multiple
      value={value}
      onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
      disabled={disabled}
      required={required}
      className={`${minHeightClassName} w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100`}
    >
      {children}
    </select>
  );
}
