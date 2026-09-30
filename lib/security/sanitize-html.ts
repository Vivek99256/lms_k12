import DOMPurify from 'isomorphic-dompurify';

/**
 * One sanitiser for HTML the app did not write itself — teacher-authored
 * question text, H5P content, backend-built certificates, receipts and circulars.
 *
 * `RichText` (app/components/questionBank/RichText.tsx) keeps its own much
 * stricter allow-list because extracted question text needs almost nothing.
 * Authored content is different: it legitimately carries formatting, colours,
 * tables, images, links and the odd video embed, so this keeps DOMPurify's
 * default HTML/SVG/MathML profile (which already strips scripts, event handlers
 * and `javascript:` URLs) and only widens it for embeds from known video hosts.
 */

export interface SanitizeOptions {
  /**
   * The value is a whole template (`<html><head><style>…`), not a fragment.
   * Kept as a document so the `<style>` in its head survives; the browser drops
   * the html/head/body wrappers itself when the result is set as innerHTML.
   */
  document?: boolean;
}

/** Players an authored lesson may embed. Anything else inside an iframe is removed. */
const EMBED_SRC_RE =
  /^https:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/i;

/** A stylesheet link must point at an https or same-site URL; CSS cannot run script. */
const STYLESHEET_HREF_RE = /^(?:https:\/\/|\/(?!\/))/i;

function dropUntrustedEmbeds(node: Node) {
  // nodeName, not instanceof: on the server this runs inside DOMPurify's own jsdom.
  const element = node as Element;
  if (node.nodeName === 'IFRAME') {
    if (!EMBED_SRC_RE.test(element.getAttribute('src') || '')) node.parentNode?.removeChild(node);
    return;
  }
  // Backend receipt and circular templates pull their print styles in with
  // <link rel="stylesheet">; keep those, drop every other kind of <link>.
  if (node.nodeName === 'LINK') {
    const isStylesheet = /(^|\s)stylesheet(\s|$)/i.test(element.getAttribute('rel') || '');
    if (!isStylesheet || !STYLESHEET_HREF_RE.test(element.getAttribute('href') || '')) node.parentNode?.removeChild(node);
  }
}

export function sanitizeHtml(dirty: unknown, options: SanitizeOptions = {}): string {
  if (dirty === null || dirty === undefined) return '';
  const html = String(dirty);
  if (!html) return '';

  // Scoped hook: added and removed around this one call so it never leaks into
  // other DOMPurify users (generated-html.ts adds its own the same way).
  DOMPurify.addHook('afterSanitizeElements', dropUntrustedEmbeds);
  try {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe', 'link'],
      ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'rel', 'media'],
      // Keep a leading <style> in a fragment instead of letting the parser drop it.
      FORCE_BODY: !options.document,
      WHOLE_DOCUMENT: Boolean(options.document),
    }) as unknown as string;
  } finally {
    DOMPurify.removeHook('afterSanitizeElements');
  }
}

/** Escape a value for interpolation into an HTML string (print windows, templates). */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
