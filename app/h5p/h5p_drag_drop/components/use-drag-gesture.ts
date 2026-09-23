'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DRAG_GESTURE_DEFAULTS,
  edgeAutoScrollVelocity,
  normalisePointerType,
  shouldAbandonGesture,
  shouldActivateDrag,
  type DragPointerType,
} from '@/lib/h5p/drag-gesture';

/**
 * Pointer-based dragging that leaves scrolling alone until the gesture is
 * unambiguously a drag.
 *
 * WHY NOT HTML5 DRAG AND DROP
 *
 * This replaced `draggable` + `dataTransfer`, which had two problems that
 * cannot be configured away. It does not fire on touch at all in mobile
 * browsers, so half the audience for a K-12 activity could not use it; and it
 * offers no control over when a drag begins, so there is no way to say "this
 * press was a scroll". Pointer events give both, at the cost of implementing
 * the drop targeting by hand -- which is the `elementFromPoint` call below.
 *
 * THE CONTRACT THAT KEEPS SCROLLING WORKING
 *
 * 1. `pointerdown` records the origin and does NOTHING else -- no capture, no
 *    preventDefault. At that instant the gesture could still be a scroll, and
 *    anything we do here would steal it.
 * 2. Draggables carry `touch-action: pan-y`, so until we intervene the browser
 *    owns vertical panning and scrolls natively at full smoothness. When it
 *    takes the gesture it sends `pointercancel`, which we treat as "not ours".
 * 3. Only once `shouldActivateDrag` agrees do we capture the pointer, switch
 *    the element to `touch-action: none`, and start calling preventDefault.
 * 4. A gesture that ends without activating is left alone, so the element's
 *    `click` fires normally and keyboard pick-up still works.
 *
 * The thresholds themselves live in lib/h5p/drag-gesture.ts and are unit
 * tested there; this hook is the part that needs a DOM.
 */

/** Marks a drop target. The value is passed back to `onDrop`. */
export const DROP_TARGET_ATTRIBUTE = 'data-h5p-drop-target';

const EDGE_SIZE = 90;
const EDGE_MAX_SPEED = 18;

export interface DragGestureState {
  /** The dragged item's id, or null when no drag is active. */
  draggingId: number | null;
  /** Viewport coordinates for the drag ghost. */
  pointer: { x: number; y: number } | null;
  /** The drop target currently under the pointer, or null. */
  hoveredTarget: string | null;
  pointerType: DragPointerType | null;
}

interface PendingGesture {
  id: number;
  pointerId: number;
  pointerType: DragPointerType;
  startX: number;
  startY: number;
  startedAt: number;
  element: HTMLElement;
  active: boolean;
}

export function useDragGesture({
  onDrop,
  onDragStart,
}: {
  /** Called on release over a target. `targetKey` is the attribute's value. */
  onDrop: (id: number, targetKey: string | null) => void;
  onDragStart?: (id: number) => void;
}) {
  const gesture = useRef<PendingGesture | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollFrame = useRef<number | null>(null);
  const autoScrollVelocity = useRef(0);
  const latestPointer = useRef<{ x: number; y: number } | null>(null);

  /**
   * The callbacks, held behind a ref.
   *
   * The window listeners below are attached once. If the effect depended on
   * `onDrop` directly, a caller passing an inline closure would detach and
   * reattach them on every render -- including mid-drag, which loses the
   * gesture. Seeded null and filled in an effect so nothing a hook was called
   * with is ever mutated.
   */
  const handlers = useRef<{
    onDrop: (id: number, targetKey: string | null) => void;
    onDragStart?: (id: number) => void;
  } | null>(null);

  useEffect(() => {
    handlers.current = { onDrop, onDragStart };
  }, [onDrop, onDragStart]);

  const [state, setState] = useState<DragGestureState>({
    draggingId: null,
    pointer: null,
    hoveredTarget: null,
    pointerType: null,
  });

  // --- auto-scroll -------------------------------------------------------

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = null;
    }
    autoScrollVelocity.current = 0;
  }, []);

  /**
   * One rAF loop for the whole drag, reading its speed from a ref.
   *
   * Driving this from pointermove instead would stall the moment the pointer
   * stops -- and holding still at the bottom of the screen is exactly how a
   * learner asks for more scrolling.
   */
  const ensureAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) return;

    const step = () => {
      const velocity = autoScrollVelocity.current;
      if (velocity !== 0) {
        window.scrollBy(0, velocity);

        // The page moved under a stationary pointer, so what is beneath it
        // changed. Re-resolve the target or the highlight goes stale.
        const point = latestPointer.current;
        if (point) {
          const target = resolveDropTarget(point.x, point.y);
          setState((current) =>
            current.hoveredTarget === target ? current : { ...current, hoveredTarget: target }
          );
        }
      }
      autoScrollFrame.current = requestAnimationFrame(step);
    };

    autoScrollFrame.current = requestAnimationFrame(step);
  }, []);

  // --- gesture lifecycle -------------------------------------------------

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const endGesture = useCallback(() => {
    const current = gesture.current;

    if (current) {
      current.element.style.touchAction = '';
      if (current.active) {
        try {
          current.element.releasePointerCapture(current.pointerId);
        } catch {
          // The pointer may already be gone (cancelled, or the element
          // unmounted mid-drag). Releasing a capture we no longer hold is not
          // a failure worth surfacing.
        }
      }
    }

    gesture.current = null;
    latestPointer.current = null;
    clearLongPress();
    stopAutoScroll();
    setState({ draggingId: null, pointer: null, hoveredTarget: null, pointerType: null });
  }, [clearLongPress, stopAutoScroll]);

  const activate = useCallback(
    (x: number, y: number) => {
      const current = gesture.current;
      if (!current || current.active) return;

      current.active = true;
      clearLongPress();

      // Now -- and only now -- the gesture is ours.
      try {
        current.element.setPointerCapture(current.pointerId);
      } catch {
        // Capture is an optimisation: it keeps events coming if the pointer
        // leaves the element. The window listeners below work without it.
      }
      current.element.style.touchAction = 'none';

      latestPointer.current = { x, y };
      handlers.current?.onDragStart?.(current.id);
      ensureAutoScroll();

      setState({
        draggingId: current.id,
        pointer: { x, y },
        hoveredTarget: resolveDropTarget(x, y),
        pointerType: current.pointerType,
      });
    },
    [clearLongPress, ensureAutoScroll]
  );

  /** Attach to each draggable. Does not preventDefault -- see the header. */
  const onPointerDown = useCallback(
    (id: number) => (event: React.PointerEvent<HTMLElement>) => {
      // Secondary buttons are context menus, not drags.
      if (event.button !== 0) return;

      const element = event.currentTarget;
      const pointerType = normalisePointerType(event.pointerType);

      gesture.current = {
        id,
        pointerId: event.pointerId,
        pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: Date.now(),
        element,
        active: false,
      };

      clearLongPress();
      if (pointerType === 'touch') {
        const { clientX, clientY } = event;
        longPressTimer.current = setTimeout(() => {
          const current = gesture.current;
          if (!current || current.active) return;
          // The timer only fires while the finger is still where it started;
          // any real travel has already resolved the gesture one way or the
          // other through the move handler.
          activate(clientX, clientY);
        }, DRAG_GESTURE_DEFAULTS.longPressMs);
      }
    },
    [activate, clearLongPress]
  );

  // --- window listeners --------------------------------------------------

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (!current.active) {
        const sample = {
          pointerType: current.pointerType,
          dx,
          dy,
          elapsedMs: Date.now() - current.startedAt,
        };

        if (shouldAbandonGesture(sample)) {
          // The finger is scrolling. Let go completely so the browser's pan
          // continues uninterrupted.
          endGesture();
          return;
        }
        if (!shouldActivateDrag(sample)) return;

        activate(event.clientX, event.clientY);
      }

      // Past this line the drag is real, so suppressing the default (text
      // selection, or any residual panning) is correct rather than theft.
      if (event.cancelable) event.preventDefault();

      latestPointer.current = { x: event.clientX, y: event.clientY };
      autoScrollVelocity.current = edgeAutoScrollVelocity({
        clientY: event.clientY,
        viewportHeight: window.innerHeight,
        edgeSize: EDGE_SIZE,
        maxSpeed: EDGE_MAX_SPEED,
      });

      const hoveredTarget = resolveDropTarget(event.clientX, event.clientY);
      setState((previous) => ({
        draggingId: current.id,
        pointer: { x: event.clientX, y: event.clientY },
        hoveredTarget,
        pointerType: previous.pointerType ?? current.pointerType,
      }));
    };

    const onUp = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const wasActive = current.active;
      const id = current.id;
      const target = wasActive ? resolveDropTarget(event.clientX, event.clientY) : null;

      endGesture();

      // A gesture that never activated was a tap or a click; saying nothing
      // here is what lets the element's own onClick run and drive the
      // keyboard-friendly carry mode.
      if (wasActive) handlers.current?.onDrop(id, target);
    };

    const onCancel = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      // Usually the browser claiming the gesture for panning. Not an error.
      endGesture();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [activate, endGesture]);

  // Releasing capture and timers on unmount, so navigating away mid-drag does
  // not leave a stuck rAF loop scrolling the next page.
  useEffect(() => endGesture, [endGesture]);

  return { ...state, onPointerDown, isDragging: state.draggingId !== null };
}

/**
 * Which drop target is under this point.
 *
 * `elementFromPoint` is the replacement for what `dataTransfer` used to do for
 * us. The drag ghost has `pointer-events: none` so it never answers as its own
 * drop target, and `closest` walks up from whatever is hit -- a label, an image
 * or an already-placed item -- to the zone containing it.
 */
function resolveDropTarget(x: number, y: number): string | null {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return null;
  const target = (hit as HTMLElement).closest(`[${DROP_TARGET_ATTRIBUTE}]`);
  return target ? target.getAttribute(DROP_TARGET_ATTRIBUTE) : null;
}
