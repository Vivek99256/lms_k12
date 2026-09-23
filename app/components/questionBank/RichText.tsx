'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'isomorphic-dompurify';
import 'katex/dist/katex.min.css';

/**
 * Renders question text the way the bank actually stores it: prose with
 * inline/display LaTeX (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) and the
 * occasional raw `<table>` that MinerU emitted for a data grid.
 *
 * Two things make this non-trivial:
 *
 * 1. Nothing in this app rendered maths, so a Maths bank without KaTeX shows
 *    `$\mathsf { p } ( \mathsf { x } )$` verbatim and is unusable.
 * 2. The HTML is not ours. It came out of a PDF via an extractor, so it is
 *    sanitised rather than trusted.
 */

/** Tags an extracted question legitimately needs. Everything else is dropped. */
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'sub', 'sup', 'br', 'span', 'p', 'div',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'ul', 'ol', 'li', 'code', 'pre', 'small',
];

/** Attributes safe to keep. No href/src: extracted content has no business
 *  linking out, and an <img> would be an unreviewed remote fetch. */
const ALLOWED_ATTRS = ['colspan', 'rowspan', 'align', 'valign'];

/** Opt-in extras for printed question papers, where a diagram or map *is* the
 *  question. Still no href, and `src` is held to images the sanitiser can see
 *  are images -- an http(s) URL or an inline data: image. */
const IMAGE_TAGS = [...ALLOWED_TAGS, 'img', 'figure', 'figcaption'];
const IMAGE_ATTRS = [...ALLOWED_ATTRS, 'src', 'alt', 'width', 'height'];
const IMAGE_URI_RE = /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,)/i;

function sanitizeHtml(dirty: string, allowImages: boolean): string {
  // isomorphic-dompurify carries its own DOM, so this is the same allow-list
  // on the server as in the browser -- no escaped-text fallback during SSR.
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: allowImages ? IMAGE_TAGS : ALLOWED_TAGS,
    ALLOWED_ATTR: allowImages ? IMAGE_ATTRS : ALLOWED_ATTRS,
    ...(allowImages ? { ALLOWED_URI_REGEXP: IMAGE_URI_RE } : {}),
  });
}

/** Matches the four delimiter styles the extractor emits, display first so
 *  `$$..$$` is never mistaken for two empty `$..$`. */
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      // A malformed span becomes red source text rather than an exception,
      // which matters here because some source LaTeX is genuinely mangled by
      // the formula recogniser and we would rather show it than hide it.
      errorColor: '#b91c1c',
      strict: false,
      trust: false,
    });
  } catch {
    return escapeHtml(tex);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const HTML_HINT_RE = /<\/?(?:table|tbody|thead|tr|td|th|b|strong|i|em|u|sub|sup|br|p|div|ul|ol|li|img|figure)\b/i;

/**
 * Turn stored question text into display HTML.
 *
 * Order matters: math is extracted to placeholders *before* sanitising, so a
 * `<` inside a LaTeX expression is never mistaken for a tag, and the rendered
 * KaTeX markup is spliced back in afterwards so the sanitiser does not strip
 * its spans.
 */
function toDisplayHtml(raw: string, allowImages: boolean): string {
  const slots: string[] = [];

  const withPlaceholders = raw.replace(MATH_RE, (_match, display1, display2, inline1, inline2) => {
    const display = display1 ?? display2;
    const tex = display ?? inline1 ?? inline2 ?? '';
    slots.push(renderMath(tex, display != null));
    return `@@MATH${slots.length - 1}@@`;
  });

  const body = HTML_HINT_RE.test(withPlaceholders)
    ? sanitizeHtml(withPlaceholders, allowImages)
    : escapeHtml(withPlaceholders).replace(/\n/g, '<br />');

  return body.replace(/@@MATH(\d+)@@/g, (_m, index) => slots[Number(index)] ?? '');
}

export function RichText({
  value,
  className,
  as: Tag = 'div',
  allowImages = false,
}: {
  value: string | null | undefined;
  className?: string;
  as?: 'div' | 'span';
  /** Keep diagrams, maps and figures — for printed question papers. */
  allowImages?: boolean;
}) {
  const html = useMemo(() => (value ? toDisplayHtml(value, allowImages) : ''), [value, allowImages]);

  if (!value) return null;

  return (
    <Tag
      className={className}
      // Sanitised above by DOMPurify against ALLOWED_TAGS / ALLOWED_ATTRS.
      // KaTeX output is spliced in after that pass, so its spans survive.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichText;
