'use client';

/**
 * The trail across the top of the map: Grade | Subject | Chapter | Topic.
 *
 * Each chip is a solid label block joined to a tinted value block, as the reference
 * does, and each is a button that steps back to that level. It replaces the level
 * toggles and collapse-all controls the old toolbar carried, which existed only to
 * make a 233-node canvas survivable and have nothing to do once one concept is centred.
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
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="mr-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          // The map is a walk, so "back" means the concept you came from — not the
          // browser's history, which would leave the screen entirely.
          title="Back to the previous concept"
        >
          <ChevronLeft size={13} strokeWidth={2} aria-hidden />
          Back
        </button>
      )}

      {crumbs.map((crumb) => {
        const body = (
          <>
            <span className="bg-[#4f46e5] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              {crumb.label}
            </span>
            <span className="max-w-[16rem] truncate bg-indigo-50 px-2 py-1 text-[11.5px] font-medium text-indigo-900">
              {crumb.value}
            </span>
          </>
        );

        return crumb.onClick ? (
          <button
            key={crumb.label}
            type="button"
            onClick={crumb.onClick}
            className="inline-flex items-stretch overflow-hidden rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
            title={`Back to ${crumb.value}`}
          >
            {body}
          </button>
        ) : (
          <span key={crumb.label} className="inline-flex items-stretch overflow-hidden rounded-lg">
            {body}
          </span>
        );
      })}
    </div>
  );
}
