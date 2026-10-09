/**
 * Which Prayogshala items may be drawn as experiment cards for the chapter on screen.
 *
 * The chapter-content response carries Prayogshala items next to every other resource type, and
 * the card builder stamps each card with the SELECTED chapter's id. That stamp would hide a
 * response that belongs to another chapter, so eligibility is checked here against the
 * activity's own ids first. Pure and framework-free so it can be tested without React.
 */

/** The fields of an activity this decision reads. PrayogshalaActivity satisfies it. */
export interface PrayogshalaCardCandidate {
  chapter_id?: number | string | null;
  lab_config?: unknown | null;
  generation_status?: string | null;
}

/** A content-list item; only Prayogshala items carry `prayogshala`. */
export interface ContentAssetLike {
  prayogshala?: PrayogshalaCardCandidate | null;
}

/** Generation states that mean "no activity exists yet" - they belong to the topic panel only. */
const NOT_AN_ACTIVITY = new Set(['generating', 'failed', 'needs_content']);

function sameChapter(activityChapter: unknown, selected: string | number): boolean {
  if (activityChapter === null || activityChapter === undefined || activityChapter === '') return false;
  const a = Number(activityChapter);
  const b = Number(selected);
  return Number.isInteger(a) && a > 0 && Number.isInteger(b) && a === b;
}

/**
 * True when the asset may be shown as a card in `selectedChapterId`.
 *
 *  - Not a Prayogshala item: always true (other resource types are never touched).
 *  - The activity must carry a valid chapter_id equal to the selected chapter's.
 *  - A placeholder (generating / failed / needs_content) is never a card.
 *  - Anything the generator produced (it has a generation_status) must be `ready` and have a lab.
 *  - A hand-written activity (no generation_status) is a document activity and needs no lab.
 */
export function isEligiblePrayogshalaCard(asset: ContentAssetLike, selectedChapterId: string | number): boolean {
  const activity = asset.prayogshala;
  if (!activity) return true;
  if (!sameChapter(activity.chapter_id, selectedChapterId)) return false;

  const status = activity.generation_status ?? null;
  if (status !== null && NOT_AN_ACTIVITY.has(status)) return false;
  if (status === 'ready') return activity.lab_config !== null && activity.lab_config !== undefined;
  if (status !== null) return false; // an unknown generation state is not trusted
  return true;
}

/**
 * A category's assets narrowed to the ones that may be drawn for `selectedChapterId`. This is the
 * single call the chapter page makes. Order and object identity are preserved, and every asset
 * without a `prayogshala` payload passes through untouched.
 */
export function filterCardAssets<T extends ContentAssetLike>(
  assets: readonly T[] | null | undefined,
  selectedChapterId: string | number
): T[] {
  return (assets ?? []).filter((asset) => isEligiblePrayogshalaCard(asset, selectedChapterId));
}
