import { coursePresentationEnabledFor } from './scope';

/**
 * Which Classroom Resource cards belong to the Course Presentation workflow.
 *
 * Opening a card is decided HERE, on an explicit marker, never on a card's type or on "everything else": only the
 * dedicated Course Presentation card of a chapter in scope takes the new route. Prayogshala cards, every other card
 * type, and every card of every other chapter keep their existing handler.
 *
 * That includes the presentations already STORED for the chapter: each is its own content item made for one teaching
 * method and format, and opens straight to its own deck (its deep link), never into the chooser. A chapter's printed
 * poster (also a "Classroom presentation") keeps opening as it always did.
 */
export const COURSE_PRESENTATION_CARD_ID = 'course-presentation-pilot';

export interface OpenableCard {
  id: string;
  type: string;
  chapterId?: string;
  coursePresentationPilot?: boolean;
  prayogshala?: unknown;
  deepLink?: string;
  pdfUrl?: string;
}

export type CardOpenRoute = 'course-presentation' | 'default';
export type ResourceLane = 'classroom' | 'teacher';

export function isCoursePresentationCard(item: OpenableCard): boolean {
  if (item.prayogshala || !coursePresentationEnabledFor(item.chapterId)) {
    return false;
  }
  return item.coursePresentationPilot === true || item.id === COURSE_PRESENTATION_CARD_ID;
}

export function routeCardOpen(item: OpenableCard, lane: ResourceLane): CardOpenRoute {
  return lane === 'classroom' && isCoursePresentationCard(item) ? 'course-presentation' : 'default';
}

/**
 * Whether the dedicated card should be added to a chapter's list: in the Classroom Resource lane of a chapter in scope,
 * once its content has loaded. It is the ONE entry point for choosing a teaching method and format, so it is there
 * whatever is already stored: a stored presentation, story lesson or the chapter's poster is a different item (made
 * for one choice, or not a generated deck at all) and neither replaces it nor makes it a duplicate.
 */
export function shouldShowCoursePresentationCard(input: {
  chapterId: string | number | null | undefined;
  lane: ResourceLane;
  loaded: boolean;
  items: readonly { type: string; coursePresentationPilot?: boolean }[];
}): boolean {
  // Never added twice (the list may already hold it).
  return input.loaded && input.lane === 'classroom' && coursePresentationEnabledFor(input.chapterId) && !input.items.some((item) => item.coursePresentationPilot === true);
}
