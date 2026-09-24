/**
 * Digitised SOP source text.
 *
 * This is the *input* side of the feature, not the output: the SOP as a person
 * transcribes it out of the PDF, in the plain block format `parser.ts` reads.
 * Keeping the source text here (rather than a hand-built object) means the
 * shipped example goes through exactly the same parse as anything a user pastes
 * in - if the parser regresses, the shipped procedure breaks too, so the
 * example can never silently drift from the code path it demonstrates.
 *
 * The text below is LMS + PAL SOP v1.0, procedure 6.9.4, reproduced from the
 * document's attribute table, step table and procedure-output list.
 */

export const LMS_PAL_6_9_4_SOURCE = `Procedure: 6.9.4 Deliver the adaptive quiz and capture per-question responses
Primary actor: Student + AI

Objective: Deliver an adaptive question set matched to the learner's current level and capture every response with its timing, so mastery can be computed accurately.
Trigger: The learner starts a quiz on a chapter from the PAL workspace.
Preconditions: Chapter is registered with tagged concepts; prerequisites are complete; the question bank holds items at the required difficulty levels; the active session year is correct.
Inputs: Learner identity; selected subject and chapter; prior attempt history; current concept-mastery map.
Completion criteria: The learner submits the attempt, or the attempt window expires, and every response is persisted with its concept and difficulty tag.

Steps
Step | Actor | User / operational action | System action / response | Decision / validation | Result
1 | Student | Selects a chapter and starts the quiz | Checks prerequisite completion and attempt eligibility | BR-02: prerequisites complete? | Quiz opens, or launch is blocked with the prerequisite named
2 | AI | - | Builds the question set: mixed easy / medium / hard on a first attempt, promoted one level on later attempts | BR-03: enough items at the target level? | Question set generated, or a logged fallback one level down
3 | Student + AI | Answers each question in turn | Records the response, per-question time and concept tag; advances the paper | Response captured before the timer lapses? | Response persisted against its concept
4 | Student | Submits the attempt | Closes the attempt and locks further edits | Attempt within the permitted window? | Attempt submitted; scoring begins
5 | AI | - | Scores the attempt and computes mastery per concept | BR-04: score maps to a valid mastery band | Concept mastery updated to needs practice, developing or mastered
6 | AI | - | Infers misconceptions from the pattern of incorrect responses | Incorrect responses cluster on a known misconception? | Misconception raised as Detected, or none raised
7 | Student + AI | Opens the result | Presents the score, the per-concept breakdown and the recommended next step | - | Learner proceeds to remediation, practice or a retake

Output
- A PAL attempt record with every response, its concept tag, difficulty and timing.
- An updated concept-mastery map for the learner.
- Any detected misconception, raised for remediation (6.10).
- A pedagogy-engine recommendation for the learner's next step (6.11).
`

/**
 * Fees SOP v1.0, procedure 6.4.2, reproduced the same way.
 *
 * Counter collection is to the Fees SOP what 6.9.4 is to LMS + PAL: the one
 * procedure written out in full, with every other procedure authored against
 * it. It is also the useful test of a second module, because it exercises what
 * the first one does not - a staff actor running most of the steps, a module
 * that names its people differently ("Fees officer", "Parent"), and unattended
 * steps that move money rather than marks.
 */
export const FEES_6_4_2_SOURCE = `Procedure: 6.4.2 Collect a regular fee payment and issue the receipt
Primary actor: Fees officer

Objective: Collect a fee payment at the counter against the student's outstanding instalments and issue a numbered receipt, so the ledger and the parent's record agree.
Trigger: A parent presents a fee payment at the fees counter.
Preconditions: The fee break-off is assigned to the student; the receipt book series is configured for the counter; any concession or waiver is approved and within the configured limit; the active academic year is correct.
Inputs: Student identity; the assigned break-off and its outstanding instalments; the payment amount, mode and instrument details; the active receipt book series.
Completion criteria: The receipt is issued from the configured series, the ledger is posted, and the payment is either credited or recorded as uncleared pending bank confirmation.

Steps
Step | Actor | User / operational action | System action / response | Decision / validation | Result
1 | Fees officer | Searches the student and opens the fee ledger | Loads the assigned break-off, the outstanding instalments and any approved concession | BR-10: is the student in a standard allocated to this officer? | Ledger opens, or access is refused and audited
2 | Fees officer | Selects the fee heads and instalments being paid | Computes the payable amount, including any late fee due | BR-01: are the selected heads mapped to the active year and standard? | Payable amount shown, or the unmapped head is named
3 | Fees officer | Enters the amount, the payment mode and the instrument details | Validates the amount against the outstanding balance | BR-03: is the amount within the outstanding balance? | Amount accepted, or refused with the outstanding restated
4 | AI | - | Allocates the amount across the outstanding instalments, oldest first | BR-04: does the allocation clear the oldest instalment first? | Allocation proposed against the ledger
5 | Fees officer | Confirms the collection | Issues the receipt from the configured series and posts the ledger entry | BR-02: is a number available in the counter's series? | Receipt issued and the ledger posted, or issue blocked with the receipt book named
6 | AI | - | Holds a cheque, NACH or gateway payment as uncleared until the bank confirms | BR-11: has the bank or gateway confirmed clearance? | Payment credited, or held as uncleared against the receipt
7 | Fees officer + AI | Reviews the drafted confirmation and sends it | Drafts the payment confirmation to the parent and records the send | BR-07: has the officer applied the draft? | Confirmation sent to the parent and logged

Output
- A numbered fee receipt carrying the payment mode and instrument details.
- A posted ledger entry against the student's outstanding instalments.
- An uncleared-payment record for any cheque, NACH or gateway payment awaiting confirmation.
- The day's collection line, carried into reconciliation (6.8).
- A payment confirmation recorded in the parent communication log (6.3).
`

/**
 * Procedures whose full SOP text ships with the app, keyed by
 * `<module key>/<procedure ref>`. Each SOP authors one procedure in full and
 * writes every other one against it - 6.9.4 for LMS + PAL, 6.4.2 for Fees - so
 * those are the ones with tables to transcribe.
 */
const SHIPPED_SOURCES: Record<string, string> = {
  'lms-pal/6.9.4': LMS_PAL_6_9_4_SOURCE,
  'fees/6.4.2': FEES_6_4_2_SOURCE,
}

export function shippedSourceFor(moduleKey: string, procedureRef: string): string | null {
  return SHIPPED_SOURCES[`${moduleKey}/${procedureRef}`] ?? null
}

/** Blank intake template offered when a procedure has no shipped source text. */
export const SOP_SOURCE_TEMPLATE = `Procedure: <ref> <title>
Primary actor: Teacher | AI | Teacher + AI | Student | Student + AI

Objective: <what the procedure achieves>
Trigger: <what starts it>
Preconditions: <one>; <two>; <three>
Inputs: <one>; <two>
Completion criteria: <when it is done>

Steps
Step | Actor | User / operational action | System action / response | Decision / validation | Result
1 | Teacher | <what the person does> | <what the system does> | BR-01: <check> | <what the step leaves behind>
2 | AI | - | <what the system does unattended> | <check> | <result>

Output
- <record or artefact the procedure produces>
`
