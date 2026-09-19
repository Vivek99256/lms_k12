/**
 * Gesture arbitration for drag-and-drop: deciding whether a pointer that went
 * down on a draggable means "drag this" or "scroll the page".
 *
 * WHY THIS IS NOT OBVIOUS
 *
 * A press on a draggable is ambiguous. The same first few pixels of movement
 * could be the start of a drag or the start of a scroll, and the browser will
 * not tell us which. Guess "drag" and the page becomes unscrollable wherever
 * items happen to be; guess "scroll" and the item never lifts. The only honest
 * answer is to wait until the gesture has declared itself, which is what this
 * module decides and what the threshold constants below encode.
 *
 * The rules differ by input because the hardware differs:
 *
 *   mouse / pen  A cursor cannot scroll by dragging, so any movement past a
 *                small slop radius is a drag. The slop exists only so that a
 *                hand-shake during a click is not read as a drag.
 *
 *   touch        A finger scrolls by dragging, so movement alone proves
 *                nothing. Two things disambiguate it: a long press (the finger
 *                stayed put, so it was never a scroll) and horizontal-dominant
 *                movement (the page scrolls vertically, so sideways travel is
 *                not a scroll). Vertical-dominant movement is the opposite
 *                signal and abandons the gesture outright.
 *
 * Pure and DOM-free so the arbitration can be tested directly. The hook in
 * app/h5p/h5p_drag_drop/components/use-drag-gesture.ts supplies real events.
 */

export interface DragGestureThresholds {
  /** Slop radius in px before a mouse or pen press counts as a drag. */
  pointerSlop: number;
  /** Milliseconds a finger must stay down before a stationary press is a drag. */
  longPressMs: number;
  /** Horizontal travel in px that makes a touch gesture a drag. */
  touchHorizontal: number;
  /**
   * How much more horizontal than vertical touch travel must be to count as a
   * drag. Above 1 so a diagonal swipe resolves to scrolling, which is the
   * safer reading: a missed drag is retried, a stolen scroll feels broken.
   */
  horizontalBias: number;
  /** Vertical travel in px that abandons a touch gesture as a scroll. */
  touchVerticalRelease: number;
}

export const DRAG_GESTURE_DEFAULTS: DragGestureThresholds = {
  pointerSlop: 6,
  longPressMs: 350,
  touchHorizontal: 12,
  horizontalBias: 1.5,
  touchVerticalRelease: 10,
};

export type DragPointerType = 'mouse' | 'pen' | 'touch';

export interface DragGestureSample {
  pointerType: DragPointerType;
  /** Signed travel from the press origin, in px. */
  dx: number;
  dy: number;
  /** Milliseconds since the press. */
  elapsedMs: number;
}

/** Normalise the browser's `PointerEvent.pointerType`, which is a free string. */
export function normalisePointerType(pointerType: string | undefined): DragPointerType {
  return pointerType === 'touch' || pointerType === 'pen' ? pointerType : 'mouse';
}

/**
 * Has this gesture declared itself a drag?
 *
 * Called on every move and on the long-press timer. Returns false while the
 * gesture is still ambiguous -- the caller must not preventDefault or capture
 * the pointer until this is true, or it steals a scroll that was never a drag.
 */
export function shouldActivateDrag(
  sample: DragGestureSample,
  thresholds: DragGestureThresholds = DRAG_GESTURE_DEFAULTS
): boolean {
  const { pointerType, dx, dy, elapsedMs } = sample;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (pointerType !== 'touch') {
    return Math.hypot(dx, dy) >= thresholds.pointerSlop;
  }

  // A finger that stayed still was never scrolling. Allow a little travel so a
  // resting thumb's drift does not reset the intent.
  if (elapsedMs >= thresholds.longPressMs && absY < thresholds.touchVerticalRelease) {
    return true;
  }

  return absX >= thresholds.touchHorizontal && absX > absY * thresholds.horizontalBias;
}

/**
 * Has this gesture declared itself a scroll?
 *
 * Only touch can abandon: a mouse has no competing gesture to fall back to, so
 * a press that has not yet become a drag simply stays a click.
 *
 * In practice the browser usually reaches this conclusion first and sends a
 * `pointercancel` when it takes the gesture for panning. This check is the
 * belt to that braces -- it also covers browsers that pan without cancelling,
 * and it lets the long-press timer be dropped the moment a scroll is obvious
 * rather than firing mid-scroll.
 */
export function shouldAbandonGesture(
  sample: DragGestureSample,
  thresholds: DragGestureThresholds = DRAG_GESTURE_DEFAULTS
): boolean {
  if (sample.pointerType !== 'touch') return false;

  const absX = Math.abs(sample.dx);
  const absY = Math.abs(sample.dy);

  return absY >= thresholds.touchVerticalRelease && absY > absX;
}

export interface EdgeScrollInput {
  /** Pointer position in viewport coordinates. */
  clientY: number;
  viewportHeight: number;
  /** How close to an edge, in px, before scrolling starts. */
  edgeSize: number;
  /** Scroll speed in px per frame at the very edge. */
  maxSpeed: number;
}

/**
 * Pixels to scroll this frame while dragging near a viewport edge.
 *
 * Negative scrolls up, positive down, zero when the pointer is in the calm
 * middle band. Speed ramps linearly with depth into the edge zone rather than
 * switching on at full rate, because a constant-speed auto-scroll is almost
 * impossible to stop on the row you want.
 *
 * This is what makes a drop zone below the fold reachable: the learner drags
 * toward the bottom of the screen and the page comes to them.
 */
export function edgeAutoScrollVelocity(input: EdgeScrollInput): number {
  const { clientY, viewportHeight, edgeSize, maxSpeed } = input;

  if (edgeSize <= 0 || viewportHeight <= 0) return 0;
  // A viewport too short for two edge zones would otherwise scroll everywhere.
  const edge = Math.min(edgeSize, viewportHeight / 2);

  if (clientY < edge) {
    const depth = (edge - Math.max(0, clientY)) / edge;
    return -Math.ceil(depth * maxSpeed);
  }

  const fromBottom = viewportHeight - clientY;
  if (fromBottom < edge) {
    const depth = (edge - Math.max(0, fromBottom)) / edge;
    return Math.ceil(depth * maxSpeed);
  }

  return 0;
}
