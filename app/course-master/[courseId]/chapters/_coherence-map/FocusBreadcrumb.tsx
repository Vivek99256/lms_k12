'use client';

/**
 * The trail across the top of the map: Grade | Subject | Chapter | Topic.
 *
 * Each chip is a solid label block joined to a tinted value block, as the reference
 * does — down to its exact colours (green label, warm-beige value) — and each is a
 * button that steps back to that level. It replaces the level toggles and
 * collapse-all controls the old toolbar carried, which existed only to make a
 * 233-node canvas survivable and have nothing to do once one concept is centred.
 *
 * The Topic chip is OMITTED when a concept has none rather than shown empty. Concepts
 * without a topic are the normal case on several courses — the backend reports
 * `topic_level_available` precisely because of it — and a chip reading "Topic —" is a
 * control that looks broken instead of a level that is genuinely absent.
 */

import { ChevronLeft } from 'lucide-react';

import type { CoherenceMap } from '@/app/course-master/data/coherenceMap';

import type { FocusNode } from './focusLayout';

export type Crumb = { label: string; value: string; onClick?: () => void };

const CRUMB_THEMES: Record<string, { tagBg: string; valueBg: string; valueText: string; border: string }> = {
  Grade: {
    tagBg: 'bg-slate-700',
    valueBg: 'bg-slate-50',
    valueText: 'text-slate-800',
    border: 'border-slate-300/80',
  },
  Subject: {
    tagBg: 'bg-indigo-600',
    valueBg: 'bg-indigo-50/70',
    valueText: 'text-indigo-950 font-semibold',
    border: 'border-indigo-200/80',
  },
  Chapter: {
    tagBg: 'bg-sky-600',
    valueBg: 'bg-sky-50/70',
    valueText: 'text-sky-950 font-semibold',
    border: 'border-sky-200/80',
  },
  Topic: {
    tagBg: 'bg-purple-600',
    valueBg: 'bg-purple-50/70',
    valueText: 'text-purple-950 font-semibold',
    border: 'border-purple-200/80',
  },
};

/**
 * Build the trail for the centred concept.
 *
 * Grade and Subject come from the CONCEPT's own scope, not the screen's, so that after
 * walking into another grade the trail says where you actually are. That is the only
 * signal a teacher gets that they have left the course they opened, which is why it
 * reads the off-map names in preference to the page's.
 */
export function crumbsFor(
  map: CoherenceMap,
  node: FocusNode | null,
  onClearToDeck: () => void
): Crumb[] {
  if (!node) return [];

  const meta = node.meta as Record<string, unknown>;
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

  const grade = text(meta.standard_name) ?? text(map.meta.standard_name);
  const subject = text(meta.subject_name) ?? text(map.meta.subject_name);

  const chapter =
    node.ancestry.find((a) => a.type === 'chapter')?.label ?? text(meta.chapter_name);
  const topic = node.ancestry.find((a) => a.type === 'topic')?.label ?? null;

  const crumbs: Crumb[] = [];

  if (grade) crumbs.push({ label: 'Grade', value: grade });
  if (subject) crumbs.push({ label: 'Subject', value: subject });
  if (chapter) crumbs.push({ label: 'Chapter', value: chapter, onClick: onClearToDeck });
  if (topic) crumbs.push({ label: 'Topic', value: topic, onClick: onClearToDeck });

  return crumbs;
}

export function FocusBreadcrumb({
  crumbs,
  onBack,
  canGoBack,
}: {
  crumbs: Crumb[];
  onBack: () => void;
  canGoBack: boolean;
}) {
  if (crumbs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1"
          title="Back to the previous concept"
        >
          <ChevronLeft size={14} strokeWidth={2.2} aria-hidden />
          <span>Previous Concept</span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb) => {
          const theme = CRUMB_THEMES[crumb.label] ?? {
            tagBg: 'bg-[#059669]',
            valueBg: 'bg-slate-50',
            valueText: 'text-slate-800',
            border: 'border-slate-200',
          };

          const body = (
            <div className={`inline-flex items-stretch overflow-hidden rounded-full border ${theme.border} shadow-sm text-xs`}>
              <span className={`${theme.tagBg} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white select-none`}>
                {crumb.label}
              </span>
              <span className={`max-w-[14rem] sm:max-w-[18rem] truncate ${theme.valueBg} ${theme.valueText} px-2.5 py-1 text-[11.5px]`}>
                {crumb.value}
              </span>
            </div>
          );

          return crumb.onClick ? (
            <button
              key={crumb.label}
              type="button"
              onClick={crumb.onClick}
              className="inline-flex items-stretch transition-transform duration-150 hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 rounded-full"
              title={`Jump to ${crumb.label}: ${crumb.value}`}
            >
              {body}
            </button>
          ) : (
            <div key={crumb.label} className="inline-flex items-stretch select-none">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
