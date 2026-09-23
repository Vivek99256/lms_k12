'use client';

import { useEffect, useState } from 'react';
import { measureImageSize, type ImageSize } from '@/lib/h5p/drag-drop-canvas';

interface Measurement {
  src: string | null;
  size: ImageSize | null;
}

/**
 * The intrinsic size of the background image, or null until it is known.
 *
 * Needed because `contain` sizes the canvas from the image, and the image's
 * real dimensions are only knowable once the browser has decoded it. Returning
 * null rather than a guess keeps the canvas on its authored aspect ratio for
 * that one frame instead of snapping through a wrong one.
 *
 * The measurement is stored WITH the src it belongs to and discarded on the
 * spot when they disagree. That is what stops a replaced background rendering
 * for a frame at the old image's proportions -- a visible jump on the canvas,
 * and a frame in which every drop zone is in the wrong place.
 *
 * Tasks authored after the fit options shipped already store the image's size
 * as the canvas size, so for those this only ever confirms what is on screen.
 * It matters for the older ones, and for any image swapped out by hand.
 */
export function useBackgroundSize(src: string | null | undefined): ImageSize | null {
  const key = src || null;
  const [measured, setMeasured] = useState<Measurement>({ src: null, size: null });

  useEffect(() => {
    if (!key) return;
    let live = true;
    void measureImageSize(key).then((size) => {
      if (live) setMeasured({ src: key, size });
    });
    return () => {
      live = false;
    };
  }, [key]);

  return measured.src === key ? measured.size : null;
}
