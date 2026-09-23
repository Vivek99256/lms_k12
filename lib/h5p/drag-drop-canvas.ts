/**
 * How a drag-and-drop background image meets the canvas it is drawn on.
 *
 * THE PROBLEM THIS SOLVES
 *
 * The canvas is a percentage coordinate space: every zone and draggable is
 * stored as a percentage of the canvas box, never a pixel. That only lines up
 * with what the author sees if the background image occupies the whole box.
 * A cover-fit background does not -- it fills the box by cropping whatever
 * does not fit, so a portrait diagram dropped into the 620x310 default loses
 * its top and bottom, and any zone the author drew over a cropped label points
 * at nothing on a re-render.
 *
 * THE RULE
 *
 * `contain` is the default and the only mode that guarantees alignment: the
 * canvas takes the image's own aspect ratio, so the image fills it exactly,
 * nothing is cropped, and one percent of the canvas is one percent of the
 * image at every viewport width. Uploading a background also rewrites the
 * stored canvas size to the image's intrinsic size, so the other three modes
 * agree with `contain` until the author deliberately changes something.
 *
 * The other three exist because authors asked for them, and each trades
 * something away: `cover` crops to fill, `original` pins the image to its
 * natural pixel size (so it can overflow a narrow canvas), and `stretch`
 * distorts. None of them is safe for a labelled diagram.
 */

export type DragDropImageFit = 'contain' | 'cover' | 'original' | 'stretch';

export const DEFAULT_IMAGE_FIT: DragDropImageFit = 'contain';

export interface ImageFitOption {
  value: DragDropImageFit;
  label: string;
  hint: string;
}

/** Authoring-facing list, in the order the picker shows them. */
export const IMAGE_FIT_OPTIONS: readonly ImageFitOption[] = [
  { value: 'contain', label: 'Contain (recommended)', hint: 'Whole image, original proportions, nothing cropped.' },
  { value: 'cover', label: 'Cover', hint: 'Fills the canvas. Edges of the image may be cropped.' },
  { value: 'original', label: 'Original size', hint: 'Natural pixel size. May overflow a narrower canvas.' },
  { value: 'stretch', label: 'Stretch', hint: 'Fills the canvas by distorting the image.' },
];

export function normaliseImageFit(value: unknown): DragDropImageFit {
  return value === 'cover' || value === 'original' || value === 'stretch' ? value : DEFAULT_IMAGE_FIT;
}

/** Tailwind object-fit classes, one per mode. */
export const IMAGE_FIT_CLASS: Record<DragDropImageFit, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
  // object-none keeps intrinsic pixels; centring stops it anchoring top-left.
  original: 'object-none object-center',
  stretch: 'object-fill',
};

export interface ImageSize {
  width: number;
  height: number;
}

// Mirrors the server's `canvas_width` / `canvas_height` validation, so a size
// derived from an image is never one the save endpoint will reject.
export const CANVAS_MIN_WIDTH = 200;
export const CANVAS_MAX_WIDTH = 4000;
export const CANVAS_MIN_HEIGHT = 120;
export const CANVAS_MAX_HEIGHT = 4000;

/**
 * Turn an image's intrinsic size into a canvas size the server will accept.
 *
 * Scaled rather than clipped so the aspect ratio -- the thing the percentages
 * depend on -- survives. Only an extreme ratio (a 1000x10 strip, say, which
 * cannot be both 120 tall and under 4000 wide) falls back to a per-axis clamp,
 * and that image was never going to hold a legible diagram.
 */
export function fitCanvasSize(width: number, height: number): ImageSize {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  let scale = Math.min(1, CANVAS_MAX_WIDTH / w, CANVAS_MAX_HEIGHT / h);
  scale = Math.max(scale, CANVAS_MIN_WIDTH / w, CANVAS_MIN_HEIGHT / h);

  return {
    width: Math.min(CANVAS_MAX_WIDTH, Math.max(CANVAS_MIN_WIDTH, Math.round(w * scale))),
    height: Math.min(CANVAS_MAX_HEIGHT, Math.max(CANVAS_MIN_HEIGHT, Math.round(h * scale))),
  };
}

/**
 * The `aspect-ratio` the canvas box should render at.
 *
 * Under `contain` the image's own ratio wins once it is known, which is what
 * makes the canvas height follow the image instead of the 2:1 default -- and
 * what removes the letterboxing that would otherwise sit between the image and
 * the coordinate space the zones are placed in. Every other mode keeps the
 * authored canvas, because each of them is explicitly about fitting an image
 * to a box the author chose.
 */
export function canvasAspectRatio(
  fit: DragDropImageFit,
  canvasWidth: number,
  canvasHeight: number,
  natural: ImageSize | null
): string {
  if (fit === 'contain' && natural && natural.width > 0 && natural.height > 0) {
    return `${natural.width} / ${natural.height}`;
  }
  const w = canvasWidth > 0 ? canvasWidth : 620;
  const h = canvasHeight > 0 ? canvasHeight : 310;
  return `${w} / ${h}`;
}

/** Read a picked file's intrinsic size before it is uploaded. */
export function readImageSize(file: File): Promise<ImageSize | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    const done = (size: ImageSize | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** Read the intrinsic size of an already-hosted image. */
export function measureImageSize(src: string): Promise<ImageSize | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
