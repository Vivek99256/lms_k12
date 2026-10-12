/**
 * Plain text <-> the small HTML a scenario screen is stored as.
 *
 * WHY THIS EXISTS. A screen's body is HTML, because that is what H5P stores and
 * what the generator writes. A teacher should not have to read `<p>` to fix a
 * sentence, and a rich-text widget is a large dependency for four things:
 * paragraphs, bullet lists, numbered lists and bold/italic. So the editor shows
 * the body as ordinary text --
 *
 *     A blank line starts a new paragraph.
 *
 *     - a line starting with a dash is a bullet
 *     1. a line starting with a number is a numbered step
 *
 *     **bold** and *italic* work inside a line.
 *
 * -- and converts at the edges.
 *
 * NOT EVERYTHING ROUND-TRIPS, and the editor must not silently flatten what it
 * cannot show. `toPlain()` returns null for HTML with anything outside that
 * grammar (a table, a subscript, a link), and the editor then offers the HTML
 * itself. `roundTrips()` is the check the editor uses to decide.
 *
 * No imports: testable without a browser.
 */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#039;': "'", '&nbsp;': ' ' };

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#0?39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** **bold** and *italic* inside one line, on already-escaped text. */
function inlineToHtml(escaped: string): string {
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
}

/** Plain text in the editor's grammar -> HTML. */
export function toHtml(plain: string): string {
  const text = plain.replace(/\r\n?/g, '\n').trim();
  if (text === '') return '';

  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;

    if (lines.every((l) => bullet.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inlineToHtml(escapeHtml(l.replace(bullet, '')))}</li>`).join('')}</ul>`);
    } else if (lines.every((l) => numbered.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inlineToHtml(escapeHtml(l.replace(numbered, '')))}</li>`).join('')}</ol>`);
    } else {
      out.push(`<p>${lines.map((l) => inlineToHtml(escapeHtml(l.trim()))).join('<br>')}</p>`);
    }
  }

  return out.join('');
}

/** Inline HTML (strong, em, br, text) -> the editor's grammar, or null if it holds anything else. */
function inlineToPlain(html: string): string | null {
  let ok = true;
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(strong|b)>/gi, '**')
    .replace(/<\/?(em|i)>/gi, '*')
    .replace(/<[^>]+>/g, () => {
      ok = false;
      return '';
    });

  return ok ? decode(text) : null;
}

/**
 * HTML -> the editor's grammar. Null when the HTML uses anything the grammar
 * cannot say, so the caller shows the HTML rather than losing it.
 */
export function toPlain(html: string): string | null {
  const source = html.trim();
  if (source === '') return '';

  const blocks: string[] = [];
  const pattern = /<(p|ul|ol)>([\s\S]*?)<\/\1>/gi;
  let consumed = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (source.slice(consumed, match.index).trim() !== '') return null;
    consumed = match.index + match[0].length;

    const [, tag, inner] = match;
    if (tag.toLowerCase() === 'p') {
      const plain = inlineToPlain(inner);
      if (plain === null) return null;
      blocks.push(plain.trim());
      continue;
    }

    const items: string[] = [];
    const itemPattern = /<li>([\s\S]*?)<\/li>/gi;
    let item: RegExpExecArray | null;
    let itemEnd = 0;
    while ((item = itemPattern.exec(inner)) !== null) {
      if (inner.slice(itemEnd, item.index).trim() !== '') return null;
      itemEnd = item.index + item[0].length;
      const plain = inlineToPlain(item[1]);
      // A line break inside a list item cannot be written as one line.
      if (plain === null || plain.includes('\n')) return null;
      items.push(plain.trim());
    }
    if (inner.slice(itemEnd).trim() !== '' || items.length === 0) return null;
    blocks.push(items.map((t, i) => (tag.toLowerCase() === 'ul' ? `- ${t}` : `${i + 1}. ${t}`)).join('\n'));
  }

  if (source.slice(consumed).trim() !== '') return null;

  return blocks.join('\n\n');
}

/** Collapses what does not matter when comparing two pieces of HTML. */
function normal(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '<br>').replace(/<(\/?)b>/gi, '<$1strong>').replace(/<(\/?)i>/gi, '<$1em>').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}

/** Can the editor show this HTML as plain text and give back the same HTML? */
export function roundTrips(html: string): boolean {
  const plain = toPlain(html);
  return plain !== null && normal(toHtml(plain)) === normal(html);
}
