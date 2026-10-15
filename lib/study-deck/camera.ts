/**
 * The camera over a diagram: where to point it and how far to zoom when the learner is looking at one part.
 *
 * It borrows an idea from presentation tools (move focus from one part of a visual to the next) with one rule that
 * matters more than the effect: EVERY part must stay in view and clickable. So the zoom is the largest of a few
 * steps that keeps all the parts inside the window, and no zoom at all when the parts are too spread out for that.
 *
 * Coordinates are shares of the picture, 0 to 100. The picture is scaled about its centre and then shifted, which in
 * CSS is \`scale(zoom) translate(tx%, ty%)\`: a point p lands at 50 + zoom * (p - 50 + t).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  zoom: number;
  /** Shift in percent of the picture, applied before the zoom. */
  tx: number;
  ty: number;
}

const STEPS = [1.3, 1.25, 1.2, 1.15, 1.1];
/** How close to the edge of the window a part may get. */
const MARGIN = 4;

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
const screen = (p: number, t: number, zoom: number) => 50 + zoom * (p - 50 + t);

/**
 * @param focus the part being looked at
 * @param keep every part that must stay in view (the focus included)
 * @returns the camera, or null when no zoom keeps every part in view
 */
export function cameraFor(focus: Point, keep: readonly Point[]): Camera | null {
  for (const zoom of STEPS) {
    // Centre on the focus, but never so far that the edge of the picture shows.
    const limit = 50 - 50 / zoom;
    const tx = clamp(50 - focus.x, limit);
    const ty = clamp(50 - focus.y, limit);
    const inView = keep.every((p) => {
      const sx = screen(p.x, tx, zoom);
      const sy = screen(p.y, ty, zoom);

      return sx >= MARGIN && sx <= 100 - MARGIN && sy >= MARGIN && sy <= 100 - MARGIN;
    });
    if (inView) return { zoom, tx, ty };
  }

  return null;
}

/** The nearest and the farthest a focus camera goes: a part is shown larger, never so large that its surroundings are lost. */
export const FOCUS_ZOOM = { min: 1.4, max: 1.8 } as const;

/**
 * The camera for looking closely at one part of a picture whose parts are marked by hand: it centres on the part and zooms so the
 * part fills about a quarter of the window (small parts are shown larger than big ones). Unlike `cameraFor` it does not promise
 * that the other parts stay in view: they are still in the list, and closing the explanation brings the whole picture back.
 * It never shifts so far that the edge of the picture shows.
 *
 * With `room` the part is not centred but moved to the far side from that edge (a part to the right of a card on the left), so
 * a card opened there leaves the part in clear view.
 *
 * @param size the part's larger side, as a share of the picture (0-100)
 * @param room which side of the window is kept clear for a card, if any
 */
export function focusCamera(focus: Point, size: number, room?: 'left' | 'right'): Camera {
  const zoom = Math.max(FOCUS_ZOOM.min, Math.min(FOCUS_ZOOM.max, size > 0 ? 28 / size : FOCUS_ZOOM.max));
  const limit = 50 - 50 / zoom;

  // Where the part should land in the window: the middle, or about a quarter of the way in from the side away from the card.
  const at = room === 'left' ? 72 : room === 'right' ? 28 : 50;
  const wantX = (at - 50) / zoom - (focus.x - 50);

  return { zoom, tx: clamp(wantX, limit), ty: clamp(50 - focus.y, limit) };
}

/** The CSS transform for a camera, or 'none'. */
export function cameraTransform(camera: Camera | null): string {
  return camera ? `scale(${camera.zoom}) translate(${camera.tx}%, ${camera.ty}%)` : 'none';
}
