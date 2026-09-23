// ---------------------------------------------------------------------------
// Page geometry for the question paper PDF.
//
// Pure arithmetic, deliberately free of React and the DOM so it can be reasoned
// about (and tested) on its own. The DOM side lives in pdf.tsx and only feeds
// these functions measurements.
// ---------------------------------------------------------------------------

/** CSS pixels per millimetre at the 96dpi the browser lays out in. */
export const PX_PER_MM = 96 / 25.4;

/** Width x height in millimetres, portrait. */
export const PAGE_SIZES_MM: Record<string, [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

/** Accepts the `mm`, `cm`, `in` or `px` a blueprint might carry. */
export function marginToMm(value: string, fallback = 16): number {
  const match = String(value ?? '')
    .trim()
    .match(/^([\d.]+)\s*(mm|cm|in|px)?$/i);

  if (!match) return fallback;

  const size = Number(match[1]);

  if (!Number.isFinite(size) || size < 0) return fallback;

  switch ((match[2] || 'mm').toLowerCase()) {
    case 'cm':
      return size * 10;
    case 'in':
      return size * 25.4;
    case 'px':
      return size / PX_PER_MM;
    default:
      return size;
  }
}

/**
 * A page this empty is treated as wasted rather than merely short. Only used
 * to decide between a boundary cut and a hard cut; see below.
 */
const MIN_PAGE_FILL = 1 / 3;

/**
 * Where each page starts and ends, in sheet pixels.
 *
 * `blockTops` are the offsets of the sheet's breakable blocks (a question, a
 * section heading, the instruction list...). A page normally ends at one of
 * them, so the break lands in the gap between two blocks and never through a
 * line of text.
 *
 * The exception is a block taller than a whole page. Breaking early for one of
 * those buys nothing — it cannot fit on the next page either — and would leave
 * a nearly empty page behind, so the cut falls at the page boundary instead.
 * A short block that *would* fit on its own page still gets its boundary cut,
 * however empty that leaves the page before it.
 *
 * The returned ranges are contiguous and cover the sheet exactly.
 */
export function computePageCuts(
  blockTops: number[],
  sheetHeight: number,
  pageHeight: number
): Array<[number, number]> {
  if (!(sheetHeight > 0) || !(pageHeight > 0)) {
    return [[0, Math.max(sheetHeight, 1)]];
  }

  const tops = blockTops
    .filter((top) => Number.isFinite(top) && top > 0)
    .sort((a, b) => a - b);

  const cuts: Array<[number, number]> = [];
  let start = 0;
  // Bounded so a pathological measurement can never spin the browser.
  let guard = 0;

  while (start < sheetHeight - 1 && guard < 1000) {
    guard += 1;

    const limit = start + pageHeight;

    if (limit >= sheetHeight) break;

    let cut = 0;
    // Where the block that follows the cut ends — the end of the sheet when
    // nothing starts after this page's limit.
    let nextTop = sheetHeight;

    for (const top of tops) {
      if (top > limit) {
        nextTop = top;
        break;
      }
      if (top > start) cut = top;
    }

    if (cut > start) {
      const underFilled = cut - start < pageHeight * MIN_PAGE_FILL;
      const nextBlockFitsAPage = nextTop - cut <= pageHeight;

      if (underFilled && !nextBlockFitsAPage) cut = limit;
    }

    if (cut <= start) cut = limit;

    cuts.push([start, cut]);
    start = cut;
  }

  cuts.push([start, sheetHeight]);

  return cuts;
}
