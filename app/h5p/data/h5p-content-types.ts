import { API_BASE_URL } from '@/app/components/utils/api_url';
import {
  authHeaders,
  buildFormData,
  buildGetUrl,
  contextParams,
  getApiErrorMessage,
  isApiSuccess,
  methodOverride,
  postH5pJson,
  readApiJson,
  requireSession,
  type H5pContext,
  type MutationResult,
} from './h5p';
import type { ArithmeticOperation } from '@/lib/h5p/arithmetic-quiz';
import type { MemoryFaceType } from '@/lib/h5p/memory-game';
import type { SlideElementType } from '@/lib/h5p/course-presentation-scoring';

/**
 * Data layer for the four H5P types added on 2026-09-21: Image Hotspots,
 * Memory Game, Course Presentation and Arithmetic Quiz.
 *
 * ONE API, FOUR TYPES.
 *
 * On the server these four share `H5PContentTypeController`, so they share a
 * route shape exactly: list, show, store, update, destroy, publish, duplicate,
 * media, export, import, with the same `type=API` contract and the same
 * payload keys. Writing that out four times here would be four places for the
 * `_method` quirk or the tenancy fields to drift, so `contentTypeApi()` builds
 * it once and each type supplies only its own names and row shape.
 *
 * WRITES ARE JSON, NOT MULTIPART, for all four -- the reason drag and drop
 * gives. An item is a parent plus arrays of positioned or nested children, and
 * flattening that into `points[0][icon_color]` form keys would be unreadable
 * on both sides. Media is uploaded once by `uploadMedia` and carried as URLs
 * afterwards, so a save -- including an autosave -- costs no file traffic.
 *
 * SCORING IS NOT HERE. It lives in `lib/h5p/*`, which has no imports and can
 * be tested without a browser. This file moves rows; it never decides a mark.
 */

// ---------------------------------------------------------------------------
// Shared row shape
// ---------------------------------------------------------------------------

export type H5pStatus = 'draft' | 'published';

/** What every row in this family carries, whatever its type. */
export interface H5pContentRow {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  title: string;
  description: string | null;
  status: H5pStatus | string;
  published_at: string | null;
  library: string | null;
  sub_institute_id: number | null;
  created_at?: string | null;

  /**
   * Computed server-side and sent with every row. Deliberately NOT recomputed
   * here: a list page, the player and the analytics pipeline have to agree on
   * what an item is worth, and three independent counts is three chances to
   * disagree.
   */
  label?: string;
  machine_name?: string;
  h5p_type?: string;
  max_score?: number;
}

export interface FeedbackBand {
  from: number;
  to: number;
  feedback: string;
}

export interface H5pImportResult extends MutationResult {
  id: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Image hotspots
// ---------------------------------------------------------------------------

export type HotspotPopupType = 'text' | 'image' | 'rich';

/** Lucide glyph names the player knows how to draw. Mirrors H5pImageHotspots::ICONS. */
export const HOTSPOT_ICONS = ['plus', 'info', 'circle-help', 'circle-alert', 'target', 'map-pin', 'star'] as const;
export type HotspotIcon = (typeof HOTSPOT_ICONS)[number];

export interface H5pImageHotspotPoint {
  id: number;
  image_hotspots_id: number;
  position_x: number;
  position_y: number;
  header: string | null;
  popup_type: HotspotPopupType | string;
  body_text: string | null;
  popup_image: string | null;
  popup_image_alt: string | null;
  /** Null means "inherit the item default". */
  icon_name: HotspotIcon | string | null;
  icon_color: string | null;
  /** A custom glyph URL. Wins over `icon_name` when set. */
  icon_image: string | null;
  tooltip: string | null;
  aria_label: string | null;
  popup_width: number;
  sort_order: number;
}

export interface H5pImageHotspots extends H5pContentRow {
  task_description: string | null;
  background_image: string | null;
  background_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  default_icon: HotspotIcon | string;
  default_icon_color: string;
  show_hotspot_numbers: boolean;
  points_per_hotspot: number;
  pass_percentage: number;
  enable_retry: boolean;
  single_popup_open: boolean;
  feedback_bands: FeedbackBand[] | null;
  points?: H5pImageHotspotPoint[];
}

export interface ImageHotspotPointInput {
  position_x: number;
  position_y: number;
  header: string;
  popup_type: HotspotPopupType;
  body_text: string;
  popup_image: string;
  popup_image_alt: string;
  icon_name: string;
  icon_color: string;
  icon_image: string;
  tooltip: string;
  aria_label: string;
  popup_width: number;
}

export interface ImageHotspotsSavePayload {
  title: string;
  description: string;
  task_description: string;
  background_image: string;
  background_alt: string;
  image_width: number | null;
  image_height: number | null;
  default_icon: string;
  default_icon_color: string;
  show_hotspot_numbers: boolean;
  points_per_hotspot: number;
  pass_percentage: number;
  enable_retry: boolean;
  single_popup_open: boolean;
  feedback_bands: FeedbackBand[];
  points: ImageHotspotPointInput[];
}

// ---------------------------------------------------------------------------
// Memory game
// ---------------------------------------------------------------------------

export type MemoryScoringMode = 'pairs' | 'moves';

export interface H5pMemoryGameCard {
  id: number;
  memory_game_id: number;
  pair_set: number;
  front_type: MemoryFaceType | string;
  front_text: string | null;
  front_image: string | null;
  front_alt: string | null;
  back_type: MemoryFaceType | string;
  back_text: string | null;
  back_image: string | null;
  back_alt: string | null;
  match_description: string | null;
  sort_order: number;
}

export interface H5pMemoryGame extends H5pContentRow {
  task_description: string | null;
  /** 0 means every pair in the active sets. */
  pairs_to_use: number;
  /** null means every set. */
  active_pair_sets: number[] | null;
  allow_retry: boolean;
  use_grid: boolean;
  shuffle_cards: boolean;
  show_completion_screen: boolean;
  completion_message: string | null;
  scoring_mode: MemoryScoringMode | string;
  points_per_pair: number;
  pass_percentage: number;
  track_time: boolean;
  /** 0 means untimed. */
  time_limit_seconds: number;
  theme_color: string;
  card_back_image: string | null;
  feedback_bands: FeedbackBand[] | null;
  cards?: H5pMemoryGameCard[];
}

export interface MemoryCardInput {
  pair_set: number;
  front_type: MemoryFaceType;
  front_text: string;
  front_image: string;
  front_alt: string;
  back_type: MemoryFaceType;
  back_text: string;
  back_image: string;
  back_alt: string;
  match_description: string;
}

export interface MemoryGameSavePayload {
  title: string;
  description: string;
  task_description: string;
  pairs_to_use: number;
  active_pair_sets: number[];
  allow_retry: boolean;
  use_grid: boolean;
  shuffle_cards: boolean;
  show_completion_screen: boolean;
  completion_message: string;
  scoring_mode: MemoryScoringMode;
  points_per_pair: number;
  pass_percentage: number;
  track_time: boolean;
  time_limit_seconds: number;
  theme_color: string;
  card_back_image: string;
  feedback_bands: FeedbackBand[];
  cards: MemoryCardInput[];
}

// ---------------------------------------------------------------------------
// Course presentation
// ---------------------------------------------------------------------------

export type PresentationTheme = 'default' | 'slate' | 'indigo' | 'warm' | 'high-contrast';
export type SlideTransition = 'none' | 'fade' | 'slide';

export interface H5pSlideElement {
  id: number;
  presentation_id: number;
  slide_id: number;
  element_type: SlideElementType | string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content_text: string | null;
  media_path: string | null;
  media_alt: string | null;
  options: Record<string, unknown> | null;
  /** The Drag and Drop activity a `drag_drop` element embeds. */
  ref_content_id: number | null;
  points: number;
  sort_order: number;
}

export interface H5pPresentationSlide {
  id: number;
  presentation_id: number;
  slide_index: number;
  title: string | null;
  background_image: string | null;
  background_token: string | null;
  /** Author- and teacher-facing. Never shown to a learner. */
  notes: string | null;
  /** Overrides the sequence. Null means "the next slide". */
  next_slide_id: number | null;
  elements?: H5pSlideElement[];
}

export interface H5pCoursePresentation extends H5pContentRow {
  theme: PresentationTheme | string;
  slide_transition: SlideTransition | string;
  show_progress_bar: boolean;
  show_keywords: boolean;
  show_summary_slide: boolean;
  enable_print: boolean;
  active_surface: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  pass_percentage: number;
  feedback_bands: FeedbackBand[] | null;
  slides?: H5pPresentationSlide[];
}

/**
 * Save payloads address slides by `ref`, not id.
 *
 * A ref is a client-side string that is stable for as long as the editor is
 * open. The server inserts the slides, maps ref -> real id, then writes the
 * elements and the branches with those ids -- so a brand new slide can branch
 * to another brand new slide in the same save, which is the normal case when
 * authoring from scratch.
 */
export interface SlideElementInput {
  element_type: SlideElementType;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content_text: string;
  media_path: string;
  media_alt: string;
  /**
   * The kind-specific payload. A `goto_slide` element carries
   * `target_slide_ref` here; the server swaps it for the real id.
   */
  options: Record<string, unknown>;
  ref_content_id: number | null;
  points: number;
}

export interface SlideInput {
  ref: string;
  title: string;
  background_image: string;
  background_token: string;
  notes: string;
  next_slide_ref: string;
  elements: SlideElementInput[];
}

export interface CoursePresentationSavePayload {
  title: string;
  description: string;
  theme: PresentationTheme;
  slide_transition: SlideTransition;
  show_progress_bar: boolean;
  show_keywords: boolean;
  show_summary_slide: boolean;
  enable_print: boolean;
  active_surface: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  pass_percentage: number;
  feedback_bands: FeedbackBand[];
  slides: SlideInput[];
}

// ---------------------------------------------------------------------------
// Arithmetic quiz
// ---------------------------------------------------------------------------

export interface H5pArithmeticQuiz extends H5pContentRow {
  intro_text: string | null;
  show_intro: boolean;
  operations: ArithmeticOperation[];
  difficulty_level: number;
  max_questions: number;
  enable_timer: boolean;
  /** 0 means untimed. */
  time_limit_seconds: number;
  points_per_question: number;
  pass_percentage: number;
  enable_retry: boolean;
  /** 0 means unlimited. */
  max_attempts: number;
  feedback_bands: FeedbackBand[] | null;
}

export interface ArithmeticQuizSavePayload {
  title: string;
  description: string;
  intro_text: string;
  show_intro: boolean;
  operations: ArithmeticOperation[];
  difficulty_level: number;
  max_questions: number;
  enable_timer: boolean;
  time_limit_seconds: number;
  points_per_question: number;
  pass_percentage: number;
  enable_retry: boolean;
  max_attempts: number;
  feedback_bands: FeedbackBand[];
}

// ---------------------------------------------------------------------------
// Single choice set
// ---------------------------------------------------------------------------

/**
 * The two question types below join this family unchanged: same row shape,
 * same generated client, same list and form shells. What is worth knowing
 * about them is what their payloads say about the H5P format underneath.
 *
 * SINGLE CHOICE SET CARRIES `is_correct`, NOT A POSITION. The H5P format says
 * `answers[0]` is the right one; this schema says the flag is. The conversion
 * happens once, server-side, in H5PSingleChoiceSetBuilder -- so nothing on
 * this side, including the player, may read correctness from a position. The
 * shuffle in `lib/h5p/single-choice-set.ts` is exactly why.
 */

export interface H5pSingleChoiceOption {
  id: number;
  question_id: number;
  set_id: number;
  option_text: string;
  is_correct: boolean;
  /** What to say to a learner who chose THIS option. */
  feedback: string | null;
  sort_order: number;
}

export interface H5pSingleChoiceQuestion {
  id: number;
  set_id: number;
  /** HTML, as H5P stores it. */
  question_text: string;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  /** Shown with the solution rather than with the feedback. */
  explanation: string | null;
  sort_order: number;
  options?: H5pSingleChoiceOption[];
}

export interface H5pSingleChoiceSet extends H5pContentRow {
  task_description: string | null;
  auto_continue: boolean;
  /** Milliseconds the feedback stays up before the next question. */
  timeout_correct_ms: number;
  timeout_wrong_ms: number;
  sound_effects: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBand[] | null;
  questions?: H5pSingleChoiceQuestion[];
}

export interface SingleChoiceOptionInput {
  option_text: string;
  is_correct: boolean;
  feedback: string;
}

export interface SingleChoiceQuestionInput {
  question_text: string;
  feedback_correct: string;
  feedback_incorrect: string;
  explanation: string;
  options: SingleChoiceOptionInput[];
}

export interface SingleChoiceSetSavePayload {
  title: string;
  description: string;
  task_description: string;
  auto_continue: boolean;
  timeout_correct_ms: number;
  timeout_wrong_ms: number;
  sound_effects: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBand[];
  questions: SingleChoiceQuestionInput[];
}

// ---------------------------------------------------------------------------
// True / false
// ---------------------------------------------------------------------------

/**
 * TRUE/FALSE IS A POOL, NOT A QUESTION. H5P.TrueFalse holds one statement;
 * an item here holds many and asks `questions_to_ask` of them per attempt.
 * See the backend migration for why, and `lib/h5p/true-false.ts` for how the
 * draw works.
 */

export interface H5pTrueFalseQuestion {
  id: number;
  true_false_id: number;
  /** HTML, as H5P stores it. */
  question_text: string;
  /** A real boolean here; H5P's param is the string "true"/"false". */
  correct_answer: boolean;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  explanation: string | null;
  media_image: string | null;
  media_alt: string | null;
  sort_order: number;
}

export interface H5pTrueFalse extends H5pContentRow {
  task_description: string | null;
  enable_retry: boolean;
  enable_show_solution: boolean;
  enable_check_button: boolean;
  /** Instant feedback: marked the moment an answer is chosen. */
  auto_check: boolean;
  confirm_check_dialog: boolean;
  confirm_retry_dialog: boolean;
  randomize_questions: boolean;
  /** 0 means ask the whole pool. */
  questions_to_ask: number;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBand[] | null;
  questions?: H5pTrueFalseQuestion[];
}

export interface TrueFalseQuestionInput {
  question_text: string;
  correct_answer: boolean;
  feedback_correct: string;
  feedback_incorrect: string;
  explanation: string;
  media_image: string;
  media_alt: string;
}

export interface TrueFalseSavePayload {
  title: string;
  description: string;
  task_description: string;
  enable_retry: boolean;
  enable_show_solution: boolean;
  enable_check_button: boolean;
  auto_check: boolean;
  confirm_check_dialog: boolean;
  confirm_retry_dialog: boolean;
  randomize_questions: boolean;
  questions_to_ask: number;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBand[];
  questions: TrueFalseQuestionInput[];
}

// ---------------------------------------------------------------------------
// The shared API
// ---------------------------------------------------------------------------

interface ContentTypeSpec {
  /** Route prefix under /h5p, e.g. `h5p_memory_game`. */
  path: string;
  /** JSON key a list comes back under. */
  listKey: string;
  /** JSON key one item comes back under. */
  itemKey: string;
  /** Used in error messages, so they name the thing that failed. */
  noun: string;
  /** false for a type with no media endpoint. */
  hasMedia: boolean;
}

export interface H5pContentTypeApi<TRow, TPayload> {
  list(ctx: H5pContext): Promise<TRow[]>;
  get(id: number | string, ctx: H5pContext): Promise<TRow>;
  create(ctx: H5pContext, payload: TPayload): Promise<MutationResult & { id: number }>;
  update(id: number | string, ctx: H5pContext, payload: TPayload): Promise<MutationResult>;
  remove(id: number | string, ctx: H5pContext): Promise<MutationResult>;
  publish(id: number | string, ctx: H5pContext, published: boolean): Promise<MutationResult>;
  duplicate(id: number | string, ctx: H5pContext): Promise<MutationResult & { id: number }>;
  uploadMedia(file: File, role: string): Promise<string>;
  exportPackage(id: number | string, ctx: H5pContext): Promise<{ warnings: string[] }>;
  importPackage(ctx: H5pContext, file: File): Promise<H5pImportResult>;
}

function contentTypeApi<TRow, TPayload extends Record<string, unknown>>(
  spec: ContentTypeSpec
): H5pContentTypeApi<TRow, TPayload> {
  const base = `/h5p/${spec.path}`;

  return {
    async list(ctx) {
      const session = requireSession();
      const url = buildGetUrl(base, {
        ...contextParams(ctx),
        sub_institute_id: session.sub_institute_id,
        user_profile_name: session.user_profile_name,
      });
      const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
      const raw = await readApiJson(res, `Failed to load ${spec.noun}s`);
      if (!res.ok) throw new Error(getApiErrorMessage(raw, `Failed to load ${spec.noun}s`));
      return ((raw[spec.listKey] as TRow[]) ?? []) as TRow[];
    },

    async get(id, ctx) {
      const session = requireSession();
      const url = buildGetUrl(`${base}/${id}`, {
        ...contextParams(ctx),
        sub_institute_id: session.sub_institute_id,
        user_profile_name: session.user_profile_name,
      });
      const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
      const raw = await readApiJson(res, `Failed to load ${spec.noun}`);
      if (!res.ok || !raw[spec.itemKey]) {
        throw new Error(getApiErrorMessage(raw, `${spec.noun} not found`));
      }
      return raw[spec.itemKey] as TRow;
    },

    async create(ctx, payload) {
      const session = requireSession();
      const raw = await postH5pJson(
        base,
        {
          ...contextParams(ctx),
          sub_institute_id: session.sub_institute_id,
          user_id: session.user_id,
          syear: session.syear,
          ...payload,
        },
        `Failed to create ${spec.noun}`
      );
      return {
        status: true,
        message: (raw.message as string) || 'Created successfully!',
        id: Number(raw.id ?? 0),
      };
    },

    async update(id, ctx, payload) {
      const session = requireSession();
      const raw = await postH5pJson(
        // `_method` goes in the QUERY STRING, not the body: Laravel reads the
        // override from the request bag or the query string, and a JSON body
        // populates neither.
        methodOverride(`${base}/${id}`, 'PUT'),
        {
          ...contextParams(ctx),
          sub_institute_id: session.sub_institute_id,
          user_id: session.user_id,
          ...payload,
        },
        `Failed to update ${spec.noun}`
      );
      return { status: true, message: (raw.message as string) || 'Saved.' };
    },

    async remove(id, ctx) {
      const session = requireSession();
      const raw = await postH5pJson(
        methodOverride(`${base}/${id}`, 'DELETE'),
        {
          ...contextParams(ctx),
          sub_institute_id: session.sub_institute_id,
          user_id: session.user_id,
        },
        `Failed to delete ${spec.noun}`
      );
      return { status: true, message: (raw.message as string) || 'Deleted.' };
    },

    /**
     * Publish or return to draft.
     *
     * The server refuses to publish an item that cannot be used, and that
     * error is worth showing verbatim -- it names the specific thing the
     * author still has to do ("Pair 3 is missing content on one side"), which
     * a generic failure message would throw away.
     */
    async publish(id, ctx, published) {
      const session = requireSession();
      const raw = await postH5pJson(
        `${base}/${id}/publish`,
        {
          ...contextParams(ctx),
          sub_institute_id: session.sub_institute_id,
          user_id: session.user_id,
          published,
        },
        published ? `Failed to publish ${spec.noun}` : `Failed to unpublish ${spec.noun}`
      );
      return { status: true, message: (raw.message as string) || 'Saved.' };
    },

    async duplicate(id, ctx) {
      const session = requireSession();
      const raw = await postH5pJson(
        `${base}/${id}/duplicate`,
        {
          ...contextParams(ctx),
          sub_institute_id: session.sub_institute_id,
          user_id: session.user_id,
        },
        `Failed to duplicate ${spec.noun}`
      );
      return {
        status: true,
        message: (raw.message as string) || 'Copied to a new draft.',
        id: Number(raw.id ?? 0),
      };
    },

    /** Upload one file and get its URL back. Multipart, because it is a file. */
    async uploadMedia(file, role) {
      if (!spec.hasMedia) {
        throw new Error(`${spec.noun} has no media.`);
      }

      const session = requireSession();
      const fd = buildFormData({
        sub_institute_id: session.sub_institute_id,
        user_id: session.user_id,
        role,
      });
      fd.append('file', file);

      const res = await fetch(`${API_BASE_URL}${base}/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const raw = await readApiJson(res, 'Failed to upload file');
      if (!res.ok || !isApiSuccess(raw) || !raw.url) {
        throw new Error(getApiErrorMessage(raw, 'Failed to upload file'));
      }
      return String(raw.url);
    },

    /**
     * Download this item as a .h5p package.
     *
     * Fetched as a blob rather than navigated to, so the Authorization header
     * goes with the request -- a plain `window.open` on a token-protected
     * endpoint gets an HTML login page saved as a .h5p file, which looks like
     * a corrupt export.
     *
     * The server's export notes come back in a header rather than a body,
     * because the body is the file. They are returned so the caller can tell
     * the author what a stock H5P host will not be able to render.
     */
    async exportPackage(id, ctx) {
      const session = requireSession();
      const url = buildGetUrl(`${base}/${id}/export`, {
        ...contextParams(ctx),
        sub_institute_id: session.sub_institute_id,
      });
      const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
      if (!res.ok) {
        const raw = await readApiJson(res, 'Failed to export package');
        throw new Error(getApiErrorMessage(raw, 'Failed to export package'));
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? `${spec.path}-${id}.h5p`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      return { warnings: decodeExportNotes(res.headers.get('X-H5P-Export-Notes')) };
    },

    /** Create a new draft from an uploaded .h5p package. */
    async importPackage(ctx, file) {
      const session = requireSession();
      const fd = buildFormData({
        ...contextParams(ctx),
        sub_institute_id: session.sub_institute_id,
        user_id: session.user_id,
        syear: session.syear,
      });
      fd.append('package', file);

      const res = await fetch(`${API_BASE_URL}${base}/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const raw = await readApiJson(res, 'Failed to import package');
      if (!res.ok || !isApiSuccess(raw)) {
        throw new Error(getApiErrorMessage(raw, 'Failed to import package'));
      }
      return {
        status: true,
        message: (raw.message as string) || 'Package imported as a draft.',
        id: Number(raw.id ?? 0),
        warnings: ((raw.warnings as string[]) ?? []).map(String),
      };
    },
  };
}

/**
 * The export notes header, which is base64'd JSON.
 *
 * A header cannot carry newlines or non-ASCII and these are sentences, so they
 * are encoded. A malformed or missing header is no notes, never an error: the
 * file has already downloaded by this point and failing here would tell the
 * author their export broke when it did not.
 */
function decodeExportNotes(header: string | null): string[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(atob(header)) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// The four types
// ---------------------------------------------------------------------------

export const imageHotspotsApi = contentTypeApi<H5pImageHotspots, ImageHotspotsSavePayload & Record<string, unknown>>({
  path: 'h5p_image_hotspots',
  listKey: 'imageHotspotsLists',
  itemKey: 'imageHotspots',
  noun: 'image hotspots activity',
  hasMedia: true,
});

export const memoryGameApi = contentTypeApi<H5pMemoryGame, MemoryGameSavePayload & Record<string, unknown>>({
  path: 'h5p_memory_game',
  listKey: 'memoryGameLists',
  itemKey: 'memoryGame',
  noun: 'memory game',
  hasMedia: true,
});

export const coursePresentationApi = contentTypeApi<
  H5pCoursePresentation,
  CoursePresentationSavePayload & Record<string, unknown>
>({
  path: 'h5p_course_presentation',
  listKey: 'coursePresentationLists',
  itemKey: 'coursePresentation',
  noun: 'course presentation',
  hasMedia: true,
});

export const arithmeticQuizApi = contentTypeApi<
  H5pArithmeticQuiz,
  ArithmeticQuizSavePayload & Record<string, unknown>
>({
  path: 'h5p_arithmetic_quiz',
  listKey: 'arithmeticQuizLists',
  itemKey: 'arithmeticQuiz',
  noun: 'arithmetic quiz',
  // No media: a quiz is a rule set. The server does not route an upload
  // endpoint for it, so calling uploadMedia here fails loudly rather than 404ing.
  hasMedia: false,
});

export const singleChoiceSetApi = contentTypeApi<
  H5pSingleChoiceSet,
  SingleChoiceSetSavePayload & Record<string, unknown>
>({
  path: 'h5p_single_choice_set',
  listKey: 'singleChoiceSetLists',
  itemKey: 'singleChoiceSet',
  noun: 'single choice set',
  // No media, and the server routes no upload endpoint for it: a single
  // choice question is a sentence and a list of sentences. A question that
  // needs a picture is a Multiple Choice or an Image Hotspots activity.
  hasMedia: false,
});

export const trueFalseApi = contentTypeApi<H5pTrueFalse, TrueFalseSavePayload & Record<string, unknown>>({
  path: 'h5p_true_false',
  listKey: 'trueFalseLists',
  itemKey: 'trueFalse',
  noun: 'true or false activity',
  // One image per statement. A true/false about a diagram is one of the few
  // places a picture IS the question rather than decoration.
  hasMedia: true,
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * What a new item opens with.
 *
 * Kept beside the payload types rather than in each create page, so the create
 * form and the "reset" action in the edit form cannot drift apart. These
 * mirror `authoringDefaults()` on each controller; the server's copy is what
 * an API consumer other than this app would read.
 */
export const IMAGE_HOTSPOTS_DEFAULTS: ImageHotspotsSavePayload = {
  title: '',
  description: '',
  task_description: '',
  background_image: '',
  background_alt: '',
  image_width: null,
  image_height: null,
  default_icon: 'plus',
  default_icon_color: '#4f46e5',
  show_hotspot_numbers: true,
  points_per_hotspot: 1,
  pass_percentage: 100,
  enable_retry: true,
  single_popup_open: true,
  feedback_bands: [],
  points: [],
};

export const MEMORY_GAME_DEFAULTS: MemoryGameSavePayload = {
  title: '',
  description: '',
  task_description: '',
  pairs_to_use: 0,
  active_pair_sets: [],
  allow_retry: true,
  use_grid: false,
  shuffle_cards: true,
  show_completion_screen: true,
  completion_message: '',
  scoring_mode: 'pairs',
  points_per_pair: 1,
  pass_percentage: 100,
  track_time: true,
  time_limit_seconds: 0,
  theme_color: '#4f46e5',
  card_back_image: '',
  feedback_bands: [],
  cards: [],
};

export const COURSE_PRESENTATION_DEFAULTS: CoursePresentationSavePayload = {
  title: '',
  description: '',
  theme: 'default',
  slide_transition: 'fade',
  show_progress_bar: true,
  show_keywords: true,
  show_summary_slide: true,
  enable_print: false,
  active_surface: false,
  enable_retry: true,
  enable_show_solution: true,
  pass_percentage: 60,
  feedback_bands: [],
  slides: [],
};

export const ARITHMETIC_QUIZ_DEFAULTS: ArithmeticQuizSavePayload = {
  title: '',
  description: '',
  intro_text: '',
  show_intro: true,
  operations: ['addition'],
  difficulty_level: 1,
  max_questions: 20,
  enable_timer: true,
  time_limit_seconds: 0,
  points_per_question: 1,
  pass_percentage: 60,
  enable_retry: true,
  max_attempts: 0,
  feedback_bands: [],
};

export const SINGLE_CHOICE_SET_DEFAULTS: SingleChoiceSetSavePayload = {
  title: '',
  description: '',
  task_description: '',
  auto_continue: true,
  timeout_correct_ms: 2000,
  timeout_wrong_ms: 3000,
  sound_effects: false,
  enable_retry: true,
  enable_show_solution: true,
  // Questions stay put by default and answers shuffle. An author who wrote
  // questions that build on each other would be surprised to find them
  // reordered; nobody is surprised to find the right answer moving.
  randomize_questions: false,
  randomize_answers: true,
  points_per_question: 1,
  pass_percentage: 60,
  show_progress: true,
  feedback_bands: [],
  questions: [],
};

export const TRUE_FALSE_DEFAULTS: TrueFalseSavePayload = {
  title: '',
  description: '',
  task_description: '',
  enable_retry: true,
  enable_show_solution: true,
  enable_check_button: true,
  auto_check: false,
  confirm_check_dialog: false,
  confirm_retry_dialog: false,
  randomize_questions: false,
  // 0 = ask the whole pool. An author who wants a draw sets it once they have
  // written enough statements for one to be worth having.
  questions_to_ask: 0,
  points_per_question: 1,
  pass_percentage: 60,
  show_progress: true,
  feedback_bands: [],
  questions: [],
};

/**
 * A blank question for each of the two question types.
 *
 * Kept here beside the defaults rather than in the editors, so "what an added
 * question starts as" and "what a new activity starts as" are one decision.
 */
export function blankSingleChoiceQuestion(): SingleChoiceQuestionInput {
  return {
    question_text: '',
    feedback_correct: '',
    feedback_incorrect: '',
    explanation: '',
    // Two options, the first marked correct. A question has to have exactly
    // one right answer to save at all, so starting with none marked would
    // make every newly added question an error the author has to clear.
    options: [
      { option_text: '', is_correct: true, feedback: '' },
      { option_text: '', is_correct: false, feedback: '' },
    ],
  };
}

export function blankTrueFalseQuestion(): TrueFalseQuestionInput {
  return {
    question_text: '',
    correct_answer: true,
    feedback_correct: '',
    feedback_incorrect: '',
    explanation: '',
    media_image: '',
    media_alt: '',
  };
}

/** A fresh client-side ref for a new slide. Stable while the editor is open. */
export function newRef(prefix = 'slide'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
