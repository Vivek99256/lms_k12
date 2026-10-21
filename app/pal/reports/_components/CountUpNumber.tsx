'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number counting up to its target value on mount. Used for the
 * report's headline stats (mastery count, accuracy %, ...) — the value shown
 * is always the real backend number, this only changes how it arrives on
 * screen, never what it says.
 */
export default function CountUpNumber({
  value,
  suffix = '',
  decimals = 0,
  duration = 0.9,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const prevValue = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const controls = animate(prevValue.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        prevValue.current = value;
      },
    });

    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return (
    <>
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}
