import { coursePresentationEnabledFor } from './scope';

/**
 * Which Classroom Resource cards belong to the Course Presentation workflow.
 *
 * Opening a card is decided HERE, on an explicit marker, never on a card's type or on "everything else": only the
 * dedicated Course Presentation card of a pilot chapter takes the new route. Prayogshala cards, every other card
 * type, and every card of every other chapter keep their existing handler.
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
  return (
    item.coursePresentationPilot === true ||
    item.id === COURSE_PRESENTATION_CARD_ID ||
    item.type === 'Classroom presentation' ||
    (typeof item.deepLink === 'string' && /^\/student\/study-deck\//.test(item.deepLink)) ||
    Boolean(item.pdfUrl)
  );
}

export function routeCardOpen(item: OpenableCard, lane: ResourceLane): CardOpenRoute {
  return lane === 'classroom' && isCoursePresentationCard(item) ? 'course-presentation' : 'default';
}

/**
 * Whether the dedicated card should be added to a chapter's list. Only in the Classroom Resource lane of a pilot
 * chapter, once its content has loaded, and never beside a Classroom presentation that already exists (that
 * card is reused as it is, not duplicated).
 */
export function shouldShowCoursePresentationCard(input: {
  chapterId: string | number | null | undefined;
  lane: ResourceLane;
  loaded: boolean;
  items: readonly { type: string; coursePresentationPilot?: boolean }[];
}): boolean {
  if (!input.loaded || input.lane !== 'classroom' || !coursePresentationEnabledFor(input.chapterId)) return false;
  return !input.items.some((item) => item.type === 'Classroom presentation' && item.coursePresentationPilot !== true);
}
