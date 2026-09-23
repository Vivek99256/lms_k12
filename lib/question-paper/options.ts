// ---------------------------------------------------------------------------
// The only place a printed question paper uses columns.
//
// Questions themselves always run one below the next -- numbering that reads
// down one column and back up another is unusable on paper. A question's own
// answer options are the exception: four short options side by side save a lot
// of space and still read in order, left to right, the way a board paper sets
// them. The moment an option is long enough to wrap, the whole list drops back
// to one per line so nothing collides.
// ---------------------------------------------------------------------------

/** Longer than this and an option no longer fits a half-width column. */
export const SHORT_OPTION_LENGTH = 48;

/** Options can carry the editor's markup; only the visible text decides. */
function visibleLength(text: string): number {
  return String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/**
 * How many columns this question's options should be set in: 2 when there are
 * enough of them and every one is short, otherwise 1.
 */
export function optionColumnCount(options: ReadonlyArray<{ text: string }> | null | undefined): 1 | 2 {
  if (!options || options.length <= 2) return 1;

  // An option that cannot be measured disqualifies the whole list: one per
  // line always reads, whereas columns built on data we cannot see could
  // collide on the page.
  const fitsAColumn = (option: { text: string } | null | undefined) =>
    option != null &&
    typeof option.text === 'string' &&
    visibleLength(option.text) <= SHORT_OPTION_LENGTH;

  return options.every(fitsAColumn) ? 2 : 1;
}
