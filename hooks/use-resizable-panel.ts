'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A width the user drags, and keeps.
 *
 * The assistant panel holds tables of students, evidence rows and a twelve-step
 * activity trace, and how much room that deserves is genuinely a preference: someone
 * reading a risk case wants it wide, someone glancing at a follow-up wants their page
 * back. A fixed percentage picks a side on their behalf and is wrong half the time.
 *
 * Three properties worth stating, because each is a thing that goes wrong otherwise:
 *
 *   - **It persists.** A width you have to re-drag every page load is not a preference,
 *     it is a chore. Stored in localStorage rather than session storage for the same
 *     reason — the choice outlives the tab.
 *   - **It is clamped on read, not only on write.** A stored width is only valid
 *     against the viewport it was set in; a value dragged wide on a desktop must not
 *     leave a laptop with a 40px page. So the bounds are applied every time the value
 *     is used, and re-applied when the window resizes.
 *   - **It is keyboard-operable.** A drag handle that only responds to a pointer makes
 *     the panel unresizable for anyone using a keyboard, which in an ERP used all day
 *     is not a rounding error.
 */

const STORAGE_KEY = 'teach-assistant:panel-width';

/** Below this the answer's tables wrap into unreadability; above it the page is a sliver. */
const MIN_WIDTH = 360;
const MAX_VIEWPORT_FRACTION = 0.85;

/** One arrow press. Big enough to be worth pressing, small enough to aim with. */
const KEYBOARD_STEP = 32;

function maxWidth() {
  if (typeof window === 'undefined') return 900;

  return Math.max(MIN_WIDTH, Math.round(window.innerWidth * MAX_VIEWPORT_FRACTION));
}

function clamp(width: number) {
  return Math.min(Math.max(Math.round(width), MIN_WIDTH), maxWidth());
}

function readStored(fallback: number) {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? Number.NaN : Number(raw);

    return Number.isFinite(parsed) ? clamp(parsed) : fallback;
  } catch {
    // Private windows and blocked site data both land here. A default width is a
    // complete answer, so there is nothing to report.
    return fallback;
  }
}

export function useResizablePanel(defaultWidth = 620) {
  // Read once, during the first render. `readStored` returns the default when there is
  // no window, so the server renders the default and the client renders the stored
  // width — which cannot mismatch, because the panel this sizes is closed on first
  // paint and contributes no markup to compare.
  const [width, setWidth] = useState(() => readStored(defaultWidth));
  const [isDragging, setIsDragging] = useState(false);

  const persist = useCallback((next: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* Losing the preference is survivable; failing the drag is not. */
    }
  }, []);

  const apply = useCallback(
    (next: number) => {
      const bounded = clamp(next);
      setWidth(bounded);

      return bounded;
    },
    []
  );

  // A window that shrinks below the stored width would otherwise leave no page at all.
  useEffect(() => {
    const onResize = () => setWidth((current) => clamp(current));

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Pointer events rather than mouse events: one code path covers mouse, touch and
      // pen, and capture means the drag survives the cursor leaving the handle.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = { startX: event.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = dragState.current;

      if (!start) return;

      // The panel is docked right, so dragging left widens it.
      apply(start.startWidth - (event.clientX - start.startX));
    },
    [apply]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragState.current) return;

      dragState.current = null;
      setIsDragging(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      persist(clamp(width));
    },
    [persist, width]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step =
        event.key === 'ArrowLeft'
          ? KEYBOARD_STEP
          : event.key === 'ArrowRight'
            ? -KEYBOARD_STEP
            : null;

      if (step !== null) {
        event.preventDefault();
        persist(apply(width + step));

        return;
      }

      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        persist(apply(event.key === 'Home' ? maxWidth() : MIN_WIDTH));
      }
    },
    [apply, persist, width]
  );

  // While dragging, the browser's own text selection fights the gesture.
  useEffect(() => {
    if (!isDragging) return;

    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.body.style.userSelect = previous;
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  return {
    width,
    isDragging,
    /** Spread onto the drag handle. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': 'Resize the assistant panel',
      'aria-valuenow': width,
      'aria-valuemin': MIN_WIDTH,
      'aria-valuemax': maxWidth(),
      tabIndex: 0,
    },
  };
}
