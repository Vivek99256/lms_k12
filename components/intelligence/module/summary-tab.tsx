'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  summaryPart,
  summaryPartBadge,
  summaryPartsFor,
  type SummaryPartKey,
} from '@/lib/intelligence/module-tabs';

import type { SectionCopy, SectionKey } from './contract';
import type { MetricGroup, ModuleIntelligencePayload } from './payload';
import {
  BreakdownsSection,
  DataQualitySection,
  FindingsSection,
  LearningSection,
  PositionSection,
  PrioritiesSection,
  SummarySection,
} from './sections';

/**
 * The Summary tab: the management summary, then everything that used to be a tab of its own.
 *
 * Position, Breakdowns, Findings, Priorities, Data quality and Learning are rendered here by the
 * SAME section components, from the SAME payload, with the SAME contract copy, extra cards, refresh
 * action and empty-state reasons they had as separate tabs. This file decides only the order, the
 * collapsible frame around each part and the in-page navigation. It computes no figure, makes no
 * request, and replaces no content.
 *
 * Every part is expanded by default and stays mounted when collapsed (`hidden`, not unmounted), so a
 * finding or a warning is never out of the page - collapsing is the reader's choice, not the
 * layout's.
 */

export interface SummaryFocus {
  part: SummaryPartKey;
  /** Changes on every request so asking for the same part twice scrolls twice. */
  nonce: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function SummaryTab({
  declared,
  copyFor,
  data,
  summaryMetrics,
  extrasFor,
  onRecompute,
  running,
  focus,
}: {
  /** The section keys the contract declares; parts the module omitted are not invented. */
  declared: readonly string[];
  copyFor: (key: SectionKey) => SectionCopy;
  data: ModuleIntelligencePayload;
  summaryMetrics: MetricGroup['metrics'];
  extrasFor: (key: SectionKey) => ReactNode;
  onRecompute?: () => void;
  running: boolean;
  focus?: SummaryFocus | null;
}) {
  const parts = summaryPartsFor(declared);
  const collapsibleKeys = parts.filter((part) => part.key !== 'summary').map((part) => part.key);
  const [collapsed, setCollapsed] = useState<ReadonlySet<SummaryPartKey>>(new Set());

  const jumpTo = useCallback((key: SummaryPartKey) => {
    // A part the reader jumps to is always opened first: a link must never land on a closed box.
    setCollapsed((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    window.requestAnimationFrame(() => {
      document.getElementById(summaryPart(key).anchorId)?.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    });
  }, []);

  // An old section link (or a request from the screen) names a part to open and scroll to.
  useEffect(() => {
    // Opens the requested part and scrolls the DOM to it, in response to an external request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (focus) jumpTo(focus.part);
  }, [focus, jumpTo]);

  const toggle = (key: SummaryPartKey) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allOpen = collapsed.size === 0;

  const renderPart = (key: SummaryPartKey): ReactNode => {
    switch (key) {
      case 'position':
        return <PositionSection copy={copyFor('position')} position={data.position} extras={extrasFor('position')} />;
      case 'breakdowns':
        return <BreakdownsSection copy={copyFor('breakdowns')} breakdowns={data.breakdowns} extras={extrasFor('breakdowns')} />;
      case 'findings':
        return (
          <FindingsSection
            copy={copyFor('findings')}
            findings={data.findings}
            ruleStatus={data.ruleStatus}
            freshness={data.freshness}
            onRecompute={onRecompute}
            running={running}
            extras={extrasFor('findings')}
          />
        );
      case 'priorities':
        return <PrioritiesSection copy={copyFor('priorities')} priorities={data.priorities} extras={extrasFor('priorities')} />;
      case 'dataQuality':
        return <DataQualitySection copy={copyFor('dataQuality')} dataQuality={data.dataQuality} extras={extrasFor('dataQuality')} />;
      case 'learning':
        return <LearningSection copy={copyFor('learning')} learning={data.learning} extras={extrasFor('learning')} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div id={summaryPart('summary').anchorId} className="scroll-mt-24">
        <SummarySection copy={copyFor('summary')} summary={data.summary} metrics={summaryMetrics} />
      </div>

      {/* ------------------------------------------------ in-page navigation */}
      <nav
        aria-label="Jump to a part of this summary"
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
      >
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">On this page</span>
        {parts
          .filter((part) => part.key !== 'summary')
          .map((part) => {
            const badge = summaryPartBadge(part.key, data);
            return (
              <a
                key={part.key}
                href={`#${part.anchorId}`}
                onClick={(event) => {
                  event.preventDefault();
                  jumpTo(part.key);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-[#5F7087] transition hover:bg-slate-50 hover:text-slate-900"
              >
                {part.label}
                {badge ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                      badge.attention ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {badge.text}
                  </span>
                ) : null}
              </a>
            );
          })}
        <button
          type="button"
          onClick={() => setCollapsed(allOpen ? new Set(collapsibleKeys) : new Set())}
          className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </nav>

      {/* ------------------------------------------------ the former tabs */}
      {parts
        .filter((part) => part.key !== 'summary')
        .map((part) => {
          const badge = summaryPartBadge(part.key, data);
          const isCollapsed = collapsed.has(part.key);
          const bodyId = `${part.anchorId}-body`;

          return (
            <section
              key={part.key}
              id={part.anchorId}
              aria-label={part.label}
              className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50/40"
            >
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={bodyId}
                onClick={() => toggle(part.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-700">{part.label}</span>
                  {badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        badge.attention ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {badge.text}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {/* `hidden`, not unmounted: collapsed content stays in the page. */}
              <div id={bodyId} hidden={isCollapsed} className="border-t border-slate-200 bg-white px-4 py-5">
                {renderPart(part.key)}
              </div>
            </section>
          );
        })}
    </div>
  );
}
