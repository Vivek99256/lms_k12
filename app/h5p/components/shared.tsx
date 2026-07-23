'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, BookOpen, GraduationCap, Layers, Loader2, X } from 'lucide-react';
import type { H5pContext } from '../data/h5p';

/**
 * Shared UI for the H5P content module. Follows the conventions used across
 * the course-master / fees areas: white rounded cards, slate text, indigo
 * accents, lucide icons, inline banners instead of toasts.
 */

export function H5pContextChips({ ctx }: { ctx: H5pContext }) {
  const chips: Array<{ icon: typeof BookOpen; label: string; value: string }> = [
    { icon: BookOpen, label: 'Chapter', value: ctx.chapter_name || (ctx.chapter_id ? `#${ctx.chapter_id}` : '') },
    { icon: Layers, label: 'Subject', value: ctx.subject_name || (ctx.subject_id ? `#${ctx.subject_id}` : '') },
    { icon: GraduationCap, label: 'Standard', value: ctx.standard_name || (ctx.standard_id ? `#${ctx.standard_id}` : '') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips
        .filter((chip) => chip.value)
        .map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            <chip.icon className="h-3 w-3 text-indigo-500" />
            <span className="text-slate-400">{chip.label}:</span>
            {chip.value}
          </span>
        ))}
    </div>
  );
}

export function H5pPageHeader({
  title,
  description,
  ctx,
  backHref,
  actions,
}: {
  title: string;
  description?: string;
  ctx: H5pContext;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : null}
            <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
          </div>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          <div className="mt-3">
            <H5pContextChips ctx={ctx} />
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function InlineBanner({
  kind,
  message,
  onDismiss,
}: {
  kind: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span className="min-w-0 break-words">{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 transition hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Card shown when a page is opened without chapter/subject/standard context. */
export function MissingContextNotice() {
  return (
    <EmptyState
      title="Chapter context is missing"
      hint="Open H5P content from a chapter (Course master → Chapters) so the chapter, subject and standard are known."
      action={
        <Link
          href="/course-master"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
        >
          Go to course master
        </Link>
      }
    />
  );
}
