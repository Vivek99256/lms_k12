'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { usePageAiContext, type PageAiDescriptor, type PageMetric, type PageAction } from '@/contexts/PageAiContext';
import { useStuckUserAssistance } from '@/hooks/use-stuck-user-assistance';
import type { StuckPromptContext } from '@/lib/ai/stuck-assist-types';

/**
 * The idle watcher — no UI of its own.
 *
 * The "are you stuck?" prompt itself lives inside `ChatbotPanel`, as an ordinary
 * chat bubble, not a modal: a centred popup interrupted the screen and read as a
 * separate system talking over the app, which is the opposite of what this feature
 * is for. This component's only job is noticing the idle threshold and handing the
 * panel enough context to open the conversation itself.
 *
 * RUNS ON EVERY SCREEN; RICHER ON SOME
 *
 * An earlier version only ran where `usePageAiContext()` had a descriptor — three
 * screens — so the prompt silently never fired anywhere else, which read as "the
 * feature doesn't work" rather than "this screen hasn't opted into detail yet". The
 * timer now runs everywhere. Where a screen has registered rich context (today: the
 * Fees collection list, the Attendance register, the Admissions enquiry list) that
 * detail travels with the context this hands over — used today by the "no, I'm
 * fine" support-ticket path, and by whatever reads `StuckPromptContext` next; where
 * a screen has not registered anything richer, the fallback below still names the
 * real screen from its title and URL rather than nothing at all.
 */
function joinOrNone(parts: string[]): string | null {
  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(', ') : null;
}

function summariseFilters(descriptor: PageAiDescriptor): string | null {
  if (!descriptor.filters) return null;
  const entries: Array<{ key: string; label?: string; value: unknown }> = Array.isArray(descriptor.filters)
    ? descriptor.filters
    : Object.entries(descriptor.filters).map(([key, value]) => ({ key, value }));
  return joinOrNone(
    entries
      .filter((f) => f.value !== null && f.value !== undefined && String(f.value).trim() !== '')
      .map((f) => `${f.label ?? f.key}: ${String(f.value)}`)
  );
}

function summariseMetrics(descriptor: PageAiDescriptor): string | null {
  if (!descriptor.metrics) return null;
  const entries: PageMetric[] = Array.isArray(descriptor.metrics)
    ? descriptor.metrics
    : Object.entries(descriptor.metrics).map(([key, value]) => ({ key, value }));
  return joinOrNone(entries.map((m) => `${m.label ?? m.key}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`));
}

function summariseActions(descriptor: PageAiDescriptor): string | null {
  if (!descriptor.availableActions) return null;
  return joinOrNone(
    descriptor.availableActions.map((a: PageAction | string) => (typeof a === 'string' ? a : a.label ?? a.key))
  );
}

/**
 * The module key from the URL's first segment — e.g. `/fees/collect` → `fees`.
 *
 * Not `descriptor.entityType`: that field names the *record* a page is about (a
 * student, a class section), a different thing from which module owns the screen,
 * and most of this session's registered pages don't set it at all.
 */
function moduleFromPathname(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment || null;
}

export function StuckUserAssistant({
  chatbotOpen,
  onStuck,
}: {
  /** The idle timer stops while the user is already talking to the assistant. */
  chatbotOpen: boolean;
  /** Fires once, the moment the idle threshold is crossed. */
  onStuck: (context: StuckPromptContext) => void;
}) {
  const pathname = usePathname();
  const { descriptor } = usePageAiContext();
  const { triggered, idleSeconds, reset } = useStuckUserAssistance({ enabled: !chatbotOpen });

  // A side effect — opening the chatbot, clearing this component's own state —
  // belongs in an effect, not in the render body: calling `onStuck` (which updates
  // DashboardShell's state) while this component is still rendering is exactly the
  // "setState during another component's render" React warns about, and here it
  // would also re-render with `triggered` still true before `reset()` took effect,
  // firing `onStuck` again on every subsequent render.
  useEffect(() => {
    if (!triggered) return;

    const fallbackTitle =
      (typeof document !== 'undefined' && document.title.trim()) || pathname;

    onStuck(
      descriptor
        ? {
            idleSeconds,
            pageTitle: descriptor.pageTitle ?? fallbackTitle,
            pageType: descriptor.pageType ?? null,
            module: moduleFromPathname(pathname),
            filtersSummary: summariseFilters(descriptor),
            metricsSummary: summariseMetrics(descriptor),
            availableActionsSummary: summariseActions(descriptor),
          }
        : {
            // No screen has registered anything richer here. Still real and
            // honest — the title and module are what the URL and browser tab
            // actually say — just thinner than a screen with a descriptor.
            idleSeconds,
            pageTitle: fallbackTitle,
            pageType: null,
            module: moduleFromPathname(pathname),
            filtersSummary: null,
            metricsSummary: null,
            availableActionsSummary: null,
          }
    );
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered]);

  return null;
}
