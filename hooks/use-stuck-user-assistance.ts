'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Detects "on this screen for a while, done nothing" — the trigger for the
 * stuck-user popup.
 *
 * WHAT COUNTS AS ACTIVITY, AND WHAT DOES NOT
 *
 * A click, a keypress, or a form submission — never mouse movement or scrolling.
 * Someone genuinely reading a report resets nothing by moving the mouse across it,
 * because reading is not being stuck; the popup exists for the person who has
 * stopped *doing* anything, not the person taking their time to look at something.
 *
 * PAUSES WHILE THE TAB IS HIDDEN
 *
 * A user who switched tabs to answer an email has not been staring at this screen
 * for two minutes; the clock only runs while the page is actually visible.
 *
 * ONE TRIGGER PER VISIT, UNTIL RESET
 *
 * `triggered` stays true once it fires — the caller decides what "handled" means
 * (the popup was answered either way) and calls `reset()`. Without that, the same
 * two idle minutes would fire the popup again the instant it closed, for anyone who
 * is still reading. Navigating to a new page always resets it.
 */
export function useStuckUserAssistance({
  enabled,
  thresholdMs = 2 * 60 * 1000,
  checkIntervalMs = 5000,
}: {
  /** Off entirely when false — e.g. while the chatbot is already open. */
  enabled: boolean;
  thresholdMs?: number;
  checkIntervalMs?: number;
}) {
  const pathname = usePathname();
  const [triggered, setTriggered] = useState(false);
  const [idleMs, setIdleMs] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const triggeredRef = useRef(false);

  const reset = () => {
    lastActivityRef.current = Date.now();
    triggeredRef.current = false;
    setTriggered(false);
    setIdleMs(0);
  };

  // A new page is a fresh visit — nothing carries over from the one the user just left.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const events: Array<keyof DocumentEventMap> = ['click', 'keydown', 'submit'];
    events.forEach((event) => document.addEventListener(event, markActive, { capture: true }));

    return () => {
      events.forEach((event) => document.removeEventListener(event, markActive, { capture: true } as EventListenerOptions));
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const interval = window.setInterval(() => {
      if (document.hidden || triggeredRef.current) return;

      const elapsed = Date.now() - lastActivityRef.current;
      setIdleMs(elapsed);

      if (elapsed >= thresholdMs) {
        triggeredRef.current = true;
        setTriggered(true);
      }
    }, checkIntervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, thresholdMs, checkIntervalMs]);

  return { triggered, idleSeconds: Math.round(idleMs / 1000), reset };
}
