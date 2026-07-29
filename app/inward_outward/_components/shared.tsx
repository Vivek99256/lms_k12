'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { Feedback } from '../_lib/types';

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-4 lg:p-5">{children}</div>;
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-lg font-bold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-600">{description}</p></div>
        {action}
      </div>
    </section>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white shadow-sm">{title && <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold">{title}</h2>}<div className="p-4">{children}</div></section>;
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</Label>{children}</div>;
}

export function Message({ value }: { value: Feedback | null }) {
  if (!value) return null;
  const Icon = value.type === 'success' ? CheckCircle2 : AlertCircle;
  const color = value.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : value.type === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-red-200 bg-red-50 text-red-800';
  return <div role={value.type === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${color}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{value.text}</div>;
}

export function LoadingState({ label = 'Loading records' }: { label?: string }) {
  return <div className="flex h-32 items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

export function NativeSelect({ value, onChange, children, required, disabled }: { value: string; onChange: (value: string) => void; children: ReactNode; required?: boolean; disabled?: boolean }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-slate-100">{children}</select>;
}
