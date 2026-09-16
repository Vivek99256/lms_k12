import DOMPurify from 'isomorphic-dompurify';

/**
 * Rendering AI-generated chapter content.
 *
 * Rows written by the content generator store the finished document as HTML in
 * `content_master.description`, rather than the prompt that produced it. The
 * backend already reduces that HTML to a tag and attribute allowlist before it
 * is stored (App\Services\Content\RendersGeneratedContent), but a stored row is
 * still untrusted input by the time it reaches a browser — it may predate a
 * sanitiser fix, or have been edited directly in the database — so it is
 * sanitised again on read.
 *
 * The two allowlists are deliberately kept in step. Widening one without the
 * other either strips layout the backend allowed, or accepts markup the backend
 * would have rejected.
 */

const GENERATED_HTML_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'sub', 'sup',
  'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'section', 'figure', 'figcaption', 'img',
];

/**
 * Images may only come from our own object storage — the same restriction the
 * backend enforces on write. Anything else is dropped rather than rendered,
 * so a stored document can never beacon out from a viewer's browser.
 */
const ALLOWED_IMAGE_HOST_SUFFIX = '.digitaloceanspaces.com';

function isAllowedImageSrc(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname.endsWith(ALLOWED_IMAGE_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function sanitizeGeneratedHtml(html: string): string {
  // Runs for this call only; removed in the matching afterSanitize hook below
  // so the hook can never leak into other DOMPurify consumers.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'img') return;
    const el = node as Element;
    if (!isAllowedImageSrc(el.getAttribute?.('src') ?? '')) {
      el.parentNode?.removeChild(el);
    }
  });

  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: GENERATED_HTML_TAGS,
      // `class` carries the whole visual design (the stylesheet lives in
      // globals.css), so no inline `style` is ever accepted.
      ALLOWED_ATTR: ['class', 'src', 'alt', 'colspan', 'rowspan'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'a'],
      FORBID_ATTR: ['style', 'srcset', 'href', 'formaction', 'loading'],
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeElement');
  }
}

/**
 * The document body for a generated row, or null when there is nothing to
 * render inline.
 *
 * Only rows the generator wrote carry a document here. Every other row's
 * `description` is either a plain upload note or — for the older Gamma/Gemini
 * rows — the raw prompt, neither of which should be rendered as markup.
 */
export function extractGeneratedBodyHtml(
  description: string | null | undefined,
  isGenerated: boolean
): string | null {
  if (!isGenerated || !description) return null;

  const trimmed = description.trim();
  if (!trimmed) return null;

  // The legacy rows store prompt text, not markup. Requiring a real tag keeps
  // a wall of prompt prose from being rendered as a "document".
  if (!/<(?:h[1-6]|p|ul|ol|table|div|section|figure)\b/i.test(trimmed)) return null;

  const clean = sanitizeGeneratedHtml(trimmed);
  return clean.trim() ? clean : null;
}
