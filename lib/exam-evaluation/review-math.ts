// ---------------------------------------------------------------------------
// The arithmetic and rules behind the exam-evaluation review page.
//
// Kept apart from the React components so it can be tested without a browser,
// and because every rule here is one a teacher would otherwise be left to catch
// by eye:
//
//   - a mark box starts EMPTY. The AI's number is a suggestion shown beside it,
//     not a value pre-filled into it, so that saving a draft never quietly turns
//     every suggestion into a teacher mark;
//   - a mark outside 0..max is an error, not something to be nudged to the
//     nearest legal value;
//   - the total the teacher sees is what the sheet will add up to if approved
//     now: their own marks where they have given one, the AI's where they have
//     not. The server recomputes it; this is only the live preview.
//
// Mirrors ExamEvaluationApiController::review(). If the two ever disagree, the
// server is right and this is the bug.
// ---------------------------------------------------------------------------

/** The slice of an answer these rules read. The page's full answer type satisfies it. */
export type ReviewAnswer = {
  question_no: number;
  max_marks: number;
  ai_marks: number | null;
  teacher_marks: number | null;
  teacher_feedback?: string;
  /** The server's call that a person has to look at this one before approval. */
  needs_attention: boolean;
  /** What to call the question: the number the sheet printed, else its paper position. */
  display_label?: string;
  /** False when `display_label` is only the paper position because the sheet's number wasn't read. */
  label_from_sheet?: boolean;
  /** True when the label was worked out from the paper's layout rather than read from the sheet. */
  label_inferred?: boolean;
};

/** Mark boxes are held as text so a half-typed "1." is not snapped to 1. Empty = not reviewed. */
export type MarkInputs = Record<number, string>;
export type FeedbackInputs = Record<number, string>;

export type ParsedMark = {
  /** null when the box is empty, or when it holds something invalid. */
  value: number | null;
  /** Why the box is invalid, in words for the teacher. Null when it is empty or fine. */
  error: string | null;
};

export type MarkEdit = {
  question_no: number;
  teacher_marks: number | null;
  teacher_feedback: string | null;
};

export type ReviewTotals = {
  maxTotal: number;
  aiTotal: number;
  /** Teacher marks where given, AI marks elsewhere: what approving right now would total. */
  teacherTotal: number;
  percentage: number | null;
  questionCount: number;
  /** Questions with a mark the teacher has put there. */
  reviewedCount: number;
  /** Questions still on the AI's suggestion. */
  unreviewedCount: number;
  /** Questions the server flagged for a person to look at. */
  flaggedCount: number;
  /** Flagged questions that still have no teacher mark. These block approval. */
  flaggedUnresolvedCount: number;
  /** Mark boxes holding something that is not a legal mark. */
  invalidCount: number;
  /** Questions whose printed number wasn't read from the sheet, so they are shown by paper position. */
  unlabelledCount: number;
};

/** A mark the teacher has typed that the server has not seen yet, as the live preview sends it. */
export type PreviewEdit = {
  question_no: number;
  /** null = the box was cleared: the question falls back to the AI's mark. */
  teacher_marks: number | null;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** 5 -> "5", 2.5 -> "2.5", null -> an em dash. */
export function formatMarks(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  return String(round2(value));
}

/** The text for a mark box: empty for "not reviewed". */
export function formatMarksInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';

  return String(round2(value));
}

/**
 * Reads one mark box.
 *
 * `Number()` rather than `parseFloat()`: parseFloat('3abc') is 3, and a teacher
 * who typed "3abc" should be told, not given a 3. Fractions are allowed and are
 * kept to two places, as on the server.
 */
export function parseMarkInput(raw: string | undefined, max: number): ParsedMark {
  const text = (raw ?? '').trim();

  if (text === '') {
    return { value: null, error: null };
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return { value: null, error: 'Enter a number.' };
  }

  if (parsed < 0) {
    return { value: null, error: 'Marks can’t be negative.' };
  }

  if (round2(parsed) > max) {
    return { value: null, error: `Can’t be more than ${formatMarks(max)}.` };
  }

  return { value: round2(parsed), error: null };
}

/** The starting state of the boxes: whatever the teacher has already saved, and nothing else. */
export function toInputs(answers: ReviewAnswer[]): { marks: MarkInputs; feedback: FeedbackInputs } {
  const marks: MarkInputs = {};
  const feedback: FeedbackInputs = {};

  for (const answer of answers) {
    marks[answer.question_no] = formatMarksInput(answer.teacher_marks);
    feedback[answer.question_no] = answer.teacher_feedback ?? '';
  }

  return { marks, feedback };
}

/**
 * What a question is called on screen.
 *
 * The number the sheet printed (Q.1(A), Q.2 ...) when it was read; otherwise the paper position
 * ("Q6"). Never a database id, and never a position passed off as the printed number: callers
 * that care use `label_from_sheet` to say the number wasn't read.
 */
export function questionLabel(answer: Pick<ReviewAnswer, 'question_no' | 'display_label'>): string {
  const label = (answer.display_label ?? '').trim();

  return label !== '' ? label : `Q${answer.question_no}`;
}

export function computeTotals(rawAnswers: ReviewAnswer[], marks: MarkInputs): ReviewTotals {
  // One question counts once. The server keys answers by position so it cannot send two, but a
  // total that doubles a question on a duplicated row is worse than one that ignores the repeat.
  const seen = new Set<number>();
  const answers = rawAnswers.filter((answer) => {
    if (seen.has(answer.question_no)) return false;

    seen.add(answer.question_no);

    return true;
  });

  const totals: ReviewTotals = {
    maxTotal: 0,
    aiTotal: 0,
    teacherTotal: 0,
    percentage: null,
    questionCount: answers.length,
    reviewedCount: 0,
    unreviewedCount: 0,
    flaggedCount: 0,
    flaggedUnresolvedCount: 0,
    invalidCount: 0,
    unlabelledCount: 0,
  };

  for (const answer of answers) {
    if (answer.label_from_sheet === false) {
      totals.unlabelledCount += 1;
    }

    const parsed = parseMarkInput(marks[answer.question_no], answer.max_marks);
    const ai = answer.ai_marks ?? 0;

    totals.maxTotal += answer.max_marks;
    totals.aiTotal += ai;
    // An invalid box counts as the suggestion for the preview: the page shows
    // the error beside the box and refuses to save, so nothing invalid is ever sent.
    totals.teacherTotal += parsed.value ?? ai;

    if (parsed.error) {
      totals.invalidCount += 1;
    }

    if (parsed.value !== null) {
      totals.reviewedCount += 1;
    } else {
      totals.unreviewedCount += 1;
    }

    if (answer.needs_attention) {
      totals.flaggedCount += 1;

      if (parsed.value === null) {
        totals.flaggedUnresolvedCount += 1;
      }
    }
  }

  totals.maxTotal = round2(totals.maxTotal);
  totals.aiTotal = round2(totals.aiTotal);
  totals.teacherTotal = round2(totals.teacherTotal);
  totals.percentage = totals.maxTotal > 0 ? round2((totals.teacherTotal / totals.maxTotal) * 100) : null;

  return totals;
}

/** What to send for a save: one entry per question, an empty box meaning "no teacher mark". */
export function buildMarkEdits(
  answers: ReviewAnswer[],
  marks: MarkInputs,
  feedback: FeedbackInputs
): MarkEdit[] {
  return answers.map((answer) => {
    const note = (feedback[answer.question_no] ?? '').trim();

    return {
      question_no: answer.question_no,
      teacher_marks: parseMarkInput(marks[answer.question_no], answer.max_marks).value,
      teacher_feedback: note === '' ? null : note,
    };
  });
}

/**
 * The marks on screen that differ from what is saved, in the form the live preview takes.
 *
 * Only a mark that is VALID, or CLEARED, counts: a half-typed or out-of-range box is left out, so
 * the preview keeps showing the last good state (the page shows the error beside the box) and the
 * server is never sent a mark it would refuse. Feedback does not appear on the PDF, so it is not here.
 */
export function previewEdits(answers: ReviewAnswer[], marks: MarkInputs): PreviewEdit[] {
  const saved = toInputs(answers).marks;
  const edits: PreviewEdit[] = [];
  const seen = new Set<number>();

  for (const answer of answers) {
    if (seen.has(answer.question_no)) continue;

    seen.add(answer.question_no);

    const raw = (marks[answer.question_no] ?? '').trim();
    const parsed = parseMarkInput(raw, answer.max_marks);

    if (parsed.error || raw === (saved[answer.question_no] ?? '')) continue;

    edits.push({ question_no: answer.question_no, teacher_marks: parsed.value });
  }

  return edits;
}

/** Changes whenever the preview would draw something different: the trigger for a refresh. */
export function previewKey(edits: PreviewEdit[]): string {
  return edits.map((edit) => `${edit.question_no}=${edit.teacher_marks ?? ''}`).join('|');
}

/** Whether anything on screen differs from what is saved. */
export function isDirty(
  answers: ReviewAnswer[],
  marks: MarkInputs,
  feedback: FeedbackInputs,
  studentId: number | null,
  savedStudentId: number | null
): boolean {
  if ((studentId ?? null) !== (savedStudentId ?? null)) {
    return true;
  }

  const saved = toInputs(answers);

  return answers.some((answer) => {
    const key = answer.question_no;

    return (
      (marks[key] ?? '').trim() !== saved.marks[key] ||
      (feedback[key] ?? '').trim() !== saved.feedback[key].trim()
    );
  });
}

/**
 * Why this sheet cannot be approved yet, or null when it can.
 *
 * The same conditions the server enforces, said first so the teacher is told
 * before the click rather than after it.
 */
export function approvalBlocker(
  answers: ReviewAnswer[],
  marks: MarkInputs,
  studentId: number | null
): string | null {
  const totals = computeTotals(answers, marks);

  if (!studentId) {
    return 'Assign this sheet to a student before approving it.';
  }

  if (totals.invalidCount > 0) {
    return totals.invalidCount === 1
      ? 'One mark isn’t valid. Fix it before approving.'
      : `${totals.invalidCount} marks aren’t valid. Fix them before approving.`;
  }

  if (totals.flaggedUnresolvedCount > 0) {
    return totals.flaggedUnresolvedCount === 1
      ? '1 flagged question still needs your mark. Enter one, or accept the AI mark.'
      : `${totals.flaggedUnresolvedCount} flagged questions still need your mark. Enter one, or accept the AI mark.`;
  }

  return null;
}

/** Sets a question's box to the AI's suggestion: the teacher agreeing with it, explicitly. */
export function acceptAiMark(answer: ReviewAnswer): string {
  return formatMarksInput(answer.ai_marks ?? 0);
}
