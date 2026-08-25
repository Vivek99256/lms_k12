'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Capability, WorkspaceContext } from '@/lib/intelligence/workspace';

/**
 * Shared chrome for the AI Workspace tabs.
 *
 * Everything here reuses the panel's existing visual language — the same rounded
 * surfaces, hairline borders and #0D6EFD accent the chat bubbles and suggested
 * prompts already use — so the workspace reads as the assistant growing extra
 * abilities rather than a different product bolted on.
 */

const TAB_LABELS: Record<Capability, string> = {
  conversational: 'Ask',
  generative: 'Create',
  agent: 'Analyse',
  workflow: 'Actions',
  ontology: 'Connections',
};

/**
 * Tab labels are deliberately plain verbs, not AI vocabulary. A teacher should not
 * need to know what "agentic" or "ontology" means to find the thing that helps them;
 * the technical names live in AI Administration, where the audience is different.
 */
export function WorkspaceTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Capability[];
  active: Capability;
  onChange: (tab: Capability) => void;
}) {
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="AI workspace"
      className="flex items-center gap-1 overflow-x-auto border-b border-gray-200/70 bg-white/60 px-3 py-2"
    >
      {tabs.map((tab) => {
        const isActive = tab === active;

        return (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              isActive
                ? 'bg-[#0D6EFD] text-white shadow-[0_8px_18px_rgba(13,110,253,0.18)]'
                : 'text-gray-600 hover:bg-blue-50/70 hover:text-[#0D6EFD]'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A one-line reminder of what the assistant is currently looking at.
 *
 * This is the visible half of context-awareness: when it says "Riya Sharma", the user
 * knows why they can ask "why is this student at risk?" without naming anyone.
 */
export function ContextBanner({
  context,
  loading,
}: {
  context: WorkspaceContext | null;
  loading?: boolean;
}) {
  // Resolving is worth showing. Otherwise the banner blinks in a moment after the
  // panel opens and the user cannot tell whether context is coming or absent.
  if (!context) {
    return loading ? (
      <div className="flex items-center gap-2 border-b border-gray-200/60 bg-blue-50/40 px-5 py-2">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-[#0D6EFD]" aria-hidden />
        <p className="text-[11px] font-medium text-gray-500">Reading this page…</p>
      </div>
    ) : null;
  }

  const subject = context.entity_label
    ? context.entity_label
    : context.page?.title || context.module_label || 'this page';

  /*
   * The second line is what the assistant can see beyond the record name: the active
   * filters, the search, how many rows, how many ticked. Stating it is what makes
   * "summarise these" feel deliberate rather than lucky — and, just as importantly,
   * shows the user when the assistant is *not* seeing what they assume it is.
   */
  const page = context.page;
  const details: string[] = [];

  if (page?.search_query) details.push(`search "${page.search_query}"`);

  if (page?.filters?.length) {
    details.push(
      page.filters
        .slice(0, 3)
        .map((filter) => `${filter.label}: ${filter.value}`)
        .join(' · ')
    );
  }

  if (context.selected_records?.length) {
    details.push(`${context.selected_records.length} selected`);
  } else if (page?.record_count) {
    details.push(`${page.record_count} shown`);
  }

  return (
    <div className="border-b border-gray-200/60 bg-blue-50/40 px-5 py-2">
      <p className="flex items-center gap-2 truncate text-[11px] font-medium text-gray-600">
        <Sparkles className="size-3.5 shrink-0 text-[#0D6EFD]" aria-hidden />
        <span className="truncate">
          Working with <span className="font-semibold text-gray-900">{subject}</span>
          {context.entity_label && context.module_label ? (
            <span className="text-gray-500"> · {context.module_label}</span>
          ) : null}
        </span>
      </p>
      {details.length ? (
        <p className="mt-0.5 truncate pl-[22px] text-[11px] text-gray-500">
          {details.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

/** A suggestion button, styled to match the existing suggested-prompt list exactly. */
export function SuggestionButton({
  label,
  description,
  badge,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  description?: string | null;
  badge?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="group w-full rounded-2xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/70 hover:shadow-[0_10px_24px_rgba(13,110,253,0.08)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 group-hover:text-[#0D6EFD]">
          {label}
        </span>
        {busy ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-[#0D6EFD]" aria-hidden />
        ) : (
          badge
        )}
      </span>
      {description ? (
        <span className="mt-0.5 block text-[11px] leading-5 text-gray-500">{description}</span>
      ) : null}
    </button>
  );
}

export function TabEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center">
      <p className="text-xs leading-5 text-gray-500">{message}</p>
    </div>
  );
}

export function TabError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-xs leading-5 text-red-700">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function TabSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {children}
    </section>
  );
}

/** Marks anything a model wrote, everywhere it appears in the panel. */
export function GeneratedTag() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
      title="Written by AI, based on the data shown. Not a recorded fact."
    >
      <Sparkles className="size-2.5" aria-hidden />
      AI draft
    </span>
  );
}
