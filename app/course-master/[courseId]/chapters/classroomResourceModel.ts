/**
 * The Classroom Resource content model: how a chapter's content rows become cards, which tab each card sits under and
 * which tabs a chapter shows.
 *
 * ONE definition, used by the admin/teacher chapter page and by the student Subject section, so the two lists cannot
 * drift apart: whatever the admin sees in a chapter's Classroom Resource lane, a student sees too (the server already
 * withholds what a student must not read). It is pure - no React, no network.
 *
 * Moved here unchanged from page.tsx; only the names are now exported.
 */
import type { PrayogshalaActivity } from '../../data/prayogshala';
import type { ChapterContentAsset } from '../../data/chapters';
import { resolveViewableContentUrl } from '@/app/course-master/data/content-links';
import { extractGeneratedBodyHtml } from '@/app/course-master/data/generated-html';
import { filterCardAssets } from '@/lib/prayogshala/cardEligibility';
import { resourceTitle, type StoredDeckMetadata } from '@/lib/coursePresentation/resourceCard';
import { documentKindOf } from '@/lib/study-document/document';
import type { DocumentKind } from '@/lib/study-document/types';

/**
 * Tabs for the two library lanes.
 *
 * Both lanes were narrower than the data: Classroom had six tabs and Teacher
 * three, while content_master holds Remedial Class, Worksheet, Lesson Plan and
 * My Course rows with no tab to appear under - and Teacher Training alone is
 * 2,450 rows. Tabs whose count is zero for the chapter in view are hidden, so a
 * longer list does not mean more dead ends.
 */
export const CONTENT_LIBRARY_TABS = [
  'All content',
  'Presentations',
  'Educational Posters',
  'Videos',
  'Revision notes',
  'Classroom activity',
  'Remedial class',
  'Worksheet',
  'Lesson plan',
  'My course',
  'Interactive',
  // A chapter's flashcard deck of key words (stored as one content_master row, category 'Vocabulary Cards').
  'Vocabulary cards',
  // Merged into the chapter content list by the backend (like H5P), so it is counted
  // and filtered like every other type and also appears under 'All content'.
  'Prayogshala',
] as const;
/**
 * Teacher Workspace tabs.
 *
 * Shorter than the Classroom list on purpose. This lane only ever shows
 * teacher-training content, so of the eleven content types only 'Teacher
 * training' (2,450 rows), 'Teacher training presentation' (5) and the
 * audience-neutral H5P items can reach it. A Worksheet or Lesson plan tab here
 * would be permanently empty, so the missing tab this lane actually needed is
 * 'Teacher training' - 2,450 rows that previously had no tab of their own.
 */
export const TEACHER_CONTENT_LIBRARY_TABS = [
  'All content',
  'Presentations',
  'Teacher training',
  'Interactive',
] as const;

/** Any tab either lane can show. */
export type ContentLibraryTab =
  | (typeof CONTENT_LIBRARY_TABS)[number]
  | (typeof TEACHER_CONTENT_LIBRARY_TABS)[number];

export type ChapterContentType =
  | 'Classroom presentation'
  | 'Teacher training presentation'
  | 'Teacher training'
  | 'Revision notes'
  | 'Video'
  | 'PDF'
  | 'Classroom activity'
  | 'Remedial class'
  | 'Worksheet'
  | 'Lesson plan'
  | 'My course'
  | 'Interactive'
  | 'Vocabulary cards'
  | 'Flash cards'
  | 'Prayogshala'
  | 'Educational Posters'
  | 'Educational posters';
export type ChapterContentSource = 'Gamma AI' | 'Claude AI' | 'Uploaded' | 'Authored';

/**
 * content_master.source values written by the Generate Content flow. It has used
 * more than one marker over time, so the badge matches against the whole set
 * rather than a single string.
 */
export const GENERATED_CONTENT_SOURCES = ['gamma ai', 'aigenerated', 'claude ai'];

/**
 * Where a content row came from.
 *
 * Only an explicit generated marker counts as generated. Everything else is an
 * upload â€” including rows with no source at all, which predate the source column
 * being stamped and were created by the upload path.
 */
export function resolveContentSource(source: string | null | undefined): ChapterContentSource {
  const normalized = (source ?? '').trim().toLowerCase();
  // Prayogshala activities are written in the LMS: neither uploaded files nor generated.
  if (normalized === 'authored') return 'Authored';
  if (!GENERATED_CONTENT_SOURCES.includes(normalized)) return 'Uploaded';
  // Name the provider that actually wrote the row. Anything generated but not
  // Claude keeps the historical 'Gamma AI' label, including the legacy
  // 'aiGenerated' marker.
  return normalized === 'claude ai' ? 'Claude AI' : 'Gamma AI';
}

/** Was this row written by a generator, whichever one? */
export function isGeneratedContent(source: ChapterContentSource): boolean {
  return source !== 'Uploaded';
}
export type ChapterContentPreview = 'presentation' | 'notes' | 'video' | 'pdf' | 'activity';

export interface ChapterContentItem {
  id: string;
  title: string;
  subtitle: string;
  chapterTitle: string;
  conceptTitle: string;
  contentCategory: string;
  conceptId: string | null;
  /**
   * Name of the mapped concept, from lms_concept via content_master.concept_id.
   * Null when the content has not been mapped to a concept. Kept separate from
   * `conceptTitle`, which holds the content category and drives grouping.
   */
  conceptName: string | null;
  type: ChapterContentType;
  source: ChapterContentSource;
  preview: ChapterContentPreview;
  actionLabel: 'Open' | 'Play';
  slideCount: number;
  statValue: string;
  updatedDate: string;
  updatedAt: string;
  contentUrl?: string;
  /**
   * Sanitised HTML of an AI-generated document, read from
   * content_master.description. Null for uploads and for the older Gamma/Gemini
   * rows, whose description holds the originating prompt rather than a document.
   */
  bodyHtml: string | null;
  /** Route of the existing H5P editor this item opens in. Only set for H5P items. */
  deepLink?: string;
  /** topic_master.name - set for Prayogshala items. */
  topicName: string | null;
  /** Short description shown on the card - set for Prayogshala items. */
  summary: string | null;
  /** The whole activity, for the detail view. Only set for Prayogshala items. */
  prayogshala: PrayogshalaActivity | null;
  /** The study deck's classroom PDF, reported by the backend. A second file of the same item; Open is unchanged. */
  pdfUrl?: string;
  /** The Videos-tab section the server filed this video under; null or absent when it has none (see lib/videoGroups). */
  videoGroup?: string | null;
  /**
   * Set (by the server) when this row is a study document: revision notes, a remedial class or classroom activities. Its PDF
   * is its primary file and it opens in place in the document viewer, with an online practice beside the PDF.
   */
  studyDocKind?: DocumentKind | null;
  /** Set for an interactive classroom activity: its printed code ("A1") and step count; the card shows both and its progress. */
  activity?: { code: string; steps: number };
  chapterId?: string;
  /**
   * Set only on the dedicated Course Presentation card of a pilot chapter (lib/coursePresentation). It is what sends
   * a click to the two-choice screen; no other card carries it.
   */
  coursePresentationPilot?: boolean;
  /** Teaching method, content format, status and ids of a stored study deck, as the server reported them. Absent on other items. */
  resource?: StoredDeckMetadata;
  slides: {
    id: string;
    number: number;
    title: string;
  }[];
}

export function getApiContentType(category: string, asset: ChapterContentAsset): ChapterContentType {
  const normalizedCategory = category.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentCategory = (asset.content_category ?? '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentLabel = `${normalizedCategory} ${contentCategory} ${asset.file_type ?? ''} ${asset.title}`.toLowerCase();

  // The category is authoritative when it names a type outright, so it is tested
  // before anything that sniffs a filename or a title. These four categories had
  // no case at all and fell through to the 'Revision notes' default, which
  // mislabelled 12,965 rows - every Remedial Class, Worksheet, Lesson Plan and
  // My Course row in the table - and left them with no tab to appear under.
  if (
    contentCategory === 'educational posters' ||
    contentCategory === 'educational poster' ||
    normalizedCategory === 'educational posters' ||
    normalizedCategory === 'educational poster'
  ) {
    return 'Educational Posters';
  }
  if (contentCategory === 'remedial class') return 'Remedial class';
  if (contentCategory === 'worksheet') return 'Worksheet';
  if (contentCategory === 'lesson plan') return 'Lesson plan';
  if (contentCategory === 'my course') return 'My course';
  if (contentCategory === 'prayogshala') return 'Prayogshala';
  if (contentCategory === 'vocabulary cards') return 'Vocabulary cards';
  // lms_flashcard rows (one per key word) carry no content_category, only the 'Flash Cards' bucket they are
  // listed under; without this they fell through to the 'Revision notes' default below.
  if (normalizedCategory === 'flash cards') return 'Flash cards';
  // Authoritative for the same reason as the categories above: without it, a
  // Revision Notes row whose file_type is 'pdf' matches the 'pdf' substring
  // check below first and is mislabelled 'PDF' instead of 'Revision notes'.
  if (contentCategory === 'revision notes') return 'Revision notes';
  // 'Teacher Training' is the bulk category (2,450 rows) and is distinct from
  // 'Teacher training presentation' (4 rows). Matched here rather than inside the
  // presentation branch below, because most of these rows are PDFs, not decks,
  // and would otherwise be classified as revision notes.
  if (contentCategory === 'teacher training') return 'Teacher training';

  if (contentLabel.includes('video') || /\.(mp4|mov|webm)(?:$|\?)/.test(asset.filename ?? '')) return 'Video';
  if (contentLabel.includes('presentation') || /\.(ppt|pptx)(?:$|\?)/.test(asset.filename ?? '')) {
    if (contentLabel.includes('teacher training')) return 'Teacher training presentation';
    return 'Classroom presentation';
  }
  // H5P assets are merged in by H5PContentAdapter with format='h5p' and their own
  // category, so they are identified by that rather than by guessing from a filename.
  if (asset.format === 'h5p' || contentCategory === 'interactive') return 'Interactive';
  if (contentLabel.includes('classroom activity')) return 'Classroom activity';
  if (contentLabel.includes('remedial')) return 'Remedial class';
  if (contentLabel.includes('worksheet')) return 'Worksheet';
  if (contentLabel.includes('lesson plan')) return 'Lesson plan';
  if (contentLabel.includes('pdf')) return 'PDF';
  return 'Revision notes';
}

export function buildApiChapterContentItems(
  chapter: { id: string; title: string },
  categories: Record<string, ChapterContentAsset[]>
): ChapterContentItem[] {
  return Object.entries(categories).flatMap(([category, assets]) =>
    filterCardAssets(assets, chapter.id).map((asset) => {
      const type = getApiContentType(category, asset);
      const contentUrl = resolveViewableContentUrl(asset);
      const updatedDate = asset.created_at?.split(' ')[0] ?? 'â€”';
      const rawConceptId =
        asset.concept_id === null || asset.concept_id === undefined
          ? null
          : String(asset.concept_id).trim();
      const source = resolveContentSource(asset.source);

      // A stored study deck says what it was made as; its card is titled and badged from that, never from its siblings.
      const resource: StoredDeckMetadata | undefined = asset.content_format
        ? {
            content_id: asset.content_id,
            teaching_method: asset.teaching_method,
            teaching_method_label: asset.teaching_method_label,
            teaching_method_short: asset.teaching_method_short,
            content_format: asset.content_format,
            content_format_label: asset.content_format_label,
            generation_status: asset.generation_status,
            generation_run_id: asset.generation_run_id,
          }
        : undefined;

      return {
        id: String(asset.id),
        title: resource ? resourceTitle(chapter.title, resource, asset.title || 'Untitled content') : asset.title || 'Untitled content',
        resource,
        subtitle: category,
        chapterTitle: chapter.title,
        conceptTitle: category,
        contentCategory: asset.content_category ?? category,
        conceptId: rawConceptId && rawConceptId !== '0' ? rawConceptId : null,
        conceptName: asset.concept_name?.trim() ? asset.concept_name.trim() : null,
        type,
        source,
        preview: getChapterContentPreview(type),
        actionLabel: type === 'Video' ? 'Play' : 'Open',
        slideCount: 0,
        statValue: asset.prayogshala?.activity_type_label || asset.file_type || category,
        updatedDate,
        updatedAt: updatedDate === 'â€”' ? 'Date unavailable' : `updated ${updatedDate}`,
        contentUrl,
        bodyHtml: extractGeneratedBodyHtml(asset.description, isGeneratedContent(source)),
        slides: [],
        // Where an H5P card opens. The existing /h5p/* editors keep all the CRUD,
        // which is what makes removing the top-level H5P button non-destructive.
        deepLink: asset.deep_link,
        topicName: asset.topic_name?.trim() ? asset.topic_name.trim() : null,
        summary: type === 'Prayogshala' ? (asset.prayogshala?.objective ?? asset.description ?? null) : null,
        prayogshala: asset.prayogshala ?? null,
        pdfUrl: asset.pdf_url,
        videoGroup: asset.video_group ?? null,
        studyDocKind: documentKindOf(asset),
        activity: asset.activity_code ? { code: asset.activity_code, steps: Number(asset.activity_steps) || 0 } : undefined,
        chapterId: chapter.id,
      };
    })
  );
}

export function getChapterContentPreview(type: ChapterContentType): ChapterContentPreview {
  if (type === 'Educational Posters' || type === 'Educational posters') return 'notes';
  if (type === 'Interactive') return 'video';
  if (type === 'Vocabulary cards' || type === 'Flash cards') return 'activity';
  if (type === 'Video') return 'video';
  if (type === 'Revision notes') return 'notes';
  if (type === 'PDF') return 'pdf';
  if (type === 'Classroom activity' || type === 'Prayogshala') return 'activity';
  // Worksheets and remedial packs are things a class works through, so they
  // preview as activities; a lesson plan is a document.
  if (type === 'Worksheet' || type === 'Remedial class') return 'activity';
  if (type === 'Lesson plan' || type === 'Teacher training') return 'notes';
  return 'presentation';
}


export function isTeacherTrainingContent(item: ChapterContentItem): boolean {
  return `${item.contentCategory ?? ''} ${item.type}`.toLowerCase().includes('teacher');
}

/**
 * Does an item belong under a library tab?
 *
 * Module-level and exported to the count logic so the tab strip's numbers and
 * the grid below it cannot disagree. Previously this lived inline in the filter
 * callback, which meant a tab count could only be had by duplicating the rules.
 *
 * Teacher Workspace once short-circuited this to `true`, so its tab strip
 * rendered but filtered nothing - "All content" and "Presentations" returned an
 * identical list. Presentations means presentations on both surfaces.
 */
export function contentMatchesTab(item: ChapterContentItem, tab: string): boolean {
  switch (tab) {
    case 'All content':
      return true;
    case 'Presentations':
      return (
        item.type === 'Classroom presentation' || item.type === 'Teacher training presentation'
      );
    case 'Educational Posters':
    case 'Educational posters':
      return item.type === 'Educational Posters' || item.type === 'Educational posters';
    case 'Videos':
      return item.type === 'Video';
    case 'Revision notes':
      return item.type === 'Revision notes' || item.type === 'PDF';
    case 'Classroom activity':
      return item.type === 'Classroom activity';
    case 'Remedial class':
      return item.type === 'Remedial class';
    case 'Worksheet':
      return item.type === 'Worksheet';
    case 'Lesson plan':
      return item.type === 'Lesson plan';
    case 'My course':
      return item.type === 'My course';
    // The Teacher Workspace tab for the bulk 'Teacher Training' category. It
    // deliberately also catches the 4 'Teacher training presentation' rows, so
    // no teacher-training row is unreachable from this lane.
    case 'Teacher training':
      return item.type === 'Teacher training' || item.type === 'Teacher training presentation';
    case 'Interactive':
      return item.type === 'Interactive';
    case 'Prayogshala':
      return item.type === 'Prayogshala';
    case 'Vocabulary cards':
      return item.type === 'Vocabulary cards';
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The list a lane shows. These are the rules page.tsx used inline (contentItemsForActiveLane, the tab counts, the visible
// tabs, the source dropdown); they live here so the student Subject section applies the very same ones.
// ---------------------------------------------------------------------------------------------------------------------

export type ContentLane = 'classroom' | 'teacher';

export function tabsForLane(lane: ContentLane): readonly string[] {
  return lane === 'teacher' ? TEACHER_CONTENT_LIBRARY_TABS : CONTENT_LIBRARY_TABS;
}

/** The items that belong to the lane, before search, source or tab narrow them. */
export function itemsInLane(items: readonly ChapterContentItem[], lane: ContentLane): ChapterContentItem[] {
  return items.filter((item) => {
    // H5P carries no audience signal in any h5p_* table, and the tracker asks for it to be reachable "inside Classroom
    // Resource AND Teacher Resource". So it is shown on both surfaces rather than being assigned an audience we cannot
    // evidence.
    const isAudienceNeutral = item.type === 'Interactive' || item.type === 'Vocabulary cards' || item.type === 'Flash cards';
    const isTeacherTraining = isTeacherTrainingContent(item);
    // Teacher Workspace only ever shows Teacher Training content; Classroom Resources never shows it.
    return isAudienceNeutral || (lane === 'teacher' ? isTeacherTraining : !isTeacherTraining);
  });
}

/**
 * Everything the current search, source and lane allow - before the tab filter. Split out from the tab filter so the tab
 * counts are computed from exactly the rows the grid would show.
 *
 * `isHiddenInLane` is the lane's own "not listed here" rule (single-word flash cards are hidden in the classroom lane;
 * the chapter's vocabulary deck stays). It is passed in, not imported, to keep this module free of page concerns.
 */
export function itemsForActiveLane(
  items: readonly ChapterContentItem[],
  options: { lane: ContentLane; search: string; source: string; showsInLane: (item: ChapterContentItem) => boolean }
): ChapterContentItem[] {
  const needle = options.search.toLowerCase();
  return itemsInLane(items, options.lane).filter((item) => {
    const matchesSearch =
      !options.search || [item.title, item.subtitle, item.type, item.chapterTitle, item.source].join(' ').toLowerCase().includes(needle);
    const matchesSource = options.source === 'all' || item.source === options.source;
    return matchesSearch && matchesSource && options.showsInLane(item);
  });
}

/** How many items each tab would show. Drives the number on the tab and whether the tab appears at all. */
export function contentTabCounts(items: readonly ChapterContentItem[], tabs: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tabs.forEach((tab) => {
    counts[tab] = items.filter((item) => contentMatchesTab(item, tab)).length;
  });
  return counts;
}

/**
 * The tabs worth showing: a tab leading to an empty grid is worse than no tab. 'All content' and 'Prayogshala' always
 * stay, and so does the tab the user is standing on, so the strip never removes the tab under them.
 */
export function visibleContentTabs(tabs: readonly string[], counts: Record<string, number>, activeTab: string): string[] {
  return tabs.filter((tab) => tab === 'All content' || tab === 'Prayogshala' || tab === activeTab || (counts[tab] ?? 0) > 0);
}

/** The sources present in the lane's own items, so the dropdown always offers every one. */
export function contentSourceOptions(laneItems: readonly ChapterContentItem[]): string[] {
  return Array.from(new Set(laneItems.map((item) => item.source))).sort();
}
