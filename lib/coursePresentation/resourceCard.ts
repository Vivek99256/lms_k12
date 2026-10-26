/**
 * What a Classroom Presentation card says about itself.
 *
 * The three cards of a chapter (the Create card, a stored PowerPoint, a stored branching scenario) must be told apart
 * without opening them. Everything shown comes from what the backend reports for the stored item (its teaching method and
 * content format, read from the item's own file name, and the run that stored it); a value the backend could not report is
 * said to be missing, never guessed from the chapter or from a sibling card.
 */
export type ResourceFormat = 'interactive_slides' | 'branching_scenario';
export type ResourceKind = 'create' | 'powerpoint' | 'branching_scenario' | 'other';

export const NOT_CONFIGURED_LABEL = 'Method/Format not configured';
export const CREATE_CARD_TITLE = 'Create Classroom Presentation';

/** The fields the content listing adds to a stored study deck (see ApiLmsCourseController). */
export interface StoredDeckMetadata {
  content_id?: number | null;
  teaching_method?: string | null;
  teaching_method_label?: string | null;
  teaching_method_short?: string | null;
  content_format?: string | null;
  content_format_label?: string | null;
  generation_status?: string | null;
  generation_run_id?: string | null;
}

export interface ResourceBadges {
  kind: ResourceKind;
  /** Teaching method badge text, or null when the method is not recorded. */
  method: string | null;
  /** Content format badge text, or null when the format is not recorded. */
  format: string | null;
  /** True when either is missing: the card then shows NOT_CONFIGURED_LABEL in place of the missing badge. */
  missing: boolean;
  contentId: number | null;
  runId: string | null;
  status: string | null;
}

const FORMAT_SHORT: Record<ResourceFormat, string> = {
  interactive_slides: 'PPT',
  branching_scenario: 'Branching Scenario',
};

const FORMAT_BADGE: Record<ResourceFormat, string> = {
  interactive_slides: 'PowerPoint',
  branching_scenario: 'Branching scenario',
};

function clean(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

export function formatKey(meta: StoredDeckMetadata): ResourceFormat | null {
  return meta.content_format === 'interactive_slides' || meta.content_format === 'branching_scenario' ? meta.content_format : null;
}

export function resourceKindOf(meta: StoredDeckMetadata | null | undefined): ResourceKind {
  const format = meta ? formatKey(meta) : null;
  return format === 'interactive_slides' ? 'powerpoint' : format === 'branching_scenario' ? 'branching_scenario' : 'other';
}

export function resourceBadges(meta: StoredDeckMetadata): ResourceBadges {
  const format = formatKey(meta);
  const method = clean(meta.teaching_method_label) ?? clean(meta.teaching_method_short);
  const contentId = Number(meta.content_id);
  return {
    kind: resourceKindOf(meta),
    method,
    format: format ? clean(meta.content_format_label) ?? FORMAT_BADGE[format] : null,
    missing: method === null || format === null,
    contentId: Number.isInteger(contentId) && contentId > 0 ? contentId : null,
    runId: clean(meta.generation_run_id),
    status: clean(meta.generation_status),
  };
}

/**
 * "Global Water Resources — Inquiry-Based PPT". Built only when BOTH the method and the format are known; otherwise the
 * stored title is kept, so a card never claims a method or format it was not made for.
 */
export function resourceTitle(chapterTitle: string, meta: StoredDeckMetadata, storedTitle: string): string {
  const format = formatKey(meta);
  const method = clean(meta.teaching_method_short) ?? clean(meta.teaching_method_label);
  const chapter = chapterTitle.trim();
  if (!format || !method || chapter === '') return storedTitle;
  return `${chapter} — ${method} ${FORMAT_SHORT[format]}`;
}

/**
 * Where View opens: the item's own deep link, and only when it names this item's content id. A link for any other item of
 * the chapter is refused, so View can never land on a sibling resource.
 */
export function viewTarget(deepLink: string | undefined, itemId: string): string | null {
  if (!deepLink) return null;
  const match = /[?&]content=(\d+)(?:&|$)/.exec(deepLink);
  return match && match[1] === String(Number(itemId)) ? deepLink : null;
}
