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

/** The CSS transform for a camera, or 'none'. */
export function cameraTransform(camera: Camera | null): string {
  return camera ? `scale(${camera.zoom}) translate(${camera.tx}%, ${camera.ty}%)` : 'none';
}
