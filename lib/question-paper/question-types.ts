// ---------------------------------------------------------------------------
// Which question form a section is asking for.
//
// A question carries up to three names for its own form: the catalogue code it
// was ingested under (`question_type_catalog.code`, e.g. `assertion_reason`),
// the label the catalogue configures for that code ("Assertion & Reason"), and
// the grading engine's own spelling from `question_type_master` ("multiple").
// A template stores whichever of those the teacher picked -- catalogue codes
// now that the dropdown is fed from the catalogue, grading names in templates
// saved before that -- so a section is matched against all three rather than
// one. That is what keeps an older template, and every built-in preset, still
// selecting the questions it always did.
//
// Comparison folds the token first: case, punctuation and word separators are
// all noise here, which is what makes "Assertion & Reason", "assertion_reason"
// and "ASSERTION-REASON" the same request.
// ---------------------------------------------------------------------------

/** The naming a question carries; every field is optional on old payloads. */
export type QuestionTypeIdentity = {
  /** question_type_catalog.code, when the question was ingested under one. */
  question_type_code?: string | null;
  /** question_type_catalog.label for that code. */
  question_type_label?: string | null;
  /** question_type_master.question_type — the grading engine's spelling. */
  question_type?: string | null;
};

/** Case, punctuation and separators removed, so only the words are compared. */
export function foldTypeToken(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Every folded name this question answers to, de-duplicated. */
export function questionTypeAliases(
  question: QuestionTypeIdentity | null | undefined
): string[] {
  if (!question) return [];

  const folded = [question.question_type_code, question.question_type_label, question.question_type]
    .map(foldTypeToken)
    .filter((token) => token !== '');

  return Array.from(new Set(folded));
}

/**
 * Does this question satisfy a section asking for `wanted`?
 *
 * An empty list matches nothing on purpose: a section set to "questions of
 * chosen types" with no type chosen has asked for nothing, and quietly
 * treating that as "everything" would swallow the whole paper.
 */
export function matchesQuestionType(
  question: QuestionTypeIdentity | null | undefined,
  wanted: readonly string[] | null | undefined
): boolean {
  if (!wanted || wanted.length === 0) return false;

  const aliases = questionTypeAliases(question);

  if (aliases.length === 0) return false;

  return wanted.some((name) => {
    const token = foldTypeToken(name);
    return token !== '' && aliases.includes(token);
  });
}

/**
 * What the paper prints where a section is set to show the question's form:
 * the catalogue's configured label, or the grading name when the question has
 * no catalogue row.
 */
export function questionTypeDisplayLabel(
  question: QuestionTypeIdentity | null | undefined
): string {
  if (!question) return '';

  const label = String(question.question_type_label ?? '').trim();

  return label !== '' ? label : String(question.question_type ?? '').trim();
}

/**
 * A readable label for a type value the catalogue does not list — a template
 * saved before the catalogue backed this choice, or one whose catalogue row
 * has since been retired. `assertion_reason` reads back as
 * "Assertion Reason" so the teacher can still see what the section asks for.
 */
export function fallbackTypeLabel(value: string): string {
  const words = foldTypeToken(value);

  if (words === '') return '';

  return words.replace(/(^|\s)([a-z0-9])/g, (_match, lead: string, char: string) =>
    `${lead}${char.toUpperCase()}`
  );
}
