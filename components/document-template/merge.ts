/**
 * Merge-field substitution for document templates.
 *
 * A template stores `{{token}}` placeholders inside its Craft.js document —
 * in text HTML, in an image `src`, in a table cell, anywhere a string lives.
 * Filling a template means walking every string in that document and swapping
 * the tokens for real values.
 *
 * The catalog of tokens is served by the backend (`/merge-fields`) so the field
 * picker, the preview, and the printed document can never drift apart.
 */

/** `{{ student_name }}` — whitespace tolerant, case-insensitive, underscore/digit tokens. */
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type MergeValues = Record<string, string>;

/**
 * Replace every known token in a string.
 *
 * An *unknown* token is left verbatim on purpose: that way a designer who
 * mistypes `{{studnet_name}}` sees it on the canvas instead of silently
 * printing a blank on a real certificate. Known-but-empty values still resolve
 * to '' — the backend seeds every catalog token, so a legitimately empty field
 * prints blank rather than leaking braces.
 */
export function applyMergeValuesToText(text: string, values: MergeValues): string {
  if (!text || text.indexOf('{{') === -1) return text;

  return text.replace(TOKEN_PATTERN, (match, token: string) => {
    const key = token.toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}

/** Recursively substitute tokens in every string of an arbitrary JSON value. */
function traverse(value: unknown, values: MergeValues): unknown {
  if (typeof value === 'string') return applyMergeValuesToText(value, values);
  if (Array.isArray(value)) return value.map((entry) => traverse(entry, values));

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = traverse(entry, values);
    }
    return result;
  }

  return value;
}

/**
 * Fill a serialized Craft.js document with merge values.
 *
 * Returns the document unchanged when there is nothing to merge, or when the
 * content is not parseable JSON — a template must still open in the editor even
 * if its stored content is malformed.
 */
export function applyMergeValues(content: string, values: MergeValues | null): string {
  if (!content || !values || Object.keys(values).length === 0) return content;

  try {
    return JSON.stringify(traverse(JSON.parse(content), values));
  } catch {
    return content;
  }
}

/** Every distinct token used by a template, in first-seen order. */
export function collectTokens(content: string): string[] {
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(content)) !== null) {
    seen.add(match[1].toLowerCase());
  }

  return [...seen];
}

/**
 * Tokens a template uses that the catalog does not define — surfaced in the
 * editor so a typo is caught before the document is printed in bulk.
 */
export function findUnknownTokens(content: string, values: MergeValues): string[] {
  return collectTokens(content).filter(
    (token) => !Object.prototype.hasOwnProperty.call(values, token)
  );
}
