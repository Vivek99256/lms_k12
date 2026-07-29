'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] space-y-5 p-3 sm:p-4 lg:p-6">{children}</div>;
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm">{title && <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">{title}</h2>}<div className="p-4 sm:p-5">{children}</div></section>;
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold text-slate-700">{label}{required && <span className="text-rose-600"> *</span>}</Label>{children}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>;
}

export function Loading({ label = 'Loading records' }: { label?: string }) {
  return <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}
