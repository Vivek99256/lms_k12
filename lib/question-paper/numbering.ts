// ---------------------------------------------------------------------------
// The numbers a printed paper shows.
//
// Numbering is planned across the whole paper at once rather than per section,
// because a section that does not restart carries on from the one before it.
// The rule that makes that safe: a section which placed no question prints
// nothing, so it spends no question number and does not move the counter at
// all. Skipping an empty PART B has to leave PART C reading "Q.3" -- not
// renumber it from PART B's own `start`.
// ---------------------------------------------------------------------------

export type NumberingStyle = 'decimal' | 'upper-alpha' | 'lower-alpha' | 'roman';
export type SubNumberingStyle = NumberingStyle | 'none';

const ROMAN: Array<[number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(value: number): string {
  let remaining = Math.max(1, Math.floor(value));
  let out = '';

  while (remaining > 0) {
    // 10 is as far as the table goes; papers never number past a handful of
    // sections, and repeating X covers the rest.
    const entry = ROMAN.find(([weight]) => weight <= remaining);
    if (!entry) break;
    out += entry[1];
    remaining -= entry[0];
  }

  return out || 'I';
}

/** `index` is 0-based; `start` is the number the section begins at. */
export function numberLabel(
  index: number,
  start: number,
  style: NumberingStyle | SubNumberingStyle
): string {
  const ordinal = start + index;

  switch (style) {
    case 'upper-alpha':
      return String.fromCharCode(64 + ((ordinal - 1) % 26) + 1);
    case 'lower-alpha':
      return String.fromCharCode(96 + ((ordinal - 1) % 26) + 1);
    case 'roman':
      return toRoman(ordinal);
    case 'none':
      return '';
    default:
      return String(ordinal);
  }
}

export type SectionNumbering = {
  prefix: string;
  style: NumberingStyle;
  start: number;
  /** false continues the previous section's numbering. */
  restart: boolean;
  /** Print the section as one number whose questions are lettered parts. */
  groupAsParts: boolean;
  subStyle: SubNumberingStyle;
};

export type SectionNumberingInput = {
  numbering: SectionNumbering;
  /** How many questions the section actually placed. */
  count: number;
};

export type SectionNumberingPlan = {
  /**
   * The one number the whole section carries when its questions print as
   * lettered parts (e.g. "Q.1"); empty when each question is numbered.
   */
  groupLabel: string;
  /** One label per placed question, in order. */
  labels: string[];
};

/** Plan every section's numbering in blueprint order. */
export function planSectionNumbers(
  sections: readonly SectionNumberingInput[] | null | undefined
): SectionNumberingPlan[] {
  let running = 0;

  return (sections ?? []).map((section) => {
    const numbering = section?.numbering;
    const placed = Math.max(0, Math.floor(Number(section?.count) || 0));

    // An empty section is left off the paper entirely, so it takes no number
    // and leaves `running` exactly as it found it.
    if (!numbering || placed === 0) {
      return { groupLabel: '', labels: [] };
    }

    const start = numbering.restart ? Math.max(1, Math.floor(numbering.start) || 1) : running + 1;
    const grouped = Boolean(numbering.groupAsParts);

    const labels = Array.from({ length: placed }, (_, index) =>
      grouped
        ? numbering.subStyle === 'none'
          ? ''
          : `(${numberLabel(index, 1, numbering.subStyle)})`
        : `${numbering.prefix}${numberLabel(index, start, numbering.style)}`
    );

    // A grouped section spends a single number however many parts it holds.
    running = grouped ? start : start + placed - 1;

    return {
      groupLabel: grouped ? `${numbering.prefix}${numberLabel(0, start, numbering.style)}` : '',
      labels,
    };
  });
}
