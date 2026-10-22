/**
 * Where a picture really is inside the box it is drawn in, and where the part to notice sits on it.
 *
 * A picture is drawn `object-contain`: scaled to fit the box without cropping, so it usually leaves bands of empty box on two sides. A
 * highlighted region is given as percentages of the PICTURE (the server's picture check measured it there), so to draw it in the right
 * place the picture's own rectangle inside the box has to be known first.
 */

export interface PictureRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The rectangle a picture of `imageW` by `imageH` takes when scaled to fit, centred, inside a box of `boxW` by `boxH`. */
export function containedRect(boxW: number, boxH: number, imageW: number, imageH: number): Rect {
  if (!(boxW > 0 && boxH > 0 && imageW > 0 && imageH > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  const scale = Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;

  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** A region as it may be drawn: a rectangle inside the picture that is not the whole of it. Anything else is ignored. */
export function usableRegion(region: unknown): PictureRegion | null {
  if (typeof region !== 'object' || region === null) return null;
  const { x, y, w, h } = region as Record<string, unknown>;
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const [rx, ry, rw, rh] = [x as number, y as number, w as number, h as number];
  if (rx < 0 || ry < 0 || rw < 8 || rh < 8 || rx + rw > 100.5 || ry + rh > 100.5) return null;
  if (rw > 92 && rh > 92) return null;

  return { x: rx, y: ry, w: Math.min(rw, 100 - rx), h: Math.min(rh, 100 - ry) };
}

/** The highlighted region in the box's own pixels, given where the picture sits in it. */
export function regionInBox(picture: Rect, region: PictureRegion): Rect {
  return {
    left: picture.left + (picture.width * region.x) / 100,
    top: picture.top + (picture.height * region.y) / 100,
    width: (picture.width * region.w) / 100,
    height: (picture.height * region.h) / 100,
  };
}

/** The sentence under a picture: what to notice. A photograph or a highlighted part is introduced as such; a drawn diagram keeps its own words. */
export function captionText(caption: string | null | undefined, opts: { photo: boolean; highlighted: boolean }): string {
  const text = (caption ?? '').trim().replace(/\.+$/, '');
  if (text === '') return '';

  return opts.photo || opts.highlighted ? `What to notice: ${text}.` : `${text}.`;
}
