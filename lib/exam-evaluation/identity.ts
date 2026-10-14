// ---------------------------------------------------------------------------
// The rules behind student identification on the exam-evaluation screens.
//
// Kept apart from the React components so they can be tested without a browser,
// and because each one is a place where being wrong files a child's marks under
// someone else:
//
//   - a student the matcher SUGGESTED is not a student a teacher CONFIRMED, and
//     the screens say which, in words, every time;
//   - the picker finds a student by name, roll number, GR number or section, and
//     puts the students the server thought it could be at the top;
//   - moving a sheet off a student who was already confirmed (or whose marks are
//     already being worked on) is a correction and has to say why.
//
// Mirrors ExamEvaluationApiController::review() and StudentMatcherService. If the
// two ever disagree, the server is right and this is the bug.
// ---------------------------------------------------------------------------

/** The slice of a sheet these rules read. The page's full sheet type satisfies it. */
export type IdentitySheet = {
  status: string;
  student_id: number | null;
  identity_source: string;
  identity_confidence: number | null;
  identity_confirmed: boolean;
  identity_issue: string | null;
};

/** The slice of a roster entry the picker searches. */
export type PickerStudent = {
  student_id: number;
  name: string;
  roll_no: string;
  enrollment_no: string;
  section_name?: string;
};

export type IdentityState = 'unmatched' | 'suggested' | 'confirmed_match' | 'selected_by_teacher';

/** The two statuses before any marking: the sheet is being read, or waiting for a teacher. */
export const PRE_EVALUATION_STATUSES = ['Identifying', 'Awaiting identity'] as const;

/** Statuses in which the system is still working, as opposed to waiting for a person. */
export const IN_FLIGHT_STATUSES = ['Identifying', 'Pending', 'Processing'] as const;

export function isAwaitingIdentity(sheet: Pick<IdentitySheet, 'status'>): boolean {
  return sheet.status === 'Awaiting identity';
}

export function identityState(sheet: Pick<IdentitySheet, 'student_id' | 'identity_source' | 'identity_confirmed'>): IdentityState {
  if (!sheet.student_id) return 'unmatched';
  if (!sheet.identity_confirmed) return 'suggested';

  return sheet.identity_source === 'manual' ? 'selected_by_teacher' : 'confirmed_match';
}

/** How the match was made, in words. */
export function matchMethodLabel(source: string): string {
  switch (source) {
    case 'enrollment_no':
      return 'GR / enrollment number';
    case 'roll_no':
      return 'Roll number';
    case 'name':
      return 'Handwritten name';
    case 'manual':
      return 'Chosen by a teacher';
    default:
      return 'No match';
  }
}

/** The status shown beside a student: suggestion and confirmation are never confused. */
export function identityStateLabel(sheet: Pick<IdentitySheet, 'student_id' | 'identity_source' | 'identity_confirmed'>): string {
  switch (identityState(sheet)) {
    case 'unmatched':
      return 'Not matched';
    case 'suggested':
      return 'Suggested — needs your confirmation';
    case 'confirmed_match':
      return 'Confirmed by a teacher';
    case 'selected_by_teacher':
      return 'Selected by a teacher';
  }
}

export function confidenceLabel(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) return '';

  return `${Math.round(confidence)}% sure`;
}

/** Why a sheet could not be matched cleanly, in plain words. Null when nothing was flagged. */
export function identityIssueMessage(issue: string | null | undefined): string | null {
  switch (issue) {
    case 'unreadable':
      return 'The student’s details couldn’t be read from this sheet.';
    case 'unavailable':
      return 'This sheet couldn’t be read just now. Choose the student, or read it again.';
    case 'not_on_roll':
      return 'What was read doesn’t match anyone on this exam’s class list.';
    case 'ambiguous':
      return 'More than one student matches what was read.';
    case 'conflict':
      return 'The numbers and name on the sheet point to different students.';
    case 'duplicate':
      return 'This student already has another sheet in this evaluation.';
    case 'low_confidence':
      return 'The name was too hard to read to rely on.';
    case 'multiple_students':
      return 'This file seems to contain more than one student’s details.';
    default:
      return null;
  }
}

/** A name match is the weakest evidence there is, and says so. */
export function isWeakMatch(sheet: Pick<IdentitySheet, 'identity_source' | 'identity_confirmed'>): boolean {
  return !sheet.identity_confirmed && sheet.identity_source === 'name';
}

// -- Picking a student --------------------------------------------------------

const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    // Marks that combine with a letter (accents) fall away; Indic vowel signs are
    // marks too, but they are matched below on the un-folded text as well.
    .replace(/[̀-ͯ]/g, '')
    .trim();

const compact = (value: string): string => fold(value).replace(/[^a-z0-9\u0080-￿]/g, '');

/**
 * The students a search matches, best first.
 *
 * Every word typed has to match something about the student -- their name, roll
 * number, GR number or section -- so "ravi 3" narrows to the Ravi with roll 3.
 * With nothing typed, the students the server named as the likely ones
 * (`preferred`) come first, so a conflict or an ambiguous name opens on exactly
 * the students it is between.
 */
export function filterStudents<T extends PickerStudent>(students: T[], query: string, preferred: number[] = []): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const favourite = new Set(preferred);

  const scored = students
    .map((student) => {
      const name = fold(student.name);
      const nameWords = name.split(/\s+/);
      const roll = compact(student.roll_no);
      const gr = compact(student.enrollment_no);
      const section = compact(student.section_name ?? '');
      let score = 0;

      for (const word of words) {
        const code = compact(word);
        let best = 0;

        if (code !== '' && roll === code) best = Math.max(best, 5);
        if (code !== '' && gr === code) best = Math.max(best, 5);
        if (code !== '' && gr.includes(code)) best = Math.max(best, 2);
        if (nameWords.some((part) => part === word)) best = Math.max(best, 4);
        if (nameWords.some((part) => part.startsWith(word))) best = Math.max(best, 3);
        if (name.includes(word)) best = Math.max(best, 1);
        if (code !== '' && section === code) best = Math.max(best, 1);

        if (best === 0) return null;

        score += best;
      }

      return { student, score };
    })
    .filter((entry): entry is { student: T; score: number } => entry !== null);

  const rollOf = (student: PickerStudent): number => {
    const parsed = Number.parseInt(student.roll_no, 10);

    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  return scored
    .sort((a, b) => {
      const aFav = favourite.has(a.student.student_id) ? 1 : 0;
      const bFav = favourite.has(b.student.student_id) ? 1 : 0;

      if (words.length === 0 && aFav !== bFav) return bFav - aFav;
      if (b.score !== a.score) return b.score - a.score;
      if (aFav !== bFav) return bFav - aFav;
      if (rollOf(a.student) !== rollOf(b.student)) return rollOf(a.student) - rollOf(b.student);

      return a.student.name.localeCompare(b.student.name);
    })
    .map((entry) => entry.student);
}

/** One line that tells similar students apart: roll, name, GR number, section. */
export function describeStudent(student: PickerStudent): string {
  return [
    student.roll_no ? `${student.roll_no}.` : '',
    student.name,
    student.enrollment_no ? `· GR ${student.enrollment_no}` : '',
    student.section_name ? `· Div ${student.section_name}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// -- Corrections --------------------------------------------------------------

/**
 * Whether changing a sheet's student has to carry a reason: it is moving off a
 * student who was already confirmed, or whose marks a teacher has started, to a
 * different one (or to nobody). Choosing among mere suggestions is not.
 */
export function needsCorrectionReason(input: {
  currentStudentId: number | null;
  nextStudentId: number | null;
  confirmed: boolean;
  hasTeacherWork: boolean;
}): boolean {
  if (!input.currentStudentId) return false;
  if ((input.nextStudentId ?? null) === input.currentStudentId) return false;

  return input.confirmed || input.hasTeacherWork;
}

/** The reason is stored with the correction, so it has to say something. */
export function isUsableReason(reason: string): boolean {
  return reason.trim().length >= 3;
}

/**
 * Why a sheet cannot be approved on identity grounds, or null when it can.
 * Choosing a different student in the same save counts as confirming them.
 */
export function identityBlocker(input: {
  studentId: number | null;
  savedStudentId: number | null;
  savedConfirmed: boolean;
}): string | null {
  if (!input.studentId) return null; // "assign a student" is the existing blocker's job

  const chosenByHand = input.studentId !== (input.savedStudentId ?? null);

  return input.savedConfirmed || chosenByHand
    ? null
    : 'Confirm that this sheet belongs to the student shown before approving it.';
}

// -- The batch screen ---------------------------------------------------------

/** Sheets waiting for a teacher to say whose they are. */
export function sheetsAwaitingIdentity<T extends Pick<IdentitySheet, 'status'>>(sheets: T[]): T[] {
  return sheets.filter(isAwaitingIdentity);
}

/** The ones whose suggestion is a clean number match with nothing flagged. */
export function bulkConfirmableSheets<T extends Pick<IdentitySheet, 'status'> & { can_bulk_confirm?: boolean }>(sheets: T[]): T[] {
  return sheets.filter((sheet) => isAwaitingIdentity(sheet) && sheet.can_bulk_confirm === true);
}

/** Whether the system is still working on any sheet (so the screen keeps refreshing). */
export function anyInFlight(sheets: Array<Pick<IdentitySheet, 'status'>>): boolean {
  return sheets.some((sheet) => (IN_FLIGHT_STATUSES as readonly string[]).includes(sheet.status));
}
