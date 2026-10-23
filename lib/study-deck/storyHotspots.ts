/**
 * Hotspots on a story scene's picture: which parts are usable, where their pins sit, and how exploring them is counted.
 *
 * NO REACT HERE, so every rule is testable with node:test. The parts have the same shape as the parts of a hotspots slide (`HotspotSpot`), and
 * "explored" is counted by the same functions that count it there (`openHotspot`, `hotspotProgress` in interactions.ts), so a story picture and a
 * hotspots slide mean the same thing by it. A part that does not make sense (outside the picture, no words) is dropped, and a picture left with
 * fewer than two parts shows none: one pin explores nothing.
 */
import { closeHotspot, hotspotProgress, initialHotspots, openHotspot, type HotspotState } from './interactions';
import type { Rect } from './picture';
import type { DeckImage, HotspotSpot, HotspotsInteraction } from './types';

export const MIN_STORY_SPOTS = 2;
export const MAX_STORY_SPOTS = 4;

function usable(spot: unknown): spot is HotspotSpot {
  if (typeof spot !== 'object' || spot === null) return false;
  const s = spot as Record<string, unknown>;
  if (typeof s.id !== 'string' || s.id === '' || typeof s.label !== 'string' || s.label.trim() === '' || typeof s.text !== 'string' || s.text.trim() === '') return false;
  const [x, y, w, h] = [s.x, s.y, s.w, s.h];
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  const [cx, cy, cw, ch] = [x as number, y as number, w as number, h as number];
  if (cw < 4 || ch < 4 || cw > 100 || ch > 100) return false;

  // (cx, cy) is the centre; the box must lie inside the picture (half a percent of slack for rounding).
  return cx - cw / 2 >= -0.5 && cy - ch / 2 >= -0.5 && cx + cw / 2 <= 100.5 && cy + ch / 2 <= 100.5;
}

/** The parts of a picture a learner may open: valid ones only, at most four, and none at all when fewer than two remain. */
export function storySpots(image: DeckImage | null | undefined): HotspotSpot[] {
  const raw = image?.hotspots;
  if (!Array.isArray(raw)) return [];
  const spots = raw.filter(usable).slice(0, MAX_STORY_SPOTS);

  return spots.length >= MIN_STORY_SPOTS ? spots : [];
}

/** The parts as the interaction the hotspot functions take, so their open/explored rules are the ones used everywhere. */
export function asHotspotsInteraction(spots: HotspotSpot[]): HotspotsInteraction {
  return { kind: 'hotspots', reason: '', intro: '', spots, wrapup: '' };
}

export type StoryHotspotState = HotspotState;

export const initialStoryHotspots = (): StoryHotspotState => initialHotspots();

export function openStoryHotspot(state: StoryHotspotState, spots: HotspotSpot[], id: string): StoryHotspotState {
  return openHotspot(state, asHotspotsInteraction(spots), id);
}

export function closeStoryHotspot(state: StoryHotspotState): StoryHotspotState {
  return closeHotspot(state);
}

/** How many parts have been opened, of how many, and whether that is all of them. */
export function storyHotspotProgress(spots: HotspotSpot[], state: StoryHotspotState): { opened: number; total: number; done: boolean } {
  const { opened, total, done } = hotspotProgress(asHotspotsInteraction(spots), state);

  return { opened, total, done };
}

/** Where a part's pin sits in the picture's box, in the box's own pixels, given where the picture sits in it. */
export function pinInBox(picture: Rect, spot: HotspotSpot): { left: number; top: number } {
  const at = spot.pin ?? { x: spot.x, y: spot.y };

  return { left: picture.left + (picture.width * at.x) / 100, top: picture.top + (picture.height * at.y) / 100 };
}

/** The side of the picture an explanation opens on: away from the part, so the part stays in view. */
export function calloutSide(spot: HotspotSpot): 'left' | 'right' {
  return spot.x >= 50 ? 'left' : 'right';
}

/** The sentence shown once every part has been opened: what the learner found, in the parts' own words. */
export function discoveredSummary(spots: HotspotSpot[]): string {
  const names = spots.map((s) => s.label.trim()).filter(Boolean);
  if (names.length === 0) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return `You looked at ${list}.`;
}
