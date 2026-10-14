// ---------------------------------------------------------------------------
// What a teacher can do when a sheet is stuck, and what they are told before they start.
//
// Two small rules kept apart from the React components so they can be tested without a
// browser, and so the screen and the server cannot drift:
//
//   - a sheet the system is working on is left alone -- unless the server says it has been
//     untouched for so long that its job is presumed lost (`stalled`), when it can be put
//     back on the queue. Mirrors ExamEvaluationApiController::reprocess().
//   - before any scanning, the exam picker says how many students are eligible, and warns
//     when the exam is tied to no class (so "eligible" would mean the whole school).
// ---------------------------------------------------------------------------

/** The slice of a sheet these rules read. The page's full sheet type satisfies it. */
export type RecoverySheet = {
  status: string;
  stalled: boolean;
  identity_confirmed: boolean;
};

/** Statuses in which the system, not a person, is expected to move the sheet on. */
const IN_FLIGHT = ['Identifying', 'Pending', 'Processing'];

/**
 * Whether "read again" / "re-run" may be offered for this sheet.
 *
 * A published batch and an approved sheet are never re-run here. A sheet being read or
 * marked is left alone until the server calls it stalled.
 */
export function canReprocess(sheet: RecoverySheet, batchPublished = false): boolean {
  if (batchPublished || sheet.status === 'Approved') return false;

  if (sheet.status === 'Processing' || sheet.status === 'Identifying') return sheet.stalled;

  return true;
}

/** Whether the sheet is stuck rather than merely slow: only an in-flight sheet can be. */
export function isStuck(sheet: RecoverySheet): boolean {
  return sheet.stalled && IN_FLIGHT.includes(sheet.status);
}

/** Calm, blame-free wording for a stuck sheet, or null when nothing is wrong. */
export function stalledMessage(sheet: RecoverySheet): string | null {
  if (!isStuck(sheet)) return null;

  return sheet.status === 'Identifying'
    ? 'Reading the student’s details is taking much longer than usual. Try again; if it keeps happening, check that the background worker is running.'
    : 'This sheet has been waiting much longer than usual. Try again; if it keeps happening, check that the background worker is running.';
}

/** The tooltip for the re-run control, saying what it will actually do. */
export function rerunTitle(sheet: RecoverySheet): string {
  if (isStuck(sheet)) return 'Try again: put this sheet back on the queue';

  return sheet.identity_confirmed
    ? 'Read and score this sheet again (the confirmed student is kept)'
    : 'Read this sheet again, starting with the student’s details';
}

export type EligibleSummary = {
  text: string;
  /** True when the teacher should stop and look before scanning. */
  warn: boolean;
};

/**
 * What the new-evaluation panel says about who may be assigned a sheet.
 *
 * `eligible_students` is a count the server computes from the class list; no student is named.
 */
export function eligibleSummary(key: { applies_to_class: boolean; eligible_students: number }): EligibleSummary {
  const count = key.eligible_students;
  const students = `${count.toLocaleString('en-IN')} ${count === 1 ? 'student' : 'students'}`;

  if (!key.applies_to_class) {
    return {
      warn: true,
      text: `This exam isn’t set for a class, so every student enrolled this year (${students}) would count as eligible, and a sheet could be filed under a child from any class. Set the exam’s class first.`,
    };
  }

  if (count === 0) {
    return {
      warn: true,
      text: 'No students are enrolled in this exam’s class for this academic year, so no sheet could be assigned to anyone.',
    };
  }

  return { warn: false, text: `${students} ${count === 1 ? 'is' : 'are'} eligible for this exam. A sheet can only be assigned to one of them.` };
}

/** One sentence for the result of a bulk confirmation. */
export function describeBulkResult(confirmed: number, skipped: number): string {
  const done = `${confirmed} ${confirmed === 1 ? 'student' : 'students'} confirmed and queued for marking.`;

  if (skipped === 0) return done;

  return `${done} ${skipped} ${skipped === 1 ? 'sheet needs' : 'sheets need'} to be checked one at a time.`;
}
