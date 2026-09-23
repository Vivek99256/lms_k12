// ---------------------------------------------------------------------------
// Getting a question's pictures into the PDF.
//
// A diagram, map or circuit is often the question itself, so a paper that
// prints the words and drops the picture is wrong. The preview has no trouble
// with them -- the browser just loads the image -- but the PDF is rasterised
// with html2canvas, and that only ever sees pixels the canvas is allowed to
// read. An image from another origin either taints the canvas or is skipped,
// and both come out as a blank gap where the diagram should be.
//
// So every remote image is fetched and turned into a `data:` URI before the
// off-screen sheet is rendered. Same-origin pixels cannot taint anything, and
// a data URI is already decoded by the time html2canvas runs.
//
// Two places hold an image: a `<figure>` row in `lms_question_asset`, and an
// `<img>` inside the question's own stored HTML (the PDF extractor emits
// those). Both are handled -- the first by url, the second by rewriting the
// `src` in place.
// ---------------------------------------------------------------------------

/** `<img ... src="...">`, capturing the quote style so it can be put back. */
const IMG_SRC_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;

/**
 * The data URIs a printed paper will accept.
 *
 * Deliberately the same set `RichText` sanitises question HTML against: an
 * inlined image that the sanitiser would strip is worse than the original url,
 * because it turns a picture that at least renders on screen into an empty
 * box.
 */
const PRINTABLE_DATA_URI_RE = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

/** True for an image worth fetching: a remote one we do not already hold. */
export function isInlineableUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function isPrintableImageDataUri(value: unknown): boolean {
  return typeof value === 'string' && PRINTABLE_DATA_URI_RE.test(value.trim());
}

/** Every `<img src>` in a block of stored question HTML, in document order. */
export function extractImageSrcs(html: unknown): string[] {
  if (typeof html !== 'string' || html === '') return [];

  const found: string[] = [];

  for (const match of html.matchAll(IMG_SRC_RE)) {
    const src = (match[3] ?? '').trim();
    if (src !== '') found.push(src);
  }

  return found;
}

/**
 * Swap each `<img src>` for its replacement.
 *
 * A src with no entry in the map is left exactly as it was, so a failed fetch
 * degrades to the original url rather than to an `<img>` with nothing in it.
 */
export function rewriteImageSrcs(html: unknown, replacements: Record<string, string>): string {
  if (typeof html !== 'string' || html === '') return typeof html === 'string' ? html : '';

  return html.replace(IMG_SRC_RE, (whole, lead: string, quote: string, src: string) => {
    const replacement = replacements[src.trim()];

    return replacement ? `${lead}${quote}${replacement}${quote}` : whole;
  });
}

/**
 * Whether the fallback proxy may fetch this url.
 *
 * The proxy exists for an asset host that serves no CORS headers, which the
 * browser cannot read for itself. That makes it a server fetching a url on a
 * caller's behalf, so the host has to be one this deployment already talks to
 * -- otherwise the route is an open relay into whatever the server can reach.
 *
 * Compared on origin, not on a substring: `erp.triz.co.in.evil.test` contains
 * the ERP's hostname and is not the ERP.
 */
export function isAllowedAssetUrl(value: unknown, allowedOrigins: readonly string[]): boolean {
  if (!isInlineableUrl(value)) return false;

  let origin: string;

  try {
    origin = new URL(String(value).trim()).origin;
  } catch {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === origin;
    } catch {
      return false;
    }
  });
}

/** The route that re-serves a figure from this origin. */
export const FIGURE_PROXY_PATH = '/api/question-paper/asset';

/**
 * What a figure's `<img src>` should actually be.
 *
 * Never the third-party url directly. A figure extracted from a PDF is stored
 * on an object store on its own domain, and the browser reaching that domain is
 * not something this app can rely on: it serves no CORS headers (so the PDF
 * raster cannot read it), and a content blocker or a school network filter will
 * quietly drop an object-store request while every same-origin request
 * succeeds. The symptom is an `<img>` that reserves its box and renders
 * nothing, which reads as "the paper lost the diagram".
 *
 * Going through this origin removes all of that at once, and has a second
 * benefit: a same-origin image cannot taint the canvas, so the PDF export
 * works from the proxied url even when inlining could not run.
 *
 * A `data:` URI is already local — that is the PDF path, which inlines every
 * image before rendering — and passes through untouched.
 */
export function figureDisplaySrc(url: unknown): string {
  const value = typeof url === 'string' ? url.trim() : '';

  if (value === '') return '';
  if (!isInlineableUrl(value)) return value;

  return `${FIGURE_PROXY_PATH}?url=${encodeURIComponent(value)}`;
}
