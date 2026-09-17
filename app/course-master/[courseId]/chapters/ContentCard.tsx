'use client';

import React from 'react';
import {
  BookOpen,
  Brain,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
  Layers3,
  LifeBuoy,
  MonitorPlay,
  Play,
  Presentation,
  Sparkles,
  Upload,
  Video,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The one content card used by Classroom Resource and Teacher Workspace.
 *
 * It exists because the card markup was duplicated verbatim in two places in
 * page.tsx - the grouped view and the flat view - and the copies had already
 * drifted: only the grouped one rendered the concept name, through an
 * inline-styled patch. Two copies of a card is two cards to keep in step, so
 * there is now one.
 *
 * What the card has to solve: on a typical chapter the cards were visually
 * identical. The type was never shown, every card used the same grey header and
 * the same indigo icon, and 1,569 of the 28,497 visible rows have a title that
 * is just their category ("Classroom Presentation", "Revision Notes"), so the
 * title alone cannot separate them. Type, file type and date can - file_type is
 * present on 99% of rows and created_at on 100% - so those are what the card
 * leads with. Nothing here is inferred or invented: a field that is absent is
 * omitted rather than guessed at.
 */

/**
 * Only the fields the card draws. Declared structurally rather than importing
 * ChapterContentItem from page.tsx, which would make the two files import each
 * other.
 */
export interface ContentCardItem {
  id: string;
  title: string;
  /** The content category. Now drawn as the type badge, not as a prose pill. */
  subtitle: string;
  chapterTitle: string;
  contentCategory: string;
  /** From lms_concept. Null on all but ~25 rows, so it must degrade cleanly. */
  conceptName: string | null;
  type: string;
  source: string;
  /** File extension or category, e.g. 'pdf', 'link', 'mp4'. */
  statValue: string;
  /** Pre-formatted, e.g. 'updated 2025-06-27'. Computed already but never shown. */
  updatedAt: string;
  actionLabel: 'Open' | 'Play';
}

/**
 * Per-type colour and icon.
 *
 * The point of the colour is scanning: a wall of cards should separate by type
 * before a single word is read. Keys are the ChapterContentType values; the
 * lookup falls back to a neutral slate so a type added later still renders.
 */
const TYPE_STYLES: Record<
  string,
  { band: string; chip: string; text: string; ring: string; icon: React.ElementType }
> = {
  'Classroom presentation': {
    band: 'from-violet-100 via-violet-50/60 to-transparent',
    chip: 'bg-violet-100 text-violet-700',
    text: 'text-violet-600',
    ring: 'ring-violet-200',
    icon: Presentation,
  },
  'Teacher training presentation': {
    band: 'from-indigo-100 via-indigo-50/60 to-transparent',
    chip: 'bg-indigo-100 text-indigo-700',
    text: 'text-indigo-600',
    ring: 'ring-indigo-200',
    icon: GraduationCap,
  },
  'Teacher training': {
    band: 'from-indigo-100 via-indigo-50/60 to-transparent',
    chip: 'bg-indigo-100 text-indigo-700',
    text: 'text-indigo-600',
    ring: 'ring-indigo-200',
    icon: GraduationCap,
  },
  Video: {
    band: 'from-rose-100 via-rose-50/60 to-transparent',
    chip: 'bg-rose-100 text-rose-700',
    text: 'text-rose-600',
    ring: 'ring-rose-200',
    icon: Video,
  },
  'Revision notes': {
    band: 'from-amber-100 via-amber-50/60 to-transparent',
    chip: 'bg-amber-100 text-amber-800',
    text: 'text-amber-600',
    ring: 'ring-amber-200',
    icon: FileText,
  },
  'Classroom activity': {
    band: 'from-emerald-100 via-emerald-50/60 to-transparent',
    chip: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-600',
    ring: 'ring-emerald-200',
    icon: ClipboardList,
  },
  'Remedial class': {
    band: 'from-orange-100 via-orange-50/60 to-transparent',
    chip: 'bg-orange-100 text-orange-700',
    text: 'text-orange-600',
    ring: 'ring-orange-200',
    icon: LifeBuoy,
  },
  Worksheet: {
    band: 'from-sky-100 via-sky-50/60 to-transparent',
    chip: 'bg-sky-100 text-sky-700',
    text: 'text-sky-600',
    ring: 'ring-sky-200',
    icon: Wrench,
  },
  'Lesson plan': {
    band: 'from-slate-200 via-slate-100/60 to-transparent',
    chip: 'bg-slate-200 text-slate-700',
    text: 'text-slate-600',
    ring: 'ring-slate-300',
    icon: Layers3,
  },
  PDF: {
    band: 'from-stone-200 via-stone-100/60 to-transparent',
    chip: 'bg-stone-200 text-stone-700',
    text: 'text-stone-600',
    ring: 'ring-stone-300',
    icon: FileText,
  },
  'H5P Interactive': {
    band: 'from-cyan-100 via-cyan-50/60 to-transparent',
    chip: 'bg-cyan-100 text-cyan-700',
    text: 'text-cyan-700',
    ring: 'ring-cyan-200',
    icon: MonitorPlay,
  },
  'My course': {
    band: 'from-teal-100 via-teal-50/60 to-transparent',
    chip: 'bg-teal-100 text-teal-700',
    text: 'text-teal-600',
    ring: 'ring-teal-200',
    icon: BookOpen,
  },
};

const FALLBACK_STYLE = {
  band: 'from-slate-200 via-slate-100/60 to-transparent',
  chip: 'bg-slate-200 text-slate-700',
  text: 'text-slate-600',
  ring: 'ring-slate-300',
  icon: BookOpen,
};

function styleFor(type: string) {
  return TYPE_STYLES[type] ?? FALLBACK_STYLE;
}

const GENERATED_SOURCES = ['gamma ai', 'aigenerated', 'claude ai'];

function isGenerated(source: string): boolean {
  return GENERATED_SOURCES.includes(source.trim().toLowerCase());
}

interface ContentCardProps {
  item: ContentCardItem;
  onOpen: (item: ContentCardItem) => void;
  /**
   * Hide the chapter pill. The grouped view already prints the group heading
   * above the grid, so repeating it on every card is noise.
   */
  hideChapter?: boolean;
}

export function ContentCard({ item, onOpen, hideChapter = false }: ContentCardProps) {
  const style = styleFor(item.type);
  const TypeIcon = style.icon;
  const fileType = item.statValue?.trim();
  // 'link' is how the table records an external URL; it is not a file format,
  // so it is worth saying plainly rather than showing as an extension.
  const fileLabel = !fileType
    ? null
    : fileType.toLowerCase() === 'link'
      ? 'External link'
      : fileType.toUpperCase();

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_10px_30px_rgba(15,23,42,0.10)]"
    >
      {/* Header band, tinted by type. The tint is the scanning cue - one grey
          gradient for every type is what made the grid unreadable.
          The gradient runs strong at the top and fades to transparent by the
          bottom, so there is no hard colour edge cutting across the icon that
          overlaps it. It previously ran the other way, which put the densest
          colour exactly where the icon sits. `pb-12` leaves room for the icon
          to hang into the faded tail rather than into solid colour. */}
      <div
        className={`flex items-start justify-between bg-gradient-to-b ${style.band} px-4 pb-12 pt-3`}
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.chip}`}
        >
          <TypeIcon size={12} />
          {item.type}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-500">
          {isGenerated(item.source) ? (
            <Sparkles size={12} className={style.text} />
          ) : (
            <Upload size={12} />
          )}
          {item.source}
        </span>
      </div>

      {/* `relative z-10` is load-bearing. The band above is an earlier sibling,
          and a positioned element paints over a static one regardless of DOM
          order - so while the band carried `relative` and this did not, the band
          painted across the icon. The icon must sit forward of the tint. */}
      <div className="relative z-10 -mt-10 flex justify-center px-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_4px_14px_rgba(15,23,42,0.10)] ring-1 ${style.ring} ${style.text}`}
        >
          <TypeIcon size={26} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {(!hideChapter || item.conceptName) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {!hideChapter && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                <BookOpen size={11} className="shrink-0" />
                {item.chapterTitle}
              </span>
            )}
            {/* Concept exists on very few rows. Shown when present, omitted
                otherwise - never replaced by a placeholder like "General",
                which reads as real data that happens to be wrong. */}
            {item.conceptName && (
              <span
                className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${style.chip}`}
              >
                <Brain size={11} className="shrink-0" />
                {item.conceptName}
              </span>
            )}
          </div>
        )}

        <h3 className="line-clamp-2 text-[17px] font-semibold leading-6 text-slate-950">
          {item.title}
        </h3>

        {/* The line that separates two cards sharing a title. file_type is set
            on 99% of rows and the date on all of them, so this is the reliable
            differentiator - and updatedAt was already computed and thrown away. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          {fileLabel && <span className="font-medium text-slate-600">{fileLabel}</span>}
          {fileLabel && item.updatedAt && <span aria-hidden>·</span>}
          {item.updatedAt && <span>{item.updatedAt}</span>}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-200/80 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item);
            }}
            className="h-9 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          >
            {item.actionLabel === 'Play' ? (
              <Play size={14} className="mr-2" />
            ) : (
              <Eye size={14} className="mr-2" />
            )}
            {item.actionLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default ContentCard;