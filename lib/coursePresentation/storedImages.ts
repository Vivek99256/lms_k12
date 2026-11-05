import { pictureItemsOf, type ImageEditorAdapter, type ImageEditResult, type ImageEditState, type ImageEditStates, type ImageSearch, type ImageTarget } from '@/lib/study-deck/imageEditing';
import type { DeckSlide } from '@/lib/study-deck/types';

import { CoursePresentationApiError, request } from './api';
import { sendPicture } from './draftImages';

/**
 * The picture editor's adapter for a presentation that is already approved and stored (next_lms_erp `lms/course-presentation/stored-image/*`),
 * the Classroom Presentation a teacher opens from the Classroom Resource list (`?content=<id>`). The pilot chapter only: for any other chapter, or
 * a user who may not change pictures, the server refuses and no control is drawn.
 *
 * The server owns every rule: which pictures may change, which may be used, and that the original is kept so it can be put back. A change is saved
 * with the presentation at once; nothing is regenerated. This file only asks. A picture found by search is named by an id the server gave out; no
 * address is ever sent back.
 */

// An item's picture is named by its slide and its own id; every call, search to restore, carries both, so one item's change can never land on another.
const where = (chapterId: number, contentId: number, target: ImageTarget): Record<string, string> => ({
  chapter_id: String(chapterId),
  content_id: String(contentId),
  slide: String(target.slide),
  ...(target.item !== undefined ? { item: target.item } : {}),
});

/**
 * Who is looking, as far as the browser can tell, for deciding what to DRAW. This is only a display hint: the server's own gate (staff only, and the
 * content-create permission) decides every call, and is the only thing that lets a change through.
 *   'student'  a student or a parent: no editing control is drawn and no editing call is made;
 *   'staff'    any other profile (teacher, admin, ...): the control is always drawn, enabled or disabled with a reason;
 *   'unknown'  the session names no profile: the control is drawn only when the server says it may be used.
 */
export type Viewer = 'student' | 'staff' | 'unknown';

export function viewerKind(): Viewer {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const read = (key: string): Record<string, unknown> => {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    };
    const menu = read('menuContext');
    const user = read('userData');
    const role = String(menu.user_profile_name ?? user.user_profile_name ?? user.user_profile ?? '').trim().toLowerCase();
    if (role === '') return 'unknown';
    return role.includes('student') || role.includes('parent') ? 'student' : 'staff';
  } catch {
    return 'unknown';
  }
}

/** What the editor answered: the per-slide rules, or why it could not. */
export type StoredStates = { ok: true; states: ImageEditStates } | { ok: false; status: number; reason: string };

/** The teacher-facing sentence for a failure. The server's own words are used whenever it gave a specific reason. */
export function storedFailureReason(status: number, message: string): string {
  if (status === 401) return 'Your session has expired. Sign in again to change pictures.';
  if (status === 0) return 'The picture editor could not be reached. Check your connection and reload.';
  // A missing route is the server not having this feature yet; a 404 that names the presentation or chapter is the server answering.
  if (status === 404 && (message === '' || /route|not be found|^not found.?$/i.test(message) || /^request failed/i.test(message))) {
    return 'Picture editing is not available on this server yet. The presentation is unchanged.';
  }
  // "You do not have permission to create this resource." is the server's content-create gate speaking in its own terms; say what it means here.
  if (status === 403 && (message === '' || /not authori[sz]ed|do not have permission/i.test(message))) {
    return 'Your account cannot change pictures in this presentation. Changing pictures needs the content "create" right (held by the Teacher profiles). Sign in as a teacher, or ask an administrator to grant it.';
  }
  return message !== '' ? message : 'Pictures cannot be changed in this presentation right now.';
}

/**
 * What may be done with each slide's picture. Never throws, and never reports a failure as "nothing to show": the caller is told why, so a teacher
 * sees a disabled control with the reason instead of no control at all.
 */
export async function loadStoredImageStates(chapterId: number, contentId: number, signal?: AbortSignal): Promise<StoredStates> {
  try {
    const res = await request<{ slide_images?: ImageEditStates }>('GET', 'stored-image/states', { chapter_id: String(chapterId), content_id: String(contentId) }, signal);
    if (!res.slide_images || typeof res.slide_images !== 'object') return { ok: false, status: 200, reason: storedFailureReason(200, '') };
    return { ok: true, states: res.slide_images };
  } catch (e) {
    if (signal?.aborted) throw e;
    const status = e instanceof CoursePresentationApiError ? e.status : 0;
    return { ok: false, status, reason: storedFailureReason(status, e instanceof CoursePresentationApiError ? e.message : '') };
  }
}

const disabled = (reason: string, has_image: boolean): ImageEditState => ({ has_image, can_add: false, can_replace: false, can_remove: false, can_restore: false, reason, kind: has_image ? 'photo' : 'none' });

/** The part of a slide these helpers read. */
type SlideLike = { n: number; image: unknown; interaction?: DeckSlide['interaction'] };

/** Disabled states for the items of a slide that can carry item pictures, all with the same reason. */
function disabledItems(slide: SlideLike, reason: string): Record<string, ImageEditState> | null {
  const items = pictureItemsOf(slide);
  if (!items) return null;

  return Object.fromEntries(items.map((item) => [item.id, { ...disabled(reason, Boolean(item.image)), title: item.label }]));
}

/**
 * A disabled state for every slide that has a picture (and for each item that can carry one), all carrying the same reason: what a teacher sees
 * when the editor cannot be used.
 */
export function unavailableStates(deck: { slides: SlideLike[] }, reason: string): ImageEditStates {
  const out: ImageEditStates = {};
  for (const slide of deck.slides) {
    if (!slide.image) continue;
    const items = disabledItems(slide, reason);
    out[String(slide.n)] = { ...disabled(reason, true), ...(items ? { items } : {}) };
  }

  return out;
}

export const ITEM_PICTURES_UNSUPPORTED = 'This server cannot change the pictures of individual items yet. The slide’s own picture can still be changed.';

/**
 * The server's answer, completed for the slides it did not say item pictures for. A server that predates item pictures answers for the slide only;
 * the items of such a slide would then have no control at all, which hides the feature without a word. Each gets a disabled control that says why.
 */
export function withItemFallbacks(states: ImageEditStates, deck: { slides: SlideLike[] }): ImageEditStates {
  let out = states;
  for (const slide of deck.slides) {
    const known = states[String(slide.n)];
    if (!known || known.items) continue;
    const items = disabledItems(slide, ITEM_PICTURES_UNSUPPORTED);
    if (items) out = { ...out, [String(slide.n)]: { ...known, items } };
  }

  return out;
}

/** The adapter behind a control that is only explaining why it cannot be used: it is never called (nothing can be chosen), and refuses if it is. */
export const refusingAdapter: ImageEditorAdapter = (() => {
  const refuse = () => Promise.reject(new CoursePresentationApiError('Pictures cannot be changed here right now.', 403));

  return { search: refuse, setFromCandidate: refuse, setFromUpload: refuse, remove: refuse, restore: refuse };
})();

export function createStoredImageAdapter(chapterId: number, contentId: number): ImageEditorAdapter {
  return {
    search: (target, query, signal) =>
      request<ImageSearch & { status_code: number }>('GET', 'stored-image/search', { ...where(chapterId, contentId, target), ...(query?.trim() ? { q: query.trim() } : {}) }, signal),
    setFromCandidate: (target, candidateId) => request<ImageEditResult>('POST', 'stored-image/replace', { ...where(chapterId, contentId, target), candidate_id: candidateId }),
    setFromUpload: (target, file, options) => sendPicture('stored-image/replace', where(chapterId, contentId, target), file, options),
    // A stored slide is not left bare by a click: the server offers no removal, so the dialog never shows the button.
    remove: () => Promise.reject(new CoursePresentationApiError('A picture cannot be taken away from a stored presentation. Choose another, or restore the original.', 422)),
    restore: (target) => request<ImageEditResult>('POST', 'stored-image/restore', where(chapterId, contentId, target)),
  };
}
