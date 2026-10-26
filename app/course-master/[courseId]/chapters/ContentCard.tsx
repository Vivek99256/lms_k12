'use client';

import React from 'react';
import {
  BookOpen,
  Brain,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FlaskConical,
  GitBranch,
  GraduationCap,
  Image as ImageIcon,
  Layers3,
  LifeBuoy,
  MonitorPlay,
  PencilLine,
  Plus,
  Play,
  Presentation,
  Sparkles,
  Upload,
  Video,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NOT_CONFIGURED_LABEL, resourceBadges, type StoredDeckMetadata } from '@/lib/coursePresentation/resourceCard';
import { useActivityStatus } from '@/lib/classroom-activity/useActivityStatus';

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
  /** topic_master.name. Only Prayogshala items carry it today; omitted when absent. */
  topicName?: string | null;
  /** A line or two of description under the title. Omitted when absent. */
  summary?: string | null;
  type: string;
  source: string;
  /** File extension or category, e.g. 'pdf', 'link', 'mp4'. */
  statValue: string;
  /** Pre-formatted, e.g. 'updated 2025-06-27'. Computed already but never shown. */
  updatedAt: string;
  actionLabel: 'Open' | 'Play';
  /** Set by the backend for a study deck whose classroom PDF is stored. Open is unaffected. */
  pdfUrl?: string;
  /** Set on the entry card that creates a Classroom Presentation; it is drawn as an action, not as a generated resource. */
  coursePresentationPilot?: boolean;
  /** Method, format, status and ids of a stored study deck. Absent on other items. */
  resource?: StoredDeckMetadata;
  /** Set on an interactive classroom activity: its printed code and step count. Absent on every other item. */
  activity?: { code: string; steps: number };
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
  'Educational Posters': {
    band: 'from-blue-100 via-blue-50/60 to-transparent',
    chip: 'bg-blue-100 text-blue-700',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
    icon: ImageIcon,
  },
  'Educational posters': {
    band: 'from-blue-100 via-blue-50/60 to-transparent',
    chip: 'bg-blue-100 text-blue-700',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
    icon: ImageIcon,
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
  'Vocabulary cards': {
    band: 'from-amber-100 via-amber-50/60 to-transparent',
    chip: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    icon: GraduationCap,
  },
  'Flash cards': {
    band: 'from-lime-100 via-lime-50/60 to-transparent',
    chip: 'bg-lime-100 text-lime-800',
    text: 'text-lime-700',
    ring: 'ring-lime-200',
    icon: Layers3,
  },
  'Interactive': {
    band: 'from-cyan-100 via-cyan-50/60 to-transparent',
    chip: 'bg-cyan-100 text-cyan-700',
    text: 'text-cyan-700',
    ring: 'ring-cyan-200',
    icon: MonitorPlay,
  },
  Prayogshala: {
    band: 'from-fuchsia-100 via-fuchsia-50/60 to-transparent',
    chip: 'bg-fuchsia-100 text-fuchsia-700',
    text: 'text-fuchsia-600',
    ring: 'ring-fuchsia-200',
    icon: FlaskConical,
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

const CREATE_STYLE = {
  band: 'from-indigo-100 via-indigo-50/60 to-transparent',
  chip: 'bg-indigo-600 text-white',
  text: 'text-indigo-600',
  ring: 'ring-indigo-300',
  icon: Plus,
};

const BRANCHING_STYLE = {
  band: 'from-emerald-100 via-emerald-50/60 to-transparent',
  chip: 'bg-emerald-100 text-emerald-800',
  text: 'text-emerald-700',
  ring: 'ring-emerald-200',
  icon: GitBranch,
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
  /** Offered next to Open when the item has a PDF. */
  onDownloadPdf?: (item: ContentCardItem) => void;
  /**
   * Hide the chapter pill. The grouped view already prints the group heading
   * above the grid, so repeating it on every card is noise.
   */
  hideChapter?: boolean;
}

/** The label of the action on an interactive activity's card, from how far the learner has got. */
function activityActionLabel(state: 'not_started' | 'in_progress' | 'completed' | undefined): string {
  return state === 'completed' ? 'Review activity' : state === 'in_progress' ? 'Continue activity' : 'Start activity';
}

export function ContentCard({ item, onOpen, onDownloadPdf, hideChapter = false }: ContentCardProps) {
  const isCreate = item.coursePresentationPilot === true;
  // An interactive activity says how far the learner is. Every other card passes steps 0 and ignores the answer.
  const progress = useActivityStatus(item.id, item.activity?.steps ?? 0);
  const badges = item.resource ? resourceBadges(item.resource) : null;
  // The create card, a PowerPoint and a branching scenario each get their own colour and icon, so they read apart unopened.
  const style = isCreate
    ? CREATE_STYLE
    : badges?.kind === 'branching_scenario'
      ? BRANCHING_STYLE
      : styleFor(item.type);
  const TypeIcon = isCreate ? Plus : badges?.kind === 'branching_scenario' ? GitBranch : badges?.kind === 'powerpoint' ? Presentation : style.icon;
  const typeLabel = isCreate ? 'New' : badges?.kind === 'branching_scenario' ? 'Branching scenario' : badges?.kind === 'powerpoint' ? 'PowerPoint' : item.type;
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
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className={`group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border ${isCreate ? 'border-2 border-dashed border-indigo-300 bg-indigo-50/30' : 'border-slate-200/80 bg-white'} shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.10)]`}
    >
      {/* Header band, tinted by type. The tint is the scanning cue - one grey
          gradient for every type is what made the grid unreadable.
          The gradient runs strong at the top and fades to transparent by the
          bottom, so there is no hard colour edge cutting across the icon that
          overlaps it. It previously ran the other way, which put the densest
          colour exactly where the icon sits. `pb-8` leaves room for the icon
          to hang into the faded tail rather than into solid colour. */}
      <div
        className={`flex items-start justify-between bg-gradient-to-b ${style.band} px-3 pb-8 pt-2`}
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}
        >
          <TypeIcon size={10} />
          {typeLabel}
        </span>

      </div>

      {/* `relative z-10` is load-bearing. The band above is an earlier sibling,
          and a positioned element paints over a static one regardless of DOM
          order - so while the band carried `relative` and this did not, the band
          painted across the icon. The icon must sit forward of the tint. */}
      <div className="relative z-10 -mt-7 flex justify-center px-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-[0_4px_14px_rgba(15,23,42,0.10)] ring-1 ${style.ring} ${style.text}`}
        >
          <TypeIcon size={18} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        {(!hideChapter || item.conceptName || item.topicName) && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
              
            {/* Concept exists on very few rows. Shown when present, omitted
                otherwise - never replaced by a placeholder like "General",
                which reads as real data that happens to be wrong. */}
            {/* {item.topicName && (
              <span
                className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${style.chip}`}
              >
                <Layers3 size={11} className="shrink-0" />
                {item.topicName}
              </span>
            )}
            {item.conceptName && (
              <span
                className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${style.chip}`}
              >
                <Brain size={11} className="shrink-0" />
                {item.conceptName}
              </span>
            )} */}
          </div>
        )}
    <h3 className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-slate-950">
          {item.title}
        </h3>

{/*
        {item.summary ? (
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-5 text-slate-600">{item.summary}</p>
        ) : null} */}

        {/* The line that separates two cards sharing a title. file_type is set
            on 99% of rows and the date on all of them, so this is the reliable
            differentiator - and updatedAt was already computed and thrown away. */}
        {isCreate ? (
          <p className="mt-1 text-[11px] leading-4 text-slate-600">Choose a teaching method and a content format, then create.</p>
        ) : badges ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1" data-testid="resource-badges">
            {badges.method ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{badges.method}</span>
            ) : null}
            {badges.format ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>
                <TypeIcon size={10} />
                {badges.format}
              </span>
            ) : null}
            {badges.missing ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{NOT_CONFIGURED_LABEL}</span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
          {item.activity ? (
            <span className="font-medium text-slate-600" data-testid="activity-meta">
              Activity {item.activity.code}
              {item.activity.steps > 0 ? ` · ${item.activity.steps} steps` : ''}
            </span>
          ) : (
            fileLabel && !isCreate && <span className="font-medium text-slate-600">{fileLabel}</span>
          )}
          {badges?.status ? <span className="capitalize">{badges.status}</span> : null}
        </div>
        {item.activity && progress ? (
          <p
            className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${progress.state === 'completed' ? 'bg-emerald-100 text-emerald-900' : progress.state === 'in_progress' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}
            data-testid="activity-status"
          >
            {progress.state === 'completed' ? 'Completed' : progress.state === 'in_progress' ? `In progress · ${progress.stepsDone} of ${progress.totalSteps} steps` : 'Not started'}
          </p>
        ) : null}

        {/* Stops the card's own onClick from firing when the gap between the
            buttons is clicked - only the designated area above should open
            the item from a bare click; this footer opens only via the
            buttons themselves. */}
        <div
          onClick={(event) => event.stopPropagation()}
          className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item);
            }}
            aria-label={isCreate ? item.title : item.actionLabel === 'Play' ? `Play: ${item.title}` : `${item.pdfUrl ? 'View PDF' : 'View'}: ${item.title}`}
            className="h-7 w-7 shrink-0 rounded-full bg-slate-100 p-0 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          >
            {isCreate ? <Plus size={13} /> : item.actionLabel === 'Play' ? <Play size={13} /> : <Eye size={13} />}
          </Button>
          {item.activity ? (
            <Button
              type="button"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
              className="h-7 flex-1 justify-end rounded-full px-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
            >
              {activityActionLabel(progress?.state)}
              <Play size={11} className="ml-1" />
            </Button>
          ) : null}
          {item.pdfUrl && onDownloadPdf ? (
            <Button
              type="button"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onDownloadPdf(item);
              }}
              aria-label={`Download PDF: ${item.title}`}
              className="h-7 w-7 shrink-0 rounded-full p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <Download size={13} />
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default ContentCard;