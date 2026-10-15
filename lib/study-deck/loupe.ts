/**
 * The geometry of a magnifier over a picture: where the lens sits and which part of the picture it shows.
 *
 * Everything is a SHARE of the picture, never a pixel, because the deck's stage is scaled to fit the screen: a pointer's place
 * is read as a fraction of the picture it is over, and the lens is drawn as percentages of that picture. No React and no DOM
 * here, so the arithmetic is testable with node:test.
 */

/** The lens's width as a share of the picture's width. */
export const LENS = 0.22;

/** How much larger than the picture the lens shows it. */
export const ZOOM = 2.5;

export interface LensView {
  /** Where the lens is, as a percentage of the picture. */
  left: number;
  top: number;
  /** The lens's width as a percentage of the picture; its height is the same length, so it is round. */
  width: number;
  /** The picture drawn inside the lens, as a percentage of the lens's width. */
  backgroundSize: number;
  /** Which part of that picture shows, as the percentages CSS `background-position` takes. */
  positionX: number;
  positionY: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/**
 * The lens centred on a point of the picture.
 *
 * @param x the point's place across the picture, 0 to 1
 * @param y the point's place down the picture, 0 to 1
 * @param ratio the picture's width over its height
 */
export function lensView(x: number, y: number, ratio: number, zoom = ZOOM): LensView {
  const xp = clamp01(x);
  const yp = clamp01(y);
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 16 / 9;
  // The lens is round, so as a share of the picture's HEIGHT it is LENS * r tall.
  const lensH = LENS * r;
  // CSS places a background by the share of (box - picture) that is left over; these are those shares for "this point at the centre".
  const positionX = ((LENS / 2 - xp * zoom) / (LENS - zoom)) * 100;
  const positionY = ((lensH / 2 - yp * zoom) / (lensH - zoom)) * 100;

  return {
    left: (xp - LENS / 2) * 100,
    top: (yp - lensH / 2) * 100,
    width: LENS * 100,
    backgroundSize: (zoom / LENS) * 100,
    positionX,
    positionY,
  };
}

/** A point moved by a step (a key press), kept inside the picture. */
export function nudge(point: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  return { x: clamp01(point.x + dx), y: clamp01(point.y + dy) };
}
