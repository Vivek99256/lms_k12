// ---------------------------------------------------------------------------
// Which sections of a question paper actually reach the page.
//
// A template describes every section a school might want; a given exam rarely
// fills them all. A section that matched no question must not print a heading
// -- an empty "SECTION B" on a real paper reads as a mistake -- but the teacher
// still needs to know it happened, so the two groups are returned together
// rather than the empty ones being quietly discarded.
// ---------------------------------------------------------------------------

/** The shape this rule needs: anything carrying the questions it placed. */
export type SectionWithQuestions = { questions: readonly unknown[] };

export type SectionSplit<T> = {
  /** In blueprint order, the sections that have at least one question. */
  printable: T[];
  /** The sections that matched nothing, for reporting back to the teacher. */
  empty: T[];
};

export function splitSectionsByContent<T extends SectionWithQuestions>(
  sections: readonly T[]
): SectionSplit<T> {
  const printable: T[] = [];
  const empty: T[] = [];

  for (const section of sections ?? []) {
    if (section && section.questions && section.questions.length > 0) {
      printable.push(section);
    } else if (section) {
      empty.push(section);
    }
  }

  return { printable, empty };
}
