import type { DeckImage } from './types';

/**
 * How a deck picture is credited. A picture comes from one of four places (`source_kind`): a web search, the chapter's own
 * textbook, a diagram drawn from the chapter's content, or nowhere (no suitable picture). An older deck has no `source_kind`
 * and is read the way it always was: a photograph with a source page is a web picture, anything else is drawn.
 */

/** The web page a picture came from, only when it really is a web address (a textbook picture's source is a book page, not a link). */
export function webSource(image: DeckImage): string | null {
  const url = (image.source_url ?? '').trim();

  return image.type === 'photo' && /^https?:\/\//i.test(url) ? url : null;
}

export function isTextbookPicture(image: DeckImage): boolean {
  return image.source_kind === 'textbook';
}

/** The credit shown with a picture: the textbook and page, who made a web photograph, or that a diagram was drawn for the lesson. */
export function creditText(image: DeckImage): string {
  if (isTextbookPicture(image) && image.attribution.trim() !== '') return image.attribution.trim().replace(/\.$/, '');
  if (image.type === 'photo' && image.source_url) return `${image.creator ?? 'Openverse'}, ${image.licence}`;

  return 'Drawn for this lesson';
}

/** The words that say no picture was found for a slide that planned one. Null when the slide has its picture, or planned none. */
export function missingPictureNotice(slide: { image: DeckImage | null; image_missing?: string | null }): string | null {
  if (slide.image) return null;
  if (!slide.image_missing) return null;

  return 'No suitable picture is available for this slide.';
}
