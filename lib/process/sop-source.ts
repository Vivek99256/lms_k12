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
 * Procedures whose full SOP text ships with the app, keyed by
 * `<module key>/<procedure ref>`. The SOP authors 6.9.4 in full and writes
 * every other procedure "per 6.9.4", so it is the one with tables to transcribe.
 */
const SHIPPED_SOURCES: Record<string, string> = {
  'lms-pal/6.9.4': LMS_PAL_6_9_4_SOURCE,
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
