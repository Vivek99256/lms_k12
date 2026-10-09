/**
 * Study-deck pictures live in the database. A deck names one by `study-deck-image:<id>`; the browser needs an address.
 *
 * - A deck the API sends (`POST /api/lms-study-deck`) already has its pictures turned into signed addresses.
 * - A deck the player holds itself (the local review copy) still has references, and asks the API for addresses
 *   (`POST /api/lms-study-deck/image-urls`), which only returns pictures the school may see.
 *
 * NO REACT AND NO FETCH HERE (the caller supplies the lookup), so every rule is testable with node:test.
 * Works on anything with `slides` or `sections` (a study deck, or a study document) whose parts carry an `image`.
 */

export const IMAGE_REF_PREFIX = 'study-deck-image:';

/** Where a deck keeps the parts that can carry a picture. */
const PARTS = ['slides', 'sections'] as const;

interface HasImage {
  image?: { url?: string | null } | null;
}

type Pictured = { [part in (typeof PARTS)[number]]?: HasImage[] };

/** The id inside a `study-deck-image:<id>` reference, or null when the value is anything else. */
export function imageRefId(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^study-deck-image:([1-9][0-9]{0,14})$/.exec(value);

  return match ? Number(match[1]) : null;
}

/** The ids of the pictures a deck still names by reference, once each, in order. */
export function pendingImageIds(deck: Pictured): number[] {
  const ids = new Set<number>();
  for (const part of PARTS) {
    for (const item of deck[part] ?? []) {
      const id = imageRefId(item.image?.url);
      if (id !== null) ids.add(id);
    }
  }

  return Array.from(ids);
}

/**
 * The deck with each reference replaced by its address. A reference with no address (the picture is not this
 * school's, or is gone) is left as it is, which loads nothing; the rest of the deck still works.
 */
export function applyImageUrls<T extends Pictured>(deck: T, urls: Readonly<Record<string, string>>): T {
  for (const part of PARTS) {
    for (const item of deck[part] ?? []) {
      const id = imageRefId(item.image?.url);
      const url = id === null ? undefined : urls[String(id)];
      if (item.image && url) item.image.url = url;
    }
  }

  return deck;
}

/** The body of `POST /api/lms-study-deck/image-urls`. */
export function imageUrlsRequest(ids: readonly number[], instituteId: number): Record<string, unknown> {
  return {
    image_ids: ids,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
  };
}

/**
 * Turn every reference in a deck into an address, asking for them in one request.
 *
 * @param lookup  given the ids, resolves to `{ "<id>": "<address>" }` for the pictures it may show
 */
export async function resolveDeckImages<T extends Pictured>(
  deck: T,
  lookup: (ids: number[]) => Promise<Record<string, string>>,
): Promise<T> {
  const ids = pendingImageIds(deck);
  if (ids.length === 0) return deck;

  return applyImageUrls(deck, await lookup(ids));
}
